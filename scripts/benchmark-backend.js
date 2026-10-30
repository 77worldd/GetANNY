// Repeatable source-backend comparison. This is NOT an installed-Electron benchmark.
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { performance } = require("node:perf_hooks");

const args = Object.fromEntries(
  process.argv.slice(2).map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  }),
);
const total = Number(args.bytes || 128 * 1024 ** 2);
const block = Buffer.alloc(1024 ** 2);
for (let index = 0; index < block.length; index++) block[index] = index % 251;

async function payloadServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, range: req.headers.range });
    let start = 0;
    let end = total - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!match) {
        res.writeHead(416).end();
        return;
      }
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), end) : end;
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
    }
    res.setHeader("ETag", '"benchmark-v1"');
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="benchmark.bin"',
    );
    res.setHeader("Content-Length", end - start + 1);
    if (req.method === "HEAD") return res.end();
    let offset = start;
    const write = () => {
      while (!res.destroyed && offset <= end) {
        const from = offset % block.length;
        const length = Math.min(block.length - from, end - offset + 1);
        offset += length;
        if (!res.write(block.subarray(from, from + length))) {
          res.once("drain", write);
          return;
        }
      }
      if (!res.destroyed) res.end();
    };
    write();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    server,
    requests,
    url: `http://127.0.0.1:${server.address().port}/benchmark.bin`,
  };
}

async function measure(source) {
  const { createServices } = require(path.join(source, "src/main/services.js"));
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "getanny-benchmark-measure-"),
  );
  const { server, requests, url } = await payloadServer();
  let services;
  let sampler;
  try {
    services = await createServices({
      userDataPath: path.join(root, "profile"),
      downloadPath: path.join(root, "downloads"),
      binPath: path.resolve("bin"),
      extensionPath: path.resolve("dist-extension"),
      port: 0,
    });
    await services.settings.set("maxConnectionsPerDownload", 4);
    await services.settings.set("speedLimit", 0);
    await services.settings.set("confirmBrowserDownloads", false);
    let saves = 0;
    let progressEvents = 0;
    const save = services.downloadsRepo.save.bind(services.downloadsRepo);
    services.downloadsRepo.save = (...values) => {
      saves++;
      return save(...values);
    };
    services.manager.on("progress", () => progressEvents++);
    let peakRss = process.memoryUsage().rss;
    sampler = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 5);
    const started = performance.now();
    const cpuStart = process.cpuUsage();
    const completed = new Promise((resolve, reject) => {
      services.manager.on("complete", (value) => resolve(value));
      services.manager.on("download-error", (value) =>
        reject(new Error(value.error)),
      );
    });
    const id = await services.manager.addDownload({
      url,
      filename: "benchmark.bin",
    });
    await completed;
    const elapsedMs = performance.now() - started;
    const cpu = process.cpuUsage(cpuStart);
    clearInterval(sampler);
    sampler = null;
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    const item = services.manager.requireItem(id);
    if (item.status !== "completed")
      throw new Error(item.error || "Benchmark transfer failed");
    const hash = createHash("sha256");
    for await (const chunk of fsSync.createReadStream(item.filePath))
      hash.update(chunk);
    const expected = createHash("sha256");
    for (let offset = 0; offset < total; offset += block.length)
      expected.update(
        block.subarray(0, Math.min(block.length, total - offset)),
      );
    const actualSha256 = hash.digest("hex");
    if (actualSha256 !== expected.digest("hex"))
      throw new Error("Benchmark hash mismatch");
    if (global.gc) for (let index = 0; index < 4; index++) global.gc();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const idleRss = process.memoryUsage().rss;
    const idleCpuStart = process.cpuUsage();
    const idleStarted = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const idleCpu = process.cpuUsage(idleCpuStart);
    const idleElapsedMs = performance.now() - idleStarted;
    const browserCpuStart = process.cpuUsage();
    const browserStarted = performance.now();
    for (let index = 0; index < 10; index++) await services.browserStatus();
    const browserStatusMs = performance.now() - browserStarted;
    const browserCpu = process.cpuUsage(browserCpuStart);
    return {
      bytes: total,
      elapsedMs,
      throughputMiBps: total / 1024 ** 2 / (elapsedMs / 1000),
      cpuMs: (cpu.user + cpu.system) / 1000,
      peakRss,
      idleRss,
      idleCpuPercent:
        ((idleCpu.user + idleCpu.system) / 1000 / idleElapsedMs) * 100,
      progressEvents,
      saves,
      requests: requests.length,
      browserStatusMs,
      browserStatusCpuMs: (browserCpu.user + browserCpu.system) / 1000,
      sha256: actualSha256,
    };
  } finally {
    if (sampler) clearInterval(sampler);
    await services?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const summary = (runs) =>
  Object.fromEntries(
    Object.keys(runs[0]).map((key) => [
      key,
      typeof runs[0][key] === "number"
        ? median(runs.map((run) => run[key]))
        : runs[0][key],
    ]),
  );

async function compare() {
  const commit = args.compare;
  if (!commit)
    throw new Error(
      "Use --compare=<original-commit> [--runs=3] [--output=file]",
    );
  const runs = Math.max(1, Math.min(7, Number(args.runs || 3)));
  const temp = await fs.mkdtemp(
    path.join(os.tmpdir(), "getanny-benchmark-source-"),
  );
  const archive = path.join(temp, "source.tar");
  const baseline = path.join(temp, "baseline");
  await fs.mkdir(baseline);
  try {
    execFileSync("git", ["archive", commit, "-o", archive], {
      stdio: "ignore",
    });
    execFileSync("tar", ["-xf", archive, "-C", baseline], { stdio: "ignore" });
    const results = { baseline: [], current: [] };
    for (let index = 0; index < runs; index++) {
      const order =
        index % 2
          ? [
              ["current", process.cwd()],
              ["baseline", baseline],
            ]
          : [
              ["baseline", baseline],
              ["current", process.cwd()],
            ];
      for (const [label, source] of order) {
        const result = await new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--expose-gc",
              __filename,
              "--measure",
              `--source=${source}`,
              `--bytes=${total}`,
            ],
            {
              cwd: process.cwd(),
              env: {
                ...process.env,
                NODE_PATH: [path.resolve("node_modules"), process.env.NODE_PATH]
                  .filter(Boolean)
                  .join(path.delimiter),
              },
              stdio: ["ignore", "pipe", "inherit"],
            },
          );
          let stdout = "";
          child.stdout.on("data", (chunk) => (stdout += chunk));
          child.once("error", reject);
          child.once("exit", (code) => {
            if (code !== 0)
              return reject(new Error(`${label} benchmark exited ${code}`));
            const line = stdout
              .trim()
              .split("\n")
              .find((value) => value.startsWith("GETANNY_BENCHMARK:"));
            if (!line)
              return reject(
                new Error(`Missing ${label} benchmark result: ${stdout}`),
              );
            resolve(JSON.parse(line.slice("GETANNY_BENCHMARK:".length)));
          });
        });
        results[label].push(result);
        console.log(
          `${label} run ${index + 1}: ${result.throughputMiBps.toFixed(1)} MiB/s, peak ${(result.peakRss / 1024 ** 2).toFixed(1)} MiB`,
        );
      }
    }
    const baselineSummary = summary(results.baseline);
    const currentSummary = summary(results.current);
    const ratio = (key) => currentSummary[key] / baselineSummary[key];
    const report = {
      date: new Date().toISOString(),
      scope:
        "Fresh-process local source-backend benchmark. Includes the local HTTP server in process CPU/RSS. Not installed Electron, public-network, Windows installer, or whole-desktop idle evidence.",
      platform: process.platform,
      node: process.versions.node,
      baselineCommit: commit,
      currentCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      worktreeDirty: !!execFileSync("git", ["status", "--porcelain"], {
        encoding: "utf8",
      }).trim(),
      bytesPerRun: total,
      runs,
      baseline: baselineSummary,
      current: currentSummary,
      ratios: {
        throughput: ratio("throughputMiBps"),
        transferCpu: ratio("cpuMs"),
        peakRss: ratio("peakRss"),
        idleRss: ratio("idleRss"),
        idleCpu: ratio("idleCpuPercent"),
        progressEvents: ratio("progressEvents"),
        persistenceSaves: ratio("saves"),
        browserStatusMs: ratio("browserStatusMs"),
        browserStatusCpu: ratio("browserStatusCpuMs"),
      },
      raw: results,
    };
    const output = path.resolve(args.output || ".arena/backend-benchmark.json");
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

if (args.measure) {
  measure(path.resolve(args.source || process.cwd())).then(
    (result) => console.log(`GETANNY_BENCHMARK:${JSON.stringify(result)}`),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
} else {
  compare().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
