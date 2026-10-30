const fs = require("node:fs/promises");
const path = require("node:path");
const { sanitizeFilename } = require("../engine/utils");
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function uniquePath(dir, name) {
  await ensureDir(dir);
  const safe = sanitizeFilename(name),
    ext = path.extname(safe),
    base = path.basename(safe, ext);
  let candidate = path.join(dir, safe),
    n = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${base} (${n++})${ext}`);
    } catch {
      return candidate;
    }
  }
}
async function removeFile(file) {
  await fs.rm(file, { force: true });
  return true;
}
async function fileSize(file) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}
module.exports = { ensureDir, uniquePath, removeFile, fileSize };
