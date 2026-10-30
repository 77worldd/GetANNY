const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { request, httpError, parseRange, validateRange } = require("./http");
const { RateLimiter } = require("./RateLimiter");
const {
  sanitizeFilename,
  getFilenameFromURL,
  getFilenameFromHeaders,
  validateHeaders,
  validateUrl,
} = require("./utils");

class DownloadEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.id = options.id || randomUUID();
    this.url = validateUrl(options.url);
    this.savePath = options.savePath;
    this.filename = options.filename || null;
    this.filenameExplicit = options.filenameExplicit ?? !!options.filename;
    this.headers = validateHeaders(options.headers);
    this.timeout = options.timeout || 30000;
    this.requestOptions = options.requestOptions || {};
    this.reserveTarget = options.reserveTarget;
    this.connections = options.connections || 1;
    this.limiter = new RateLimiter(options.speedLimit);
    this.status = "queued";
    this.downloadedSize = 0;
    this.totalSize = 0;
    this.speed = 0;
    this.controller = new AbortController();
    this.wantedState = null;
  }

  async probe() {
    // One real range response provides redirect, filename, validators, size
    // and resume capability. A separate HEAD doubled connection initialization.
    const rangeProbe = await request(this.url, {
      headers: { ...this.headers, Range: "bytes=0-0" },
      timeout: this.timeout,
      signal: this.controller.signal,
      requestOptions: this.requestOptions,
    });
    const response = rangeProbe.response;
    const finalUrl = rangeProbe.url;
    this.headers = rangeProbe.headers;
    delete this.headers.Range;
    const headers = response.headers;
    const range = parseRange(headers["content-range"]);
    const status = response.statusCode;
    response.destroy();
    if (![200, 204, 206, 416].includes(status))
      throw httpError(
        status,
        "Unable to access this file. A page URL may need the media extractor instead.",
      );
    if (status === 206 && (!range || range.start !== 0 || range.end !== 0))
      throw new Error(
        "The server returned an invalid range capability response.",
      );
    if (status === 416 && !/^bytes \*\/0$/.test(headers["content-range"] || ""))
      throw httpError(status, "The file range could not be determined.");
    const totalSize =
      range?.total ??
      (status === 416 ? 0 : Number(headers["content-length"]) || 0);
    if (!Number.isSafeInteger(totalSize) || totalSize < 0)
      throw new Error("The server reported an unsupported file size.");
    const filename =
      this.filenameExplicit && this.filename
        ? this.filename
        : getFilenameFromHeaders(headers["content-disposition"]) ||
          getFilenameFromURL(finalUrl) ||
          "download";
    const etag =
      headers.etag && !headers.etag.startsWith("W/") ? headers.etag : null;
    const info = {
      url: finalUrl,
      totalSize,
      resumable: status === 206 && totalSize > 0,
      filename: sanitizeFilename(filename),
      mimeType: headers["content-type"]?.split(";")[0] || null,
      etag,
      lastModified: headers["last-modified"] || null,
    };
    Object.assign(this, info);
    return info;
  }

  start() {
    if (!this.task) this.task = this.run();
    return this.task;
  }
  desiredSegments() {
    return 1;
  }
  async prepare(info) {
    await fsp.mkdir(this.savePath, { recursive: true });
    if (this.reserveTarget) Object.assign(this, await this.reserveTarget(info));
    this.partialPath = path.join(this.savePath, `.getanny-${this.id}.part`);
    this.stateFile = path.join(this.savePath, `.getanny-${this.id}.json`);
    let state;
    try {
      state = JSON.parse(await fsp.readFile(this.stateFile, "utf8"));
    } catch {
      /* first attempt */
    }
    const valid =
      (info.etag || info.lastModified) &&
      info.resumable &&
      state?.url === info.url &&
      state.totalSize === info.totalSize &&
      state.etag === info.etag &&
      state.lastModified === info.lastModified &&
      Number.isInteger(state.segments) &&
      state.segments >= 1 &&
      state.segments <= 16;
    if (!valid) await this.cleanupPartials();
    this.segmentCount = valid ? state.segments : this.desiredSegments();
    await fsp.writeFile(
      `${this.stateFile}.tmp`,
      JSON.stringify({
        version: 1,
        url: info.url,
        totalSize: info.totalSize,
        etag: info.etag,
        lastModified: info.lastModified,
        segments: this.segmentCount,
      }),
    );
    await fsp.rename(`${this.stateFile}.tmp`, this.stateFile);
  }
  async run() {
    let ticker;
    try {
      this.setStatus("connecting");
      const info = await this.probe();
      this.controller.signal.throwIfAborted();
      await this.prepare(info);
      this.controller.signal.throwIfAborted();
      this.setStatus("downloading", {
        filename: this.filename,
        savePath: this.savePath,
        totalSize: this.totalSize,
        resumable: this.resumable,
        mimeType: this.mimeType,
        connections: this.segmentCount,
      });
      this.tickBytes = 0;
      this.lastTick = performance.now();
      ticker = setInterval(() => {
        const now = performance.now();
        this.speed = (this.tickBytes * 1000) / Math.max(1, now - this.lastTick);
        this.tickBytes = 0;
        this.lastTick = now;
        this.emit("progress", this.id, this.progress());
      }, 400);
      await this.transfer();
      this.controller.signal.throwIfAborted();
      const size = (await fsp.stat(this.partialPath)).size;
      if (this.totalSize && size !== this.totalSize)
        throw new Error(
          `Incomplete file: received ${size} of ${this.totalSize} bytes.`,
        );
      const target = path.join(this.savePath, this.filename);
      // Same-directory hard link is atomic and fails rather than overwriting a user's file.
      await fsp.link(this.partialPath, target);
      await this.cleanupPartials();
      this.downloadedSize = size;
      this.totalSize = size;
      this.speed = 0;
      this.setStatus("completed", { filePath: target });
      this.emit("progress", this.id, this.progress());
      this.emit("complete", this.id, {
        filePath: target,
        filename: this.filename,
        totalSize: size,
        downloadedSize: size,
      });
    } catch (error) {
      if (this.wantedState) {
        if (this.wantedState === "cancelled")
          await this.cleanupPartials().catch(() => {});
        if (this.wantedState === "paused") {
          // Abort/pause has settled every writer and worker. The 400 ms UI
          // sample and in-flight meter can both differ from durable partials.
          try {
            this.downloadedSize = await this.partialBytes();
          } catch (error) {
            this.speed = 0;
            this.setStatus("failed", { error: error.message });
            this.emit("error", this.id, error);
            return;
          }
        }
        this.speed = 0;
        this.tickBytes = 0;
        this.setStatus(this.wantedState, this.progress());
      } else {
        if (
          ["ECONNRESET", "ETIMEDOUT", "ERR_STREAM_PREMATURE_CLOSE"].includes(
            error.code,
          )
        )
          error.retryable = true;
        this.speed = 0;
        this.setStatus("failed", { error: error.message });
        this.emit("error", this.id, error);
      }
    } finally {
      clearInterval(ticker);
    }
  }
  async transfer() {
    let existing = await fsp.stat(this.partialPath).then(
      (s) => s.size,
      () => 0,
    );
    if (!this.resumable || existing > this.totalSize) {
      await fsp.rm(this.partialPath, { force: true });
      existing = 0;
    }
    this.downloadedSize = existing;
    if (this.totalSize && existing === this.totalSize) return;
    const headers = { ...this.headers };
    if (existing) {
      headers.Range = `bytes=${existing}-`;
      if (this.etag || this.lastModified)
        headers["If-Range"] = this.etag || this.lastModified;
    }
    const { response } = await request(this.url, {
      headers,
      timeout: this.timeout,
      signal: this.controller.signal,
      requestOptions: this.requestOptions,
    });
    if (existing && response.statusCode === 200) {
      // The entity changed or the server ignored Range. Restart safely, never append a full response.
      existing = 0;
      this.downloadedSize = 0;
      this.totalSize = Number(response.headers["content-length"]) || 0;
    } else if (existing || response.statusCode === 206) {
      validateRange(response, existing, this.totalSize - 1, this.totalSize);
    } else if (![200, 204].includes(response.statusCode)) {
      response.destroy();
      throw httpError(
        response.statusCode,
        "The download request was rejected.",
      );
    }
    if (
      response.headers["content-encoding"] &&
      response.headers["content-encoding"] !== "identity"
    ) {
      response.destroy();
      throw new Error(
        "The server returned compressed transfer bytes despite requesting identity encoding.",
      );
    }
    if (!this.totalSize)
      this.totalSize = Number(response.headers["content-length"]) || 0;
    const meter = new Transform({
      transform: (chunk, _encoding, callback) => {
        this.limiter.consume(chunk.length, this.controller.signal).then(() => {
          this.downloadedSize += chunk.length;
          this.tickBytes += chunk.length;
          if (this.totalSize && this.downloadedSize > this.totalSize)
            return callback(
              new Error(
                "The server sent more bytes than the declared file size.",
              ),
            );
          callback(null, chunk);
        }, callback);
      },
    });
    await pipeline(
      response,
      meter,
      fs.createWriteStream(this.partialPath, { flags: existing ? "a" : "w" }),
      { signal: this.controller.signal },
    );
  }
  progress() {
    return {
      filename: this.filename,
      savePath: this.savePath,
      downloadedSize: this.downloadedSize,
      totalSize: this.totalSize,
      speed: this.speed,
      eta:
        this.speed > 0 && this.totalSize >= this.downloadedSize
          ? (this.totalSize - this.downloadedSize) / this.speed
          : null,
      resumable: this.resumable,
      connections: this.segmentCount || 1,
    };
  }
  setStatus(status, data = {}) {
    this.status = status;
    this.emit("status", this.id, status, { speed: 0, ...data });
  }
  async pause() {
    return this.stop("paused");
  }
  async cancel() {
    return this.stop("cancelled");
  }
  async stop(status) {
    if (["completed", "failed", "cancelled"].includes(this.status))
      return false;
    this.wantedState = status;
    this.controller.abort(
      new Error(
        status === "paused" ? "Download paused." : "Download cancelled.",
      ),
    );
    await this.task;
    return true;
  }
  async partialBytes(file = this.partialPath) {
    if (!file) return 0;
    try {
      return (await fsp.stat(file)).size;
    } catch (error) {
      if (error.code === "ENOENT") return 0;
      throw error;
    }
  }
  async cleanupPartials() {
    if (!this.savePath) return;
    const files = await fsp.readdir(this.savePath).catch(() => []);
    await Promise.all(
      files
        .filter(
          (name) =>
            name === `.getanny-${this.id}.part` ||
            name === `.getanny-${this.id}.json` ||
            name === `.getanny-${this.id}.json.tmp` ||
            name.startsWith(`.getanny-${this.id}.part-`),
        )
        .map((name) => fsp.rm(path.join(this.savePath, name), { force: true })),
    );
  }
}
module.exports = { DownloadEngine };
