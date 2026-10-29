const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
const { validateUrl } = require("../engine/utils");
const { normalizeFormats } = require("./formats");

class YtDlpWrapper {
  constructor({ binPath, executable, spawnProcess = spawn } = {}) {
    this.binPath = binPath || "";
    this.executableOverride = executable;
    this.spawnProcess = spawnProcess;
  }
  executable() {
    return (
      this.executableOverride ||
      path.join(
        this.binPath,
        process.platform === "win32"
          ? "yt-dlp.exe"
          : process.platform === "darwin"
            ? "yt-dlp_macos"
            : "yt-dlp",
      )
    );
  }
  async availability() {
    const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const [ytdlp, ffmpeg] = await Promise.all([
      fs.access(this.executable()).then(
        () => true,
        () => false,
      ),
      fs.access(path.join(this.binPath, name)).then(
        () => true,
        () => false,
      ),
    ]);
    return { ytdlp, ffmpeg };
  }
  run(args, { onProgress = () => {}, onFile = () => {}, signal } = {}) {
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(this.executable(), args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      });
      let stdout = "",
        stderr = "",
        buffer = "",
        killed = false,
        killTimer;
      const abort = () => {
        killed = true;
        if (!child.pid) return;
        if (process.platform === "win32")
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
            windowsHide: true,
            stdio: "ignore",
          }).on("error", () => child.kill());
        else {
          try {
            process.kill(-child.pid, "SIGTERM");
          } catch {
            child.kill();
          }
        }
        killTimer = setTimeout(() => {
          try {
            if (process.platform === "win32") child.kill();
            else process.kill(-child.pid, "SIGKILL");
          } catch {
            /* already exited */
          }
        }, 3000);
        killTimer.unref?.();
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const line = (value) => {
        if (value.startsWith("GETANNY_PROGRESS:")) {
          try {
            onProgress(JSON.parse(value.slice("GETANNY_PROGRESS:".length)));
          } catch {
            /* unrelated tool output */
          }
        } else if (value.startsWith("GETANNY_FILE:")) {
          try {
            onFile(JSON.parse(value.slice("GETANNY_FILE:".length)));
          } catch {
            /* invalid output rejected by final verification */
          }
        } else stdout += value + "\n";
        if (stdout.length > 25_000_000) {
          child.kill();
          reject(
            new Error("Media metadata exceeds the supported response size."),
          );
        }
      };
      child.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        let end;
        while ((end = buffer.indexOf("\n")) >= 0) {
          line(buffer.slice(0, end).trim());
          buffer = buffer.slice(end + 1);
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-12000);
      });
      child.once("error", (error) => {
        signal?.removeEventListener("abort", abort);
        reject(
          new Error(
            error.code === "ENOENT"
              ? "yt-dlp is missing. Run npm run prepare:tools or reinstall the complete application."
              : `Could not start yt-dlp: ${error.message}`,
          ),
        );
      });
      child.once("close", (code) => {
        clearTimeout(killTimer);
        signal?.removeEventListener("abort", abort);
        if (buffer.trim()) line(buffer.trim());
        if (killed || signal?.aborted)
          reject(new Error("Media operation stopped."));
        else if (code === 0) resolve(stdout.trim());
        else
          reject(
            new Error(
              stderr.trim() || `yt-dlp stopped with exit code ${code}.`,
            ),
          );
      });
    });
  }
  async getInfo(url, { signal } = {}) {
    const out = await this.run(
      [
        "--ignore-config",
        "--js-runtimes",
        `node:${process.execPath}`,
        "--dump-single-json",
        "--no-warnings",
        "--no-playlist",
        "--socket-timeout",
        "30",
        "--",
        validateUrl(url),
      ],
      { signal },
    );
    try {
      return JSON.parse(out);
    } catch {
      throw new Error("yt-dlp returned invalid media metadata.");
    }
  }
  async getFormats(url) {
    const info = await this.getInfo(url);
    return {
      title: info.title || "Untitled media",
      url: info.webpage_url || url,
      thumbnail: info.thumbnail || null,
      duration: info.duration || null,
      extractor: info.extractor_key || info.extractor || null,
      formats: normalizeFormats(info),
    };
  }
  async download({
    url,
    formatId,
    mergeAudio,
    outputTemplate,
    speedLimit,
    timeout = 30,
    onProgress,
    onFile,
    signal,
  }) {
    if (!/^[\w.-]+$/.test(formatId))
      throw new Error("Choose an available media format.");
    const tools = await this.availability();
    if (mergeAudio && !tools.ffmpeg)
      throw new Error(
        "This video format needs FFmpeg to include audio. Reinstall the complete application, or choose a format that already includes sound.",
      );
    await fs.mkdir(path.dirname(outputTemplate), { recursive: true });
    const args = [
      "--ignore-config",
      "--js-runtimes",
      `node:${process.execPath}`,
      "--no-playlist",
      "--newline",
      "--no-color",
      "--progress",
      "--continue",
      "--no-overwrites",
      "--no-mtime",
      "--windows-filenames",
      "--socket-timeout",
      String(timeout),
      "--retries",
      "2",
      "--fragment-retries",
      "2",
      "--progress-template",
      "download:GETANNY_PROGRESS:%(progress)j",
      "--print",
      "after_move:GETANNY_FILE:%(filepath)j",
      "--no-simulate",
      "-o",
      outputTemplate,
      "-f",
      mergeAudio ? `${formatId}+bestaudio` : formatId,
    ];
    if (tools.ffmpeg) args.push("--ffmpeg-location", this.binPath);
    if (speedLimit > 0) args.push("--limit-rate", String(speedLimit));
    args.push("--", validateUrl(url));
    return this.run(args, { onProgress, onFile, signal });
  }
}
module.exports = { YtDlpWrapper };
