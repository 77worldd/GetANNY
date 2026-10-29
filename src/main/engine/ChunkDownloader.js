const { Worker } = require("node:worker_threads");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { DownloadEngine } = require("./DownloadEngine");

class ChunkDownloader extends DownloadEngine {
  constructor(options = {}) {
    super(options);
    this.connections = Math.min(16, Math.max(1, options.connections || 8));
    this.workers = new Set();
  }
  desiredSegments() {
    return this.resumable && this.totalSize >= 2 * 1024 * 1024
      ? Math.min(
          this.connections,
          Math.max(1, Math.floor(this.totalSize / (1024 * 1024))),
        )
      : 1;
  }
  async transfer() {
    if (this.segmentCount === 1) return super.transfer();
    const chunkSize = Math.ceil(this.totalSize / this.segmentCount);
    const parts = Array.from({ length: this.segmentCount }, (_, index) => ({
      start: index * chunkSize,
      end: Math.min(this.totalSize - 1, (index + 1) * chunkSize - 1),
      file: `${this.partialPath}-${index}`,
    }));
    this.downloadedSize = 0;
    for (const part of parts) {
      part.existing = await fsp.stat(part.file).then(
        (s) => s.size,
        () => 0,
      );
      if (part.existing > part.end - part.start + 1) {
        await fsp.rm(part.file, { force: true });
        part.existing = 0;
      }
      this.downloadedSize += part.existing;
    }
    const stopAll = () => {
      for (const worker of this.workers) worker.postMessage({ type: "cancel" });
    };
    this.controller.signal.addEventListener("abort", stopAll, { once: true });
    let failure;
    const pending = parts.filter((p) => p.existing < p.end - p.start + 1);
    let cursor = 0;
    const pool = Array.from(
      { length: Math.min(this.connections, pending.length) },
      async () => {
        while (
          cursor < pending.length &&
          !failure &&
          !this.controller.signal.aborted
        ) {
          const part = pending[cursor++];
          try {
            await this.runWorker(part);
          } catch (error) {
            if (!failure) {
              failure = error;
              stopAll();
            }
          }
        }
      },
    );
    await Promise.allSettled(pool);
    this.controller.signal.removeEventListener("abort", stopAll);
    this.controller.signal.throwIfAborted();
    if (failure) throw failure;
    for (const part of parts) {
      if ((await fsp.stat(part.file)).size !== part.end - part.start + 1)
        throw new Error("A downloaded segment is incomplete.");
    }
    const inputs = async function* () {
      for (const part of parts) {
        for await (const buffer of fs.createReadStream(part.file)) yield buffer;
      }
    };
    this.setStatus("processing", { phase: "Assembling verified segments" });
    await pipeline(
      Readable.from(inputs()),
      fs.createWriteStream(this.partialPath),
      { signal: this.controller.signal },
    );
  }
  runWorker(part) {
    return new Promise((resolve, reject) => {
      const workerPath = path
        .join(__dirname, "chunk-worker.js")
        .replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
      const worker = new Worker(workerPath, {
        workerData: {
          ...part,
          url: this.url,
          headers: this.headers,
          etag: this.etag,
          lastModified: this.lastModified,
          totalSize: this.totalSize,
          timeout: this.timeout,
          requestOptions: this.requestOptions,
        },
      });
      this.workers.add(worker);
      let result;
      let failure;
      worker.on("message", (message) => {
        if (message.type === "throttle") {
          this.limiter.consume(message.bytes, this.controller.signal).then(
            () => {
              if (this.workers.has(worker))
                worker.postMessage({
                  type: "grant",
                  requestId: message.requestId,
                });
            },
            () => {
              if (this.workers.has(worker))
                worker.postMessage({ type: "cancel" });
            },
          );
        } else if (message.type === "progress" && !this.wantedState) {
          this.downloadedSize += message.bytes;
          this.tickBytes += message.bytes;
        } else if (message.type === "done") result = true;
        else if (message.type === "error") {
          failure = new Error(message.error);
          failure.retryable = message.retryable;
        }
      });
      worker.once("error", (error) => {
        failure = error;
      });
      worker.once("exit", (code) => {
        this.workers.delete(worker);
        if (result) resolve();
        else
          reject(
            failure ||
              new Error(`Segment stopped before completion (exit ${code}).`),
          );
      });
    });
  }
}
module.exports = { ChunkDownloader };
