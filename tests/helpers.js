const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
async function temporary(t, prefix = "getanny-") {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  return folder;
}
async function waitFor(predicate, timeout = 15000, description = "condition") {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeout)
      throw new Error(`Timed out waiting for ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
function checksum(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
async function fixtureServer(
  t,
  { tls = false, size = 4 * 1024 * 1024, delay = 0, extra } = {},
) {
  const data = Buffer.alloc(size);
  for (let i = 0; i < size; i++) data[i] = i % 251;
  const state = {
    data,
    etag: '"fixture-v1"',
    requests: [],
    failures: 0,
    active: 0,
    maxActive: 0,
  };
  const handle = async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    state.requests.push({
      url: req.url,
      method: req.method,
      range: req.headers.range,
      ifRange: req.headers["if-range"],
    });
    if (extra && (await extra(req, res, url, state))) return;
    if (url.pathname === "/redirect") {
      res.writeHead(302, { Location: "/file.bin" });
      res.end();
      return;
    }
    if (url.pathname === "/missing") {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    if (url.pathname === "/flaky" && state.failures++ < 1) {
      res.writeHead(503);
      res.end("try later");
      return;
    }
    if (url.pathname === "/empty") {
      if (req.headers.range)
        res.writeHead(416, { "Content-Range": "bytes */0" });
      else res.writeHead(200, { "Content-Length": 0 });
      res.end();
      return;
    }
    if (url.pathname === "/headless" && req.method === "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const large = url.pathname === "/large";
    const length = large ? 128 * 1024 * 1024 : state.data.length;
    const unknown = url.pathname === "/unknown";
    let start = 0,
      end = length - 1;
    res.setHeader("ETag", state.etag);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="server-file.bin"',
    );
    if (unknown) {
      if (req.method === "HEAD") {
        res.end();
        return;
      }
    } else {
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", length);
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range && url.pathname !== "/ignores-range") {
        start = Number(range[1]);
        end = range[2] ? Number(range[2]) : length - 1;
        if (start >= length) {
          res.writeHead(416, { "Content-Range": `bytes */${length}` });
          res.end();
          return;
        }
        end = Math.min(end, length - 1);
        res.statusCode = 206;
        const bad =
          url.pathname === "/bad-range" && !(start === 0 && end === 0);
        res.setHeader(
          "Content-Range",
          `bytes ${bad ? start + 1 : start}-${end}/${length}`,
        );
        res.setHeader("Content-Length", end - start + 1);
      }
      if (req.method === "HEAD") {
        res.end();
        return;
      }
    }
    if (url.pathname === "/truncated" && req.headers.range !== "bytes=0-0") {
      res.setHeader("Content-Length", end - start + 1);
      res.write(state.data.subarray(start, Math.min(end + 1, start + 1024)));
      setTimeout(() => res.destroy(), 20);
      return;
    }
    state.active++;
    state.maxActive = Math.max(state.maxActive, state.active);
    let position = start,
      timer,
      stopped = false;
    res.once("close", () => {
      stopped = true;
      clearTimeout(timer);
      state.active--;
    });
    const write = () => {
      if (stopped) return;
      if (position > end) {
        res.end();
        return;
      }
      const next = Math.min(end + 1, position + 64 * 1024);
      const chunk = large
        ? Buffer.alloc(next - position, 0x23)
        : state.data.subarray(position, next);
      position = next;
      if (res.write(chunk)) timer = setTimeout(write, delay);
      else
        res.once("drain", () => {
          timer = setTimeout(write, delay);
        });
    };
    write();
  };
  let cert, key;
  if (tls) {
    const folder = await temporary(t, "getanny-tls-");
    const openssl =
      process.platform === "win32"
        ? "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"
        : "openssl";
    execFileSync(
      openssl,
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        path.join(folder, "key.pem"),
        "-out",
        path.join(folder, "cert.pem"),
        "-days",
        "1",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1",
      ],
      { stdio: "ignore" },
    );
    cert = await fs.readFile(path.join(folder, "cert.pem"));
    key = await fs.readFile(path.join(folder, "key.pem"));
  }
  const server = tls
    ? https.createServer({ key, cert }, handle)
    : http.createServer(handle);
  server.on("clientError", (_error, socket) => socket.destroy());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return {
    url: `${tls ? "https" : "http"}://127.0.0.1:${server.address().port}`,
    state,
    server,
    cert,
  };
}
module.exports = { temporary, waitFor, checksum, fixtureServer };
