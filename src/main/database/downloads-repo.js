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
  }
  normalize(item) {
    const previous = this.get(item.id);
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
    return row
      ? {
          ...parse(row.metadata, {}),
          ...Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== "metadata"),
          ),
          headers: parse(row.headers, {}),
        }
      : null;
  }
  save(item) {
    const row = this.normalize(item);
    this.upsert.run(row);
    return this.get(row.id);
  }
  get(id) {
    return this.decode(
      this.db.prepare("SELECT * FROM downloads WHERE id=?").get(id),
    );
  }
  getAll() {
    return this.db
      .prepare("SELECT * FROM downloads ORDER BY createdAt DESC, rowid DESC")
      .all()
      .map((row) => this.decode(row));
  }
  byStatus(status) {
    return this.getAll().filter((item) => item.status === status);
  }
  remove(id) {
    return (
      this.db.prepare("DELETE FROM downloads WHERE id=?").run(id).changes > 0
    );
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
