const test = require("node:test");
const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");
const path = require("node:path");
const fs = require("node:fs/promises");
const { Database } = require("../src/main/database/database");
const { DownloadsRepo } = require("../src/main/database/downloads-repo");
const { createServices } = require("../src/main/services");
const {
  WebSocketServer,
} = require("../src/main/browser-integration/WebSocketServer");
const { CHROMIUM_ID } = require("../src/main/browser-integration/catalog");
const { temporary, waitFor } = require("./helpers");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test(
  "native lifecycle: desktop quit is respected, cold launch is one-shot, and browser EOF cancels launch",
  { timeout: 15000 },
  async (t) => {
    // A process-spawn spy tests launch intent only. This does NOT substitute for
    // the separate actual compiled C# / installed Electron integration gates.
    const launched = t.mock.method(
      require("node:child_process"),
      "spawn",
      () => ({
        on() {
          return this;
        },
        unref() {},
      }),
    );
    const {
      runNativeHost,
    } = require("../src/main/browser-integration/native-host");
    const bridge = new WebSocketServer({ port: 0, token: "c".repeat(64) });
    await new Promise((resolve, reject) => {
      bridge.server.once("listening", resolve);
      bridge.server.once("error", reject);
    });
    const port = bridge.status().port;
    t.after(() => (bridge.server.address() ? bridge.close() : undefined));
    const makeHost = () => {
      const input = new PassThrough(),
        output = new PassThrough(),
        messages = [];
      let bytes = Buffer.alloc(0);
      output.on("data", (chunk) => {
        bytes = Buffer.concat([bytes, chunk]);
        while (bytes.length >= 4 && bytes.length >= 4 + bytes.readUInt32LE(0)) {
          const length = bytes.readUInt32LE(0);
          messages.push(JSON.parse(bytes.subarray(4, 4 + length)));
          bytes = bytes.subarray(4 + length);
        }
      });
      const host = runNativeHost({
        config: {
          port,
          token: "c".repeat(64),
          appPath: "unit-test-application-only",
        },
        input,
        output,
        exit: () => {},
      });
      t.after(() => host.close());
      return { host, input, messages };
    };
    const connected = makeHost();
    const hello = Buffer.from(
      JSON.stringify({
        type: "hello",
        browserId: "chromium",
        extensionId: CHROMIUM_ID,
        version: "test",
      }),
    );
    const header = Buffer.alloc(4);
    header.writeUInt32LE(hello.length);
    connected.input.write(Buffer.concat([header, hello]));
    await waitFor(() =>
      connected.messages.some(
        (message) => message.type === "hello-result" && message.success,
      ),
    );
    await bridge.close();
    await waitFor(() =>
      connected.messages.some((message) => message.type === "transport-error"),
    );
    await delay(1700);
    assert.equal(
      launched.mock.calls.length,
      0,
      "an explicitly closed desktop must not be auto-relaunched",
    );
    connected.host.close();

    const cold = makeHost();
    await waitFor(() => launched.mock.calls.length === 1, 4000, "cold launch");
    assert.deepEqual(launched.mock.calls[0].arguments.slice(0, 2), [
      "unit-test-application-only",
      ["--from-browser"],
    ]);
    assert.equal(
      launched.mock.calls[0].arguments[2].env.ELECTRON_RUN_AS_NODE,
      undefined,
    );
    await delay(1700);
    assert.equal(
      launched.mock.calls.length,
      1,
      "offline retries must not spawn multiple desktops",
    );
    cold.host.close();

    const exited = makeHost();
    await waitFor(() =>
      exited.messages.some((message) => message.type === "transport-error"),
    );
    exited.input.end();
    await delay(1700);
    assert.equal(
      launched.mock.calls.length,
      1,
      "closing a browser must cancel a pending cold launch",
    );
  },
);

test("registration-only startup never restores, pauses, starts or rewrites persisted download history", async (t) => {
  const folder = await temporary(t);
  const db = new Database(folder);
  await db.initialize();
  const repo = new DownloadsRepo(db);
  repo.save({
    id: "interrupted-job",
    url: "https://example.test/pending",
    filename: "pending.bin",
    savePath: folder,
    status: "downloading",
    downloadedSize: 200,
    totalSize: 1000,
    speed: 12,
  });
  const before = repo.getAll();
  db.close();
  const services = await createServices({
    userDataPath: folder,
    downloadPath: folder,
    binPath: path.resolve("bin"),
    extensionPath: path.resolve("dist-extension"),
    port: 0,
    startTransfers: false,
  });
  try {
    assert.equal(services.manager.items.size, 0);
    assert.deepEqual(services.downloadsRepo.getAll(), before);
  } finally {
    await services.close();
  }
  const reopened = new Database(folder);
  await reopened.initialize();
  try {
    assert.deepEqual(new DownloadsRepo(reopened).getAll(), before);
  } finally {
    reopened.close();
  }
});

test("read-only default-profile snapshots detect actual history/settings loss without printing private records", async (t) => {
  const folder = await temporary(t),
    db = new Database(folder);
  await db.initialize();
  const repo = new DownloadsRepo(db);
  const output = path.join(folder, "retained.bin");
  await fs.writeFile(output, "retained bytes");
  repo.save({
    id: "retained",
    url: "https://private.example.test/file",
    filename: "retained.bin",
    savePath: folder,
    status: "completed",
  });
  db.close();
  const { snapshot } = require("../scripts/windows/snapshot-profile");
  const before = snapshot(path.join(folder, "getanny.db"));
  assert.equal(before.history, 1);
  assert.equal(before.missingCompletedFiles, 0);
  assert.match(before.sha256, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(before).includes("private.example"));
  assert.deepEqual(snapshot(path.join(folder, "getanny.db")), before);
  await fs.rm(output);
  assert.equal(
    snapshot(path.join(folder, "getanny.db")).missingCompletedFiles,
    1,
  );
  const reopened = new Database(folder);
  await reopened.initialize();
  try {
    new DownloadsRepo(reopened).remove("retained");
  } finally {
    reopened.close();
  }
  assert.notEqual(
    snapshot(path.join(folder, "getanny.db")).sha256,
    before.sha256,
  );
});
