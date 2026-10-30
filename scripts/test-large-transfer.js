// Optional real >3 GiB source-engine integration test. Needs ~7 GiB free disk.
// Not a simulated transfer or an installed-desktop certification.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createHash } = require("node:crypto");
const { createServices } = require("../src/main/services");
const { waitFor } = require("../tests/helpers");
(async () => {
  const total = 3 * 1024 ** 3 + 12345,
    block = Buffer.alloc(1024 ** 2);
  for (let i = 0; i < block.length; i++) block[i] = i % 251;
  const expectedHasher = createHash("sha256");
  for (let offset = 0; offset < total; offset += block.length)
    expectedHasher.update(
      block.subarray(0, Math.min(block.length, total - offset)),
    );
  const expected = expectedHasher.digest("hex"),
    requests = [],
    finalizing = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, range: req.headers.range });
    res.setHeader("ETag", '"getanny-large-v1"');
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "application/octet-stream");
    let start = 0,
      end = total - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match) {
        res.writeHead(416);
        res.end();
        return;
      }
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    }
    res.setHeader("Content-Length", end - start + 1);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    let offset = start;
    const send = () => {
      while (!res.destroyed && offset <= end) {
        const from = offset % block.length,
          length = Math.min(block.length - from, end - offset + 1);
        offset += length;
        if (!res.write(block.subarray(from, from + length))) {
          res.once("drain", send);
          return;
        }
      }
      if (!res.destroyed) res.end();
    };
    send();
  });
  const folder = await fs.mkdtemp(
    path.join(os.tmpdir(), "getanny-large-check-"),
  );
  let s, id;
  const started = Date.now();
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const options = {
      userDataPath: path.join(folder, "profile"),
      downloadPath: path.join(folder, "downloads"),
      binPath: path.resolve("bin"),
      port: 0,
    };
    s = await createServices(options);
    await s.settings.set("maxConnectionsPerDownload", 4);
    await s.settings.set("speedLimit", 64 * 1024 ** 2);
    id = await s.manager.addDownload({
      url: `http://127.0.0.1:${server.address().port}/large.bin`,
      filename: "large.bin",
    });
    await waitFor(
      () => s.manager.requireItem(id).downloadedSize >= 32 * 1024 ** 2,
      30000,
      "physical large-transfer progress",
    );
    await s.manager.pause(id);
    const paused = { ...s.manager.requireItem(id) };
    const files = (await fs.readdir(paused.savePath)).filter((name) =>
      name.startsWith(`.getanny-${id}.part-`),
    );
    const partBytes = await Promise.all(
      files.map(
        async (file) => (await fs.stat(path.join(paused.savePath, file))).size,
      ),
    );
    const physicalPartial = partBytes.reduce((a, b) => a + b, 0);
    assert.equal(files.length, 4);
    assert.ok(partBytes.every((size) => size > 0));
    assert.equal(paused.status, "paused");
    console.log(
      JSON.stringify({
        phase: "paused",
        displayedBytes: paused.downloadedSize,
        physicalPartial,
        partBytes,
      }),
    );
    assert.equal(
      paused.downloadedSize,
      physicalPartial,
      "settled paused snapshot must report exact physical segment bytes, not stale ticker bytes",
    );
    const firstRange = requests.find(
      (request) =>
        request.range?.startsWith("bytes=0-") && request.range !== "bytes=0-0",
    ).range;
    await s.close();
    s = await createServices(options);
    assert.equal(s.manager.requireItem(id).status, "paused");
    await s.settings.set("speedLimit", 0);
    s.events.on("event", (channel, data) => {
      if (
        channel === "download:status" &&
        data.id === id &&
        data.status === "processing"
      )
        finalizing.push(data);
    });
    const resumeIndex = requests.length;
    assert.ok(s.manager.resume(id));
    await waitFor(
      () => ["completed", "failed"].includes(s.manager.requireItem(id).status),
      120000,
      "large resumed output",
    );
    const item = s.manager.requireItem(id);
    assert.equal(item.status, "completed", item.error);
    const actualHasher = createHash("sha256");
    for await (const chunk of createReadStream(item.filePath))
      actualHasher.update(chunk);
    const actual = actualHasher.digest("hex");
    assert.equal(actual, expected);
    assert.equal((await fs.stat(item.filePath)).size, total);
    assert.equal(item.downloadedSize, total);
    assert.equal(item.speed, 0);
    assert.equal(item.eta, null);
    const end = firstRange.split("-")[1];
    assert.ok(
      requests
        .slice(resumeIndex)
        .some(
          (request) =>
            request.range &&
            new RegExp(`^bytes=[1-9]\\d*-${end}$`).test(request.range),
        ),
      "resume must continue inside the ORIGINAL first segment, not just start another nonzero segment",
    );
    assert.equal(finalizing.length, 1);
    assert.equal(finalizing[0].downloadedSize, total);
    assert.equal(finalizing[0].speed, 0);
    assert.equal(finalizing[0].eta, null);
    const report = {
      passed: true,
      date: new Date().toISOString(),
      source: require("node:child_process")
        .execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })
        .trim(),
      platform: process.platform,
      node: process.versions.node,
      bytes: total,
      sha256: actual,
      seconds: (Date.now() - started) / 1000,
      connections: 4,
      pausedBytes: paused.downloadedSize,
      physicalPausedBytes: physicalPartial,
      partBytes,
      backendClosedAndReopened: true,
      postResumeRequests: requests.slice(resumeIndex),
      finalizing: {
        bytes: finalizing[0].downloadedSize,
        speed: finalizing[0].speed,
        eta: finalizing[0].eta,
      },
      scope:
        "Real local HTTP >3GiB with uneven ranges, physical pause, SQLite/backend restart, proven same-segment Range continuation, SHA-256, stat and processing snapshot. Source-engine test, not installed desktop or public-internet evidence.",
    };
    report.worktreeDirty = !!require("node:child_process")
      .execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
      .trim();
    const reportFile = process.argv[2] || ".arena/large-http-report.json";
    await fs.mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await s?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(folder, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
