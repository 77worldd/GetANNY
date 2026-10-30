const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { NativeMessagingHost } = require("./NativeMessagingHost");
test("native host uses a real executable launcher and standard manifest fields, not unsupported args", async (t) => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "getanny-host-manifest-"),
  );
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const host = new NativeMessagingHost({
    userDataPath: dir,
    home: dir,
    platform: "linux",
    appPath: process.execPath,
    token: "a".repeat(64),
    isPackaged: false,
  });
  const result = await host.register("chrome");
  const manifest = JSON.parse(await fs.readFile(result.path, "utf8"));
  assert.ok(manifest.path.endsWith("getanny-native-host"));
  assert.equal(manifest.args, undefined);
  assert.deepEqual(manifest.allowed_origins, [
    "chrome-extension://oocncjjghijimkajhmdjcgdffkfojpbg/",
  ]);
  assert.match(await fs.readFile(manifest.path, "utf8"), /--config/);
  assert.equal((await host.check("chrome")).registered, true);
  const firefox = await host.register("firefox");
  const fm = JSON.parse(await fs.readFile(firefox.path, "utf8"));
  assert.deepEqual(fm.allowed_extensions, ["getanny@getanny.app"]);
  assert.equal(fm.allowed_origins, undefined);
  await host.unregisterAll();
  assert.equal((await host.check("chrome")).registered, false);
});
