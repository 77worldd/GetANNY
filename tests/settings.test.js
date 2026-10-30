const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Database } = require("../src/main/database/database");
const { SettingsRepo } = require("../src/main/database/settings-repo");
const { SettingsService } = require("../src/main/settings/SettingsService");
const { validateSetting } = require("../src/main/settings/schema");
const { DownloadsRepo } = require("../src/main/database/downloads-repo");
test("settings return validated defaults, execute behavioral hooks, persist through DB reopen and reset", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getanny-settings-"));
  let db = new Database(dir);
  await db.initialize();
  t.after(async () => {
    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const changes = [];
  let service = new SettingsService({
    repo: new SettingsRepo(db),
    downloadPath: dir,
    onChange: (k, v) => changes.push([k, v]),
  });
  assert.equal(service.get("maxConcurrentDownloads"), 3);
  await service.set("maxConcurrentDownloads", 5);
  await service.set("theme", "midnight");
  await service.set("defaultDownloadPath", path.join(dir, "new-folder"));
  assert.equal(changes.length, 3);
  await assert.rejects(service.set("maxConcurrentDownloads", 0), /between/);
  await assert.rejects(service.set("notifications", "true"), /on or off/);
  await assert.rejects(service.set("arbitraryCode", "value"), /Unknown/);
  db.close();
  db = new Database(dir);
  await db.initialize();
  service = new SettingsService({
    repo: new SettingsRepo(db),
    downloadPath: dir,
  });
  assert.equal(service.get("theme"), "midnight");
  assert.equal(service.get("maxConcurrentDownloads"), 5);
  await service.reset();
  assert.equal(service.get("maxConcurrentDownloads"), 3);
});
test("all displayed preference types reject malformed values", () => {
  for (const [key, value] of [
    ["requestTimeoutSeconds", 1],
    ["speedLimit", -1],
    ["retryAttempts", 1.5],
    ["theme", "unsupported"],
    ["defaultDownloadPath", "relative"],
    ["preferredBrowser", "unknown"],
  ])
    assert.throws(() => validateSetting(key, value));
  assert.equal(validateSetting("browserIntegrationEnabled", false), false);
});
test("v1 SQLite database is migrated without losing history or settings", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getanny-migrate-"));
  const Native = require("better-sqlite3");
  const legacy = new Native(path.join(dir, "getanny.db"));
  legacy.exec(
    `CREATE TABLE downloads(id TEXT PRIMARY KEY,url TEXT NOT NULL,filename TEXT NOT NULL,savePath TEXT NOT NULL,status TEXT NOT NULL,totalSize INTEGER DEFAULT 0,downloadedSize INTEGER DEFAULT 0,speed REAL DEFAULT 0,mimeType TEXT,category TEXT,createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL,error TEXT,headers TEXT,kind TEXT DEFAULT 'file');CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO downloads(id,url,filename,savePath,status,createdAt,updatedAt)VALUES('legacy','https://example.test/f','f','/tmp','completed','2025-01-01','2025-01-01');INSERT INTO settings VALUES('theme','"dark"')`,
  );
  legacy.close();
  const db = new Database(dir);
  await db.initialize();
  t.after(async () => {
    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const repo = new DownloadsRepo(db);
  assert.equal(repo.get("legacy").status, "completed");
  assert.equal(repo.get("legacy").filePath, path.join("/tmp", "f"));
  repo.save({
    ...repo.get("legacy"),
    filePath: path.join(dir, "f"),
    filenameExplicit: true,
  });
  assert.equal(repo.get("legacy").filenameExplicit, true);
  assert.equal(
    new SettingsService({ repo: new SettingsRepo(db), downloadPath: dir }).get(
      "theme",
    ),
    "graphite",
  );
  assert.equal(db.db.pragma("user_version", { simple: true }), 2);
});

test("animation mode validates, persists and preserves legacy reduced-motion preference", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getanny-motion-"));
  const db = new Database(dir);
  await db.initialize();
  t.after(async () => {
    db.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const repo = new SettingsRepo(db);
  repo.set("reduceMotion", true);
  let service = new SettingsService({ repo, downloadPath: dir });
  assert.equal(service.get("animationMode"), "reduced");
  await service.set("animationMode", "disabled");
  service = new SettingsService({ repo, downloadPath: dir });
  assert.equal(service.get("animationMode"), "disabled");
  await assert.rejects(service.set("animationMode", "unknown"), /supported/);
});
