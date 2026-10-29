const { EventEmitter } = require("node:events");
const path = require("node:path");
const fs = require("node:fs/promises");

// Per-download client makes pause stop sockets/uploads, and bandwidth settings
// unambiguous. Resume rechecks pieces on disk instead of trusting saved progress.
class TorrentEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    Object.assign(this, options);
    this.status = "queued";
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
    let ticker, timeout;
    try {
      this.setStatus("connecting", { phase: "Finding torrent metadata" });
      await fs.mkdir(this.savePath, { recursive: true });
      const { default: WebTorrent } = await import("webtorrent");
      if (this.wantedState) return;
      this.client = new WebTorrent({
        downloadLimit: this.speedLimit || -1,
        uploadLimit: 128 * 1024,
        maxConns: Math.max(8, this.connections * 4),
      });
      await new Promise((resolve, reject) => {
        this.finish = resolve;
        this.client.once("error", reject);
        const torrent = this.client.add(this.url, { path: this.savePath });
        this.torrent = torrent;
        torrent.once("error", reject);
        timeout = setTimeout(
          () =>
            reject(
              new Error(
                "No torrent metadata received within 90 seconds. Check the magnet link, peers and network.",
              ),
            ),
          90000,
        );
        torrent.once("ready", () => {
          clearTimeout(timeout);
          this.setStatus("downloading", {
            filename: torrent.name,
            totalSize: torrent.length,
            filePath: path.join(this.savePath, torrent.name),
            phase: "Downloading verified pieces",
          });
        });
        ticker = setInterval(() => {
          this.emit("progress", this.id, {
            downloadedSize: torrent.downloaded || 0,
            totalSize: torrent.length || 0,
            speed: torrent.downloadSpeed || 0,
            eta: Number.isFinite(torrent.timeRemaining)
              ? torrent.timeRemaining / 1000
              : null,
            peers: torrent.numPeers || 0,
          });
        }, 500);
        torrent.once("done", resolve);
      });
      if (this.wantedState) {
        this.setStatus(this.wantedState);
        return;
      }
      if (!this.torrent.done || this.torrent.downloaded < this.torrent.length)
        throw new Error("The torrent stopped before all pieces were verified.");
      const data = {
        filename: this.torrent.name,
        totalSize: this.torrent.length,
        downloadedSize: this.torrent.length,
        filePath: path.join(this.savePath, this.torrent.name),
      };
      await fs.access(data.filePath);
      this.setStatus("completed");
      this.emit("complete", this.id, data);
    } catch (error) {
      if (this.wantedState) this.setStatus(this.wantedState);
      else {
        this.setStatus("failed", { error: error.message });
        this.emit("error", this.id, error);
      }
    } finally {
      clearInterval(ticker);
      clearTimeout(timeout);
      await this.destroyClient();
      if (this.wantedState && this.status !== this.wantedState)
        this.setStatus(this.wantedState);
    }
  }
  async destroyClient() {
    if (this.client && !this.client.destroyed)
      await new Promise((resolve) => this.client.destroy(resolve));
  }
  async stop(status) {
    if (["completed", "failed", "cancelled"].includes(this.status))
      return false;
    this.wantedState = status;
    this.finish?.();
    await this.destroyClient();
    await this.task;
    this.setStatus(status);
    return true;
  }
  pause() {
    return this.stop("paused");
  }
  cancel() {
    return this.stop("cancelled");
  }
}
module.exports = { TorrentEngine };
