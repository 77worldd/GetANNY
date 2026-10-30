const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { temporary } = require("./helpers");
const exec = promisify(execFile);

test("CI evidence aggregation retains every fixture report within annotation limits and omits private detail", async (t) => {
  // Reporter unit fixtures, NOT browser/download execution evidence.
  const root = await temporary(t);
  const canary = "private-record-must-never-be-annotated";
  const write = async (file, data) => {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(data));
  };
  for (let i = 0; i < 6; i++)
    await write(`installed-${i}.json`, {
      passed: true,
      platform: "win32",
      packaged: true,
      token: canary,
      date: "2026-10-30T00:00:00.000Z",
      version: "unit-fixture",
      electron: "unit-fixture",
      checks: Array.from({ length: 14 }, (_, index) => ({
        name: `Realistically sized reporter unit fixture definition ${index}`,
        passed: true,
        detail: { url: canary, settings: canary },
      })),
    });
  const browsers = [
    "helium",
    "chrome",
    "chromium",
    "brave",
    "firefox",
    "vivaldi",
    "opera",
  ];
  for (const browser of browsers)
    await write(`browser-matrix/${browser}/browser-report.json`, {
      passed: true,
      browser,
      browserVersion: "unit-fixture",
      token: canary,
      transport:
        "Native Messaging → C# executable → Electron Node → authenticated WebSocket → installed Electron → SQLite/download engine",
      checks: Array.from(
        { length: 5 },
        (_, index) => `Reporter unit fixture ${index}`,
      ),
    });
  await write(
    "browser-matrix/matrix.json",
    browsers.map((browser) => ({ browser, status: "fixture", token: canary })),
  );
  await write("installer-report.json", {
    passed: true,
    defaultProfileRetention: { exe: { history: 1, retained: true } },
    token: canary,
  });
  const { stdout } = await exec(process.execPath, [
    path.resolve("scripts/report-windows-evidence.js"),
    root,
  ]);
  const lines = stdout.trim().split("\n");
  assert.equal(lines.length, 6);
  for (const line of lines)
    assert.ok(
      Buffer.byteLength(line) < 3800,
      "each actual annotation must fit the GitHub truncation limit",
    );
  assert.ok(lines.length < 10);
  assert.ok(!stdout.includes(canary));
  const reports = lines.map((line) => JSON.parse(line.split("::").at(-1)));
  assert.equal(reports[0].length, 6);
  assert.ok(
    reports[0].every(
      (item) => item.checks.total === 14 && item.checks.passed === 14,
    ),
  );
  assert.equal(reports[2].length, 7);
  assert.deepEqual(
    reports[3].map((item) => item.browser).sort(),
    [...browsers].sort(),
  );
  assert.equal(reports[5][0].defaultProfileRetention.exe.retained, true);
});
