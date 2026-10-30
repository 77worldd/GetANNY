const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { ChunkDownloader } = require("./ChunkDownloader");
test("chunk downloader assembles verified ranges with exact finalization bytes before publishing completion", async (t) => {
  const data = Buffer.alloc(3 * 1024 * 1024);
  for (let i = 0; i < data.length; i++) data[i] = i % 251;
  const server = http.createServer((req, res) => {
    res.setHeader("Accept-Ranges", "bytes");
    if (req.method === "HEAD") {
      res.setHeader("Content-Length", data.length);
      res.end();
      return;
    }
    const range = req.headers.range?.match(/bytes=(\d+)-(\d+)/);
    if (range) {
      const start = +range[1],
        end = Math.min(+range[2], data.length - 1);
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": end - start + 1,
      });
      res.end(data.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "Content-Length": data.length });
    res.end(data);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getanny-chunks-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const id = "chunk-test";
  const downloader = new ChunkDownloader({
    id,
    url: `http://127.0.0.1:${server.address().port}/large.bin`,
    savePath: dir,
    connections: 3,
  });
  const finalizing = [];
  downloader.on("status", (_id, status, data) => {
    if (status === "processing")
      finalizing.push({
        data,
        published: require("node:fs").existsSync(path.join(dir, "large.bin")),
      });
  });
  const complete = new Promise((resolve, reject) => {
    downloader.once("complete", (_id, result) => resolve(result));
    downloader.once("error", (_id, error) => reject(error));
  });
  await downloader.start();
  const result = await complete;
  assert.equal(result.filename, "large.bin");
  assert.equal(finalizing.length, 1);
  assert.equal(
    finalizing[0].data.downloadedSize,
    data.length,
    "verified segment bytes must not remain at the last 400ms progress tick",
  );
  assert.equal(finalizing[0].data.totalSize, data.length);
  assert.equal(finalizing[0].data.speed, 0);
  assert.equal(finalizing[0].data.eta, null);
  assert.equal(
    finalizing[0].published,
    false,
    "100% network bytes is still processing, not a completed output",
  );
  assert.deepEqual(await fs.readFile(path.join(dir, "large.bin")), data);
});
