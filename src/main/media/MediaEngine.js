const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const path = require("node:path");
const { sanitizeFilename } = require("../engine/utils");

class MediaEngine extends EventEmitter {
  constructor(options, wrapper) {
    super();
    Object.assign(this, options);
    this.wrapper = wrapper;
    this.controller = new AbortController();
    this.status = "queued";
    this.tracks = new Map();
  }
  setStatus(status, data = {}) {
    this.status = status;
    this.emit("status", this.id, status, { speed: 0, ...data });
  }
  start() {
    if (!this.task) this.task = this.run();
    return this.task;
  }
  async run() {
    try {
      const media = this.media;
      if (!media?.formatId)
        throw new Error(
          "The media selection is missing. Analyze the page again.",
        );
      this.setStatus("connecting");
      await fs.mkdir(this.savePath, { recursive: true });
      const stem = `${sanitizeFilename(media.title).slice(0, 140)} [${this.id}]`;
      const outputTemplate =
        path.join(this.savePath, stem).replaceAll("%", "%%") + ".%(ext)s";
      let filePath;
      await this.wrapper.download({
        url: this.url,
        formatId: media.formatId,
        mergeAudio: media.mergeAudio,
        outputTemplate,
        speedLimit: this.speedLimit,
        timeout: this.timeout / 1000,
        signal: this.controller.signal,
        onFile: (value) => {
          filePath = value;
        },
        onProgress: (value) => {
          if (this.controller.signal.aborted) return;
          const key = value.filename || value.info_dict?.format_id || "stream";
          this.tracks.set(key, {
            bytes: Number(value.downloaded_bytes) || 0,
            total: Number(value.total_bytes || value.total_bytes_estimate) || 0,
            approximate:
              !value.total_bytes && Number(value.total_bytes_estimate) > 0,
          });
          const tracks = [...this.tracks.values()];
          const downloadedSize = tracks.reduce(
            (sum, track) => sum + track.bytes,
            0,
          );
          // A finished video track is not the whole adaptive download.
          // Until both track totals are known, show unknown instead of a false 100%.
          const totalSize =
            tracks.length >= (media.mergeAudio ? 2 : 1) &&
            tracks.every((track) => track.total > 0)
              ? tracks.reduce((sum, track) => sum + track.total, 0)
              : 0;
          if (value.status === "downloading" && this.status !== "downloading")
            this.setStatus("downloading");
          const finalizing =
            value.status === "finished" &&
            tracks.length >= (media.mergeAudio ? 2 : 1);
          if (finalizing)
            this.setStatus("processing", { phase: "Finalizing media" });
          this.emit("progress", this.id, {
            downloadedSize,
            totalSize,
            approximateSize:
              totalSize > 0 && tracks.some((track) => track.approximate),
            speed: Number(value.speed) || 0,
            eta: Number.isFinite(value.eta) ? value.eta : null,
            phase: finalizing
              ? "Finalizing media"
              : media.mergeAudio && tracks.length < 2
                ? "Downloading video; audio follows"
                : "Downloading media",
          });
        },
      });
      this.controller.signal.throwIfAborted();
      if (!filePath)
        throw new Error(
          "yt-dlp exited without reporting a completed output file.",
        );
      filePath = path.resolve(filePath);
      if (
        path.dirname(filePath) !== path.resolve(this.savePath) ||
        !path.basename(filePath).startsWith(stem)
      )
        throw new Error("yt-dlp reported an unexpected output location.");
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size === 0 || /\.(part|ytdl)$/.test(filePath))
        throw new Error("The media output is missing or incomplete.");
      this.setStatus("completed");
      this.emit("complete", this.id, {
        filePath,
        filename: path.basename(filePath),
        totalSize: stat.size,
        downloadedSize: stat.size,
        approximateSize: false,
      });
    } catch (error) {
      if (this.wantedState) {
        if (this.wantedState === "cancelled") await this.cleanup();
        this.setStatus(this.wantedState);
      } else {
        this.setStatus("failed", { error: error.message });
        this.emit("error", this.id, error);
      }
    }
  }
  async cleanup() {
    const names = await fs.readdir(this.savePath).catch(() => []);
    await Promise.all(
      names
        .filter((name) => name.includes(`[${this.id}]`))
        .map((name) => fs.rm(path.join(this.savePath, name), { force: true })),
    );
  }
  async stop(status) {
    if (["completed", "failed", "cancelled"].includes(this.status))
      return false;
    this.wantedState = status;
    this.controller.abort();
    await this.task;
    return true;
  }
  pause() {
    return this.stop("paused");
  }
  cancel() {
    return this.stop("cancelled");
  }
}
module.exports = { MediaEngine };
