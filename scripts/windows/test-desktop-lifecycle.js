// Windows CI only: the ACTUAL default profile, compiled native EXE cold launch,
// real downloaded bytes, real .lnk launches, and graceful native window closing.
// This is not a browser-brand/store certification and does not modify profiles.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const Database = require("better-sqlite3");
const { CHROMIUM_ID } = require("../../src/main/browser-integration/catalog");
const { fixtureServer, waitFor, checksum } = require("../../tests/helpers");
const exec = promisify(execFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (text) => "'" + String(text).replaceAll("'", "''") + "'";
async function bridgeOnline(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}
async function windows(executable, close = false) {
  // Restrict to visible top-level windows of this exact installed executable.
  // Never terminate other applications or a user's unrelated installation.
  const command = `$ErrorActionPreference='Stop'; $found=@(Get-Process -Name GetANNY -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -ieq ${quote(executable)} }); ${close ? "foreach($p in $found){if(-not $p.CloseMainWindow()){throw 'Cannot close actual test window'}};" : ""} ConvertTo-Json -InputObject @($found | ForEach-Object { $_.Id }) -Compress`;
  const { stdout } = await exec(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    { timeout: 15000 },
  );
  return JSON.parse(stdout.trim() || "[]");
}
async function run() {
  if (
    process.platform !== "win32" ||
    !process.env.RUNNER_TEMP ||
    process.env.CI !== "true"
  )
    throw new Error(
      "Desktop lifecycle harness requires a disposable Windows CI account.",
    );
  const [executable, data, report, ...shortcuts] = process.argv.slice(2);
  const checks = [],
    cleanups = [];
  let native, db;
  const t = { after: (fn) => cleanups.push(fn) };
  const closeWindow = async () => {
    const pids = await windows(executable);
    assert.equal(pids.length, 1, "exactly one real desktop window");
    await windows(executable, true);
    await waitFor(
      async () => !(await bridgeOnline(29615)),
      20000,
      "graceful default desktop bridge shutdown",
    );
    await waitFor(
      async () => (await windows(executable)).length === 0,
      20000,
      "actual window process exit",
    );
  };
  try {
    assert.equal(
      await bridgeOnline(29615),
      false,
      "cold launch must begin with no desktop bridge",
    );
    assert.deepEqual(
      await windows(executable),
      [],
      "cold launch must begin with no desktop window",
    );
    const base = path.join(data, "native-messaging");
    const config = JSON.parse(
      await fs.readFile(path.join(base, "bridge-config.json"), "utf8"),
    );
    assert.equal(config.appPath.toLowerCase(), executable.toLowerCase());
    assert.equal(config.port, 29615);
    db = new Database(path.join(data, "getanny.db"), {
      readonly: true,
      fileMustExist: true,
    });
    const fixture = await fixtureServer(t, { size: 1024 * 1024 });
    native = spawn(path.join(base, "GetANNY.NativeHost.exe"), [], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let buffer = Buffer.alloc(0),
      spawnError;
    const messages = [];
    native.on("error", (error) => {
      spawnError = error;
    });
    native.stdin.on("error", (error) => {
      spawnError = error;
    });
    native.stderr.resume();
    native.stdout.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (!length || length > 1024 * 1024) {
          spawnError = new Error("Invalid native output frame length");
          return;
        }
        if (buffer.length < 4 + length) return;
        try {
          messages.push(JSON.parse(buffer.subarray(4, 4 + length)));
        } catch {
          spawnError = new Error("Invalid native output JSON");
        }
        buffer = buffer.subarray(4 + length);
      }
    });
    const send = (message) => {
      const body = Buffer.from(JSON.stringify(message)),
        header = Buffer.alloc(4);
      header.writeUInt32LE(body.length);
      native.stdin.write(Buffer.concat([header, body]));
    };
    send({
      type: "hello",
      requestId: "cold-hello",
      browserId: "chromium",
      extensionId: CHROMIUM_ID,
      version: "installed-lifecycle-diagnostic",
    });
    await waitFor(
      () => {
        if (spawnError) throw spawnError;
        return messages.some(
          (message) => message.type === "hello-result" && message.success,
        );
      },
      45000,
      "compiled native host cold desktop launch and handshake",
    );
    await waitFor(
      async () => (await windows(executable)).length === 1,
      20000,
      "cold-launched actual desktop window",
    );
    send({
      type: "download",
      requestId: "cold-file",
      url: fixture.url + "/file.bin",
      filename: "cold-native-test.bin",
    });
    await waitFor(
      () => messages.some((message) => message.requestId === "cold-file"),
      15000,
      "cold native download acknowledgement",
    );
    const response = messages.find(
      (message) => message.requestId === "cold-file",
    );
    assert.equal(response.success, true, response.error);
    assert.ok(response.id);
    let item;
    await waitFor(
      () => {
        item = db
          .prepare("SELECT * FROM downloads WHERE id=?")
          .get(response.id);
        if (item?.status === "failed")
          throw new Error("Cold native download failed: " + item.error);
        return item?.status === "completed";
      },
      20000,
      "cold-launched managed download completion",
    );
    const metadata = JSON.parse(item.metadata || "{}"),
      output = metadata.filePath || path.join(item.savePath, item.filename);
    const sha256 = checksum(await fs.readFile(output));
    assert.equal(sha256, checksum(fixture.state.data));
    checks.push({
      name: "Compiled native EXE cold-launches installed Electron and downloads hash-verified physical bytes",
      passed: true,
      bytes: fixture.state.data.length,
      sha256,
    });
    await closeWindow();
    await delay(3500);
    assert.equal(
      await bridgeOnline(29615),
      false,
      "existing native host must not reopen a closed desktop",
    );
    assert.deepEqual(await windows(executable), []);
    checks.push({
      name: "Existing native host respects real desktop window close without resurrection",
      passed: true,
    });
    native.stdin.end();
    await waitFor(
      () => native.exitCode !== null,
      10000,
      "compiled host EOF shutdown",
    );
    assert.equal(native.exitCode, 0);
    native = null;
    assert.equal(
      shortcuts.length,
      2,
      "one actual desktop and one Start Menu shortcut required",
    );
    for (const link of shortcuts) {
      assert.equal(await bridgeOnline(29615), false);
      await exec(
        "powershell.exe",
        ["-NoProfile", "-Command", `Start-Process -FilePath ${quote(link)}`],
        { timeout: 15000 },
      );
      await waitFor(
        async () => await bridgeOnline(29615),
        30000,
        "real shell shortcut desktop launch",
      );
      await waitFor(
        async () => (await windows(executable)).length === 1,
        20000,
        "shortcut-launched actual installed window",
      );
      await closeWindow();
      checks.push({
        name: "Actual shell shortcut launches the installed desktop and closes gracefully",
        passed: true,
        shortcut: link,
      });
    }
    await fs.writeFile(
      report,
      JSON.stringify(
        {
          passed: true,
          date: new Date().toISOString(),
          checks,
          limitations: [
            "Disposable Windows runner, not pristine consumer installation.",
            "Compiled native cold launch is tested directly, not separately from every browser brand.",
            "Window closing uses the persisted closeToTray=false diagnostic preference.",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await fs.writeFile(
      report,
      JSON.stringify(
        {
          passed: false,
          date: new Date().toISOString(),
          checks,
          error: error.stack,
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    native?.stdin.end();
    if (native && native.exitCode === null) await delay(200);
    if (native && native.exitCode === null) native.kill();
    await windows(executable, true).catch(() => {});
    db?.close();
    for (const cleanup of cleanups.reverse()) await cleanup();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
