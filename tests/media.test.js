const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { normalizeFormats } = require("../src/main/media/formats");
const { MediaDetector } = require("../src/main/media/MediaDetector");
const { YtDlpWrapper } = require("../src/main/media/YtDlpWrapper");
const { MediaEngine } = require("../src/main/media/MediaEngine");
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

test("format normalization hides storyboards, DRM and true duplicates; preserves codec / audio distinctions", () => {
  const formats = normalizeFormats({
    formats: [
      {
        format_id: "sb0",
        url: "https://test/sb",
        ext: "mhtml",
        vcodec: "none",
        acodec: "none",
      },
      {
        format_id: "drm",
        url: "https://test/v",
        ext: "mp4",
        vcodec: "avc1",
        has_drm: true,
      },
      {
        format_id: "137",
        url: "https://test/v",
        ext: "mp4",
        height: 1080,
        width: 1920,
        fps: 30,
        vcodec: "avc1",
        acodec: "none",
        filesize: 10000,
      },
      {
        format_id: "137duplicate",
        url: "https://test/v2",
        ext: "mp4",
        height: 1080,
        width: 1920,
        fps: 30,
        vcodec: "avc1",
        acodec: "none",
        filesize: 10000,
      },
      {
        format_id: "248",
        url: "https://test/v3",
        ext: "webm",
        height: 1080,
        width: 1920,
        fps: 60,
        vcodec: "vp9",
        acodec: "none",
        filesize_approx: 9000,
      },
      {
        format_id: "140",
        url: "https://test/a",
        ext: "m4a",
        vcodec: "none",
        acodec: "mp4a",
        abr: 128,
      },
    ],
  });
  assert.equal(formats.length, 3);
  assert.equal(formats.find((f) => f.formatId === "137").mergeAudio, true);
  assert.equal(formats.find((f) => f.formatId === "140").filesize, null);
  assert.equal(formats.find((f) => f.formatId === "248").approximateSize, true);
});
test("direct generic media with unreported codecs remains downloadable without claiming it has audio", () => {
  const [format] = normalizeFormats({
    formats: [{ format_id: "0", url: "https://test/file.mp4", ext: "mp4" }],
  });
  assert.equal(format.group, "video");
  assert.equal(format.audioUnknown, true);
  assert.equal(format.mergeAudio, false);
  assert.equal(format.hasAudio, false);
});
test("media selections are validated against a recent analysis, not arbitrary renderer commands", async () => {
  const detector = new MediaDetector({
    wrapper: {
      getFormats: async () => ({
        title: "test",
        formats: [{ formatId: "140", group: "audio", ext: "m4a" }],
      }),
      availability: async () => ({ ytdlp: true, ffmpeg: true }),
    },
  });
  const result = await detector.getFormats("https://example.test/media");
  assert.equal(
    detector.selection({ analysisId: result.analysisId, formatId: "140" }).media
      .audioOnly,
    true,
  );
  assert.throws(
    () =>
      detector.selection({ analysisId: result.analysisId, formatId: "--exec" }),
    /available/,
  );
  assert.throws(
    () => detector.selection({ analysisId: "missing", formatId: "140" }),
    /expired/,
  );
});
test("a successful tool exit without an actual file is NOT a completed download", async (t) => {
  const dir = await temporary(t);
  const engine = new MediaEngine(
    {
      id: "no-output",
      url: "https://example.test/x",
      savePath: dir,
      media: { title: "test", formatId: "140" },
      timeout: 30000,
    },
    { download: async () => {} },
  );
  let error;
  engine.on("error", (_id, e) => {
    error = e;
  });
  await engine.start();
  assert.equal(engine.status, "failed");
  assert.match(error.message, /output file/);
});
const { mediaFixture } = require("./media-fixture");
for (const page of ["watch.html", "listen.html", "adaptive.mpd"]) {
  test(
    `REAL yt-dlp / FFmpeg: extracts and downloads ${page}${page === "adaptive.mpd" ? " with audio merging" : ""}`,
    { timeout: 45000 },
    async (t) => {
      const fixture = await mediaFixture(t);
      if (!fixture) return;
      const { wrapper, server, dir } = fixture;
      const info = await wrapper.getFormats(`${server.url}/${page}`);
      assert.ok(info.formats.length > 0, JSON.stringify(info));
      const format = info.formats.find((f) =>
        page === "listen.html"
          ? f.group === "audio"
          : page === "adaptive.mpd"
            ? f.mergeAudio
            : f.group === "video",
      );
      assert.ok(format, JSON.stringify(info.formats));
      const engine = new MediaEngine(
        {
          id: `real-${page}`,
          url: `${server.url}/${page}`,
          savePath: path.join(dir, "out"),
          media: {
            title: "Integration media",
            formatId: format.formatId,
            mergeAudio: format.mergeAudio,
          },
          timeout: 30000,
        },
        wrapper,
      );
      const progress = [];
      let failure, completed;
      engine.on("progress", (_id, p) => progress.push(p));
      engine.on("complete", (_id, d) => {
        completed = d;
      });
      engine.on("error", (_id, e) => {
        failure = e;
      });
      await engine.start();
      assert.equal(failure, undefined, failure?.message);
      assert.equal(engine.status, "completed");
      assert.ok(completed.totalSize > 0);
      assert.equal(
        completed.approximateSize,
        false,
        "actual output stat is not an estimated network total",
      );
      assert.ok(progress.some((p) => p.downloadedSize > 0));
      const streams = JSON.parse(
        execFileSync(
          ffprobe,
          ["-v", "error", "-show_streams", "-of", "json", completed.filePath],
          { encoding: "utf8" },
        ),
      ).streams;
      if (page === "listen.html")
        assert.ok(streams.every((s) => s.codec_type !== "video"));
      else {
        assert.ok(streams.some((s) => s.codec_type === "video"));
        assert.ok(streams.some((s) => s.codec_type === "audio"));
      }
    },
  );
}

test("adaptive progress never reports the first stream as the entire download", async (t) => {
  const dir = await temporary(t);
  const output = path.join(dir, "Adaptive [progress].mp4");
  let first;
  const wrapper = {
    async download({ onProgress, onFile }) {
      onProgress({
        filename: "video.mp4",
        downloaded_bytes: 100,
        total_bytes_estimate: 100,
        status: "finished",
      });
      first = events.at(-1);
      onProgress({
        filename: "audio.m4a",
        downloaded_bytes: 20,
        total_bytes: 30,
        status: "downloading",
      });
      await fs.writeFile(output, Buffer.from("actual fixture bytes"));
      onFile(output);
    },
  };
  const engine = new MediaEngine(
      {
        id: "progress",
        url: "https://example.com/watch",
        savePath: dir,
        media: { title: "Adaptive", formatId: "v1", mergeAudio: true },
        timeout: 30000,
      },
      wrapper,
    ),
    events = [];
  engine.on("progress", (_id, event) => events.push(event));
  engine.on("error", (_id, error) => {
    throw error;
  });
  await engine.start();
  assert.equal(first.totalSize, 0);
  assert.notEqual(first.phase, "Finalizing media");
  assert.equal(events[1].totalSize, 130);
  assert.equal(events[1].downloadedSize, 120);
  assert.equal(
    events[1].approximateSize,
    true,
    "one estimated track makes the combined total an estimate",
  );
});

test("an explicitly silent video remains downloadable without requiring a nonexistent audio stream", () => {
  const [format] = normalizeFormats({
    formats: [
      {
        format_id: "silent",
        url: "https://example.test/silent.mp4",
        ext: "mp4",
        vcodec: "avc1",
        acodec: "none",
      },
    ],
  });
  assert.equal(format.hasVideo, true);
  assert.equal(format.hasAudio, false);
  assert.equal(format.audioUnknown, false);
  assert.equal(format.mergeAudio, false);
});
