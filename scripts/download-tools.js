const https = require("node:https");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const manifest = require("./tools-manifest.json");
function get(url, redirects = 8) {
  return new Promise((resolve, reject) => {
    const caFile = "/etc/ssl/certs/ca-certificates.crt";
    const request = https.get(
      url,
      {
        headers: { "User-Agent": "GetANNY/2.0 binary preparation" },
        ...(process.platform === "linux" && fs.existsSync(caFile)
          ? { ca: fs.readFileSync(caFile) }
          : {}),
      },
      (response) => {
        if (
          [301, 302, 303, 307, 308].includes(response.statusCode) &&
          response.headers.location
        ) {
          response.resume();
          if (!redirects) return reject(new Error("Too many redirects."));
          return resolve(
            get(new URL(response.headers.location, url).href, redirects - 1),
          );
        }
        if (response.statusCode !== 200) {
          response.resume();
          return reject(
            new Error(`HTTP ${response.statusCode} fetching ${url}`),
          );
        }
        resolve(response);
      },
    );
    request.on("error", reject);
    request.setTimeout(60000, () =>
      request.destroy(new Error("Tool download timed out.")),
    );
  });
}
async function download(url, file, expectedHash) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  if (
    expectedHash &&
    fs.existsSync(file) &&
    createHash("sha256")
      .update(await fsp.readFile(file))
      .digest("hex") === expectedHash
  )
    return;
  const response = await get(url);
  const hash = createHash("sha256");
  const meter = new Transform({
    transform(chunk, _enc, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  const temp = `${file}.tmp`;
  try {
    await pipeline(response, meter, fs.createWriteStream(temp));
    const actual = hash.digest("hex");
    if (expectedHash && actual !== expectedHash)
      throw new Error(
        `Checksum mismatch for ${path.basename(file)}. Refusing to package an unverified tool.`,
      );
    await fsp.rename(temp, file);
    await fsp.chmod(file, 0o755);
    console.log(`Verified ${path.basename(file)}: ${actual}`);
  } catch (error) {
    await fsp.rm(temp, { force: true });
    throw error;
  }
}
async function prepareYtdlp() {
  const entry = manifest.ytDlp;
  const asset = entry.assets[`${process.platform}-${process.arch}`];
  if (!asset)
    throw new Error(
      "No pinned yt-dlp binary for this platform / architecture.",
    );
  const output = process.platform === "linux" ? "yt-dlp" : asset.name;
  await download(
    `https://github.com/${entry.repository}/releases/download/${entry.version}/${asset.name}`,
    path.resolve(__dirname, "../bin", output),
    asset.sha256,
  );
}
async function prepareFfmpeg() {
  const entry = manifest.ffmpeg;
  const key = `${process.platform}-${process.arch}`;
  const assets = entry.assets[key];
  if (!assets)
    throw new Error(
      "No pinned FFmpeg build for this platform. Supply audited ffmpeg and ffprobe binaries in bin/ before packaging.",
    );
  for (const asset of assets)
    await download(
      `https://github.com/${entry.repository}/releases/download/${entry.version}/${asset.name}`,
      path.resolve(__dirname, "../bin", asset.output),
      asset.sha256,
    );
  // Redistribute upstream license and build/source instructions beside the binary.
  await download(
    `https://github.com/${entry.repository}/releases/download/${entry.version}/${key}.LICENSE`,
    path.resolve(__dirname, "../bin/FFmpeg-LICENSE.txt"),
    entry.notices[key].LICENSE,
  );
  await download(
    `https://github.com/${entry.repository}/releases/download/${entry.version}/${key}.README`,
    path.resolve(__dirname, "../bin/FFmpeg-SOURCE.txt"),
    entry.notices[key].README,
  );
}
module.exports = { prepareYtdlp, prepareFfmpeg, download };
