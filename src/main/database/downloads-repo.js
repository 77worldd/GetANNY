const path = require("node:path");
const COLUMNS = [
  "id",
  "url",
  "filename",
  "savePath",
  "status",
  "totalSize",
  "downloadedSize",
  "speed",
  "mimeType",
  "category",
  "createdAt",
  "updatedAt",
  "error",
  "headers",
  "kind",
];
function parse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
class DownloadsRepo {
  constructor(database) {
    this.db = database.db;
    const fields = [...COLUMNS, "metadata"];
    this.upsert = this.db.prepare(
      `INSERT INTO downloads (${fields.join(",")}) VALUES (${fields.map((key) => `@${key}`).join(",")}) ON CONFLICT(id) DO UPDATE SET ${fields
        .filter((key) => !["id", "createdAt"].includes(key))
        .map((key) => `${key}=excluded.${key}`)
        .join(",")}`,
    );
    // Prepare hot-path statements once rather than on every progress/sample read.
    this.getOne = this.db.prepare("SELECT * FROM downloads WHERE id=?");
    this.all = this.db.prepare(
      "SELECT * FROM downloads ORDER BY createdAt DESC, rowid DESC",
    );
    this.deleteOne = this.db.prepare("DELETE FROM downloads WHERE id=?");
  }
  normalize(item, previous) {
    if (previous === undefined) previous = this.get(item.id);
    const data = { ...previous, ...item };
    return {
      id: data.id,
      url: data.url,
      filename: data.filename || "download",
      savePath: data.savePath || "",
      status: data.status || "queued",
      totalSize: Math.max(0, Number(data.totalSize) || 0),
      downloadedSize: Math.max(0, Number(data.downloadedSize) || 0),
      speed: Math.max(0, Number(data.speed) || 0),
      mimeType: data.mimeType || null,
      category: data.category || "Other",
      createdAt:
        previous?.createdAt || data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: data.error || null,
      headers: JSON.stringify(
        typeof data.headers === "string"
          ? parse(data.headers, {})
          : data.headers || {},
      ),
      kind: data.kind || "file",
      metadata: JSON.stringify(
        Object.fromEntries(
          Object.entries(data).filter(
            ([key, value]) =>
              !COLUMNS.includes(key) &&
              key !== "metadata" &&
              value !== undefined,
          ),
        ),
      ),
    };
  }
  decode(row) {
    if (!row) return null;
    const item = {
      ...parse(row.metadata, {}),
      ...Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "metadata"),
      ),
      headers: parse(row.headers, {}),
    };
    // v1 did not persist filePath. Recover its original destination, but OS
    // actions still check the real file's existence before opening/deleting it.
    if (
      item.status === "completed" &&
      !item.filePath &&
      path.isAbsolute(item.savePath) &&
      item.filename === path.basename(item.filename)
    )
      item.filePath = path.join(item.savePath, item.filename);
    return item;
  }
  save(item, previous) {
    const row = this.normalize(item, previous);
    this.upsert.run(row);
    // The normalized row is exactly what was written; avoid a second SELECT on
    // every status update while retaining the existing decode/migration rules.
    return this.decode(row);
  }
  get(id) {
    return this.decode(this.getOne.get(id));
  }
  getAll() {
    return this.all.all().map((row) => this.decode(row));
  }
  byStatus(status) {
    return this.getAll().filter((item) => item.status === status);
  }
  remove(id) {
    return this.deleteOne.run(id).changes > 0;
  }
  clearCompleted() {
    return this.db
      .prepare("DELETE FROM downloads WHERE status='completed'")
      .run().changes;
  }
  stats() {
    return this.db
      .prepare(
        "SELECT COUNT(*) total, SUM(CASE WHEN status IN ('downloading','connecting','processing') THEN 1 ELSE 0 END) active, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed, SUM(CASE WHEN status='downloading' THEN speed ELSE 0 END) speed FROM downloads",
      )
      .get();
  }
}
module.exports = { DownloadsRepo };
