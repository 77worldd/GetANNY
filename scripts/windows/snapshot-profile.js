// Read-only retention evidence for the ACTUAL default app-data database.
// Emits a digest/counts, never user URLs, headers, settings or pairing secrets.
const Database = require("better-sqlite3");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
function snapshot(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const downloads = db.prepare("SELECT * FROM downloads ORDER BY id").all();
    const settings = db.prepare("SELECT * FROM settings ORDER BY key").all();
    return {
      sha256: createHash("sha256")
        .update(JSON.stringify({ downloads, settings }))
        .digest("hex"),
      history: downloads.length,
      missingCompletedFiles: downloads.filter((row) => {
        if (row.status !== "completed") return false;
        let metadata = {};
        try {
          metadata = JSON.parse(row.metadata || "{}");
        } catch {}
        return !fs.existsSync(
          metadata.filePath || path.join(row.savePath, row.filename),
        );
      }).length,
      settings: settings.length,
    };
  } finally {
    db.close();
  }
}
if (require.main === module) {
  try {
    process.stdout.write(JSON.stringify(snapshot(process.argv[2])) + "\n");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { snapshot };
