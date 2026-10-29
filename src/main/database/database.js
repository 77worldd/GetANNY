const DatabaseSync = require('better-sqlite3');
const fs = require('node:fs'); const path = require('node:path');
class Database {
  constructor(userDataPath) { this.file = path.join(userDataPath, 'getanny.db'); this.db = null; }
  async initialize() {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    this.db = new DatabaseSync(this.file); this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON');
    this.db.exec(`CREATE TABLE IF NOT EXISTS downloads (id TEXT PRIMARY KEY, url TEXT NOT NULL, filename TEXT NOT NULL, savePath TEXT NOT NULL, status TEXT NOT NULL, totalSize INTEGER DEFAULT 0, downloadedSize INTEGER DEFAULT 0, speed REAL DEFAULT 0, mimeType TEXT, category TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, error TEXT, headers TEXT, kind TEXT DEFAULT 'file'); CREATE INDEX IF NOT EXISTS idx_download_status ON downloads(status); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  close(){ if(this.db?.open)this.db.close(); }
}
module.exports={Database};
