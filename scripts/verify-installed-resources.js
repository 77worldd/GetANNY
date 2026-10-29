const fs = require("node:fs/promises");
const path = require("node:path");
module.exports = async (context) => {
  if (context.electronPlatformName !== "win32") return;
  const resources = path.join(context.appOutDir, "resources");
  for (const file of [
    "bin/yt-dlp.exe",
    "bin/ffmpeg.exe",
    "bin/ffprobe.exe",
    "bin/GetANNY.NativeHost.exe",
    "bin/FFmpeg-LICENSE.txt",
    "bin/FFmpeg-SOURCE.txt",
    "native-host/native-host.js",
    "native-host/node_modules/ws/index.js",
    "native-host/node_modules/ws/lib/websocket.js",
    "extension/chromium/manifest.json",
    "extension/firefox/manifest.json",
    "app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    "app.asar.unpacked/src/main/engine/chunk-worker.js",
  ])
    await fs.access(path.join(resources, file)).catch(() => {
      throw new Error(`Packaged resource missing: ${file}`);
    });
  for (const file of [
    "yt-dlp.exe",
    "ffmpeg.exe",
    "ffprobe.exe",
    "GetANNY.NativeHost.exe",
  ]) {
    const handle = await fs.open(path.join(resources, "bin", file), "r");
    try {
      const prefix = Buffer.alloc(2);
      await handle.read(prefix, 0, 2, 0);
      if (prefix.toString() !== "MZ")
        throw new Error(`Not a real Windows executable: ${file}`);
    } finally {
      await handle.close();
    }
  }
};
