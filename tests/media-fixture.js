const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { YtDlpWrapper } = require("../src/main/media/YtDlpWrapper");
const { temporary, fixtureServer } = require("./helpers");
const binPath = path.resolve(__dirname, "../bin");
const ffmpeg = path.join(
  binPath,
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
);
const ffprobe = path.join(
  binPath,
  process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
);
async function mediaFixture(t) {
  const dir = await temporary(t, "getanny-media-");
  for (const file of [
    ffmpeg,
    ffprobe,
    new YtDlpWrapper({ binPath }).executable(),
  ]) {
    if (
      !(await fs.access(file).then(
        () => true,
        () => false,
      ))
    ) {
      t.skip("Media binaries unavailable. Run npm run prepare:tools.");
      return null;
    }
  }
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=15",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=44100",
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    path.join(dir, "video.mp4"),
  ]);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    path.join(dir, "video.mp4"),
    "-an",
    "-c:v",
    "copy",
    path.join(dir, "silent.mp4"),
  ]);
  execFileSync(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    path.join(dir, "video.mp4"),
    "-vn",
    "-c:a",
    "copy",
    path.join(dir, "audio.m4a"),
  ]);
  const server = await fixtureServer(t, {
    extra: async (req, res, url) => {
      if (url.pathname === "/watch.html" || url.pathname === "/listen.html") {
        res.setHeader("Content-Type", "text/html");
        res.end(
          `<html><head><title>GetANNY integration fixture</title></head><body>${url.pathname === "/watch.html" ? '<video controls src="/video.mp4"></video>' : '<audio controls src="/audio.m4a"></audio>'}</body></html>`,
        );
        return true;
      }
      if (url.pathname === "/adaptive.mpd") {
        res.setHeader("Content-Type", "application/dash+xml");
        res.end(
          `<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT3S" minBufferTime="PT1S"><Period duration="PT3S"><AdaptationSet mimeType="video/mp4" contentType="video"><Representation id="v1" bandwidth="300000" width="320" height="180" frameRate="15" codecs="avc1.64000c"><BaseURL>silent.mp4</BaseURL></Representation></AdaptationSet><AdaptationSet mimeType="audio/mp4" contentType="audio"><Representation id="a1" bandwidth="128000" audioSamplingRate="44100" codecs="mp4a.40.2"><BaseURL>audio.m4a</BaseURL></Representation></AdaptationSet></Period></MPD>`,
        );
        return true;
      }
      const file = ["/video.mp4", "/silent.mp4", "/audio.m4a"].includes(
        url.pathname,
      )
        ? path.join(dir, path.basename(url.pathname))
        : null;
      if (!file) return false;
      const buffer = await fs.readFile(file);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader(
        "Content-Type",
        file.endsWith(".m4a") ? "audio/mp4" : "video/mp4",
      );
      let start = 0,
        end = buffer.length - 1;
      const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if (range) {
        start = +range[1];
        end = range[2] ? Math.min(+range[2], end) : end;
        res.statusCode = 206;
        res.setHeader(
          "Content-Range",
          `bytes ${start}-${end}/${buffer.length}`,
        );
      }
      res.setHeader("Content-Length", end - start + 1);
      if (req.method === "HEAD") res.end();
      else res.end(buffer.subarray(start, end + 1));
      return true;
    },
  });
  return { dir, server, wrapper: new YtDlpWrapper({ binPath }) };
}

module.exports = { mediaFixture };
