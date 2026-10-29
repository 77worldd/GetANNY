const path = require("node:path");

function sanitizeFilename(name = "download") {
  let safe = path
    .basename(String(name).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_"))
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 220);
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(safe))
    safe = `_${safe}`;
  return safe || "download";
}
function getFilenameFromHeaders(header) {
  try {
    return header
      ? require("content-disposition").parse(header).parameters.filename
      : null;
  } catch {
    return null;
  }
}
function getFilenameFromURL(value) {
  try {
    return (
      decodeURIComponent(path.posix.basename(new URL(value).pathname)) || null
    );
  } catch {
    return null;
  }
}
function validateUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS URL.");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Use an HTTP or HTTPS URL.");
  if (url.username || url.password)
    throw new Error("URLs with embedded credentials are not supported.");
  return url.href;
}
function validateHeaders(headers = {}) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers))
    throw new Error("Invalid request headers.");
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(key) || /[\r\n]/.test(String(value)))
      throw new Error("Invalid request header.");
    if (
      [
        "host",
        "content-length",
        "connection",
        "range",
        "if-range",
        "accept-encoding",
      ].includes(key.toLowerCase())
    )
      continue;
    result[key] = String(value);
  }
  return result;
}
function categoryFor(name) {
  const ext = path.extname(name).toLowerCase();
  if (/^\.(mp4|mkv|webm|mov|avi|m4v)$/.test(ext)) return "Video";
  if (/^\.(mp3|m4a|aac|wav|flac|opus|ogg)$/.test(ext)) return "Audio";
  if (/^\.(zip|7z|rar|tar|gz|bz2|xz)$/.test(ext)) return "Archives";
  if (/^\.(exe|msi|dmg|appimage|deb|rpm)$/.test(ext)) return "Applications";
  if (/^\.(pdf|docx?|xlsx?|pptx?|txt|epub|csv)$/.test(ext)) return "Documents";
  if (/^\.(png|jpe?g|gif|webp|svg|avif)$/.test(ext)) return "Images";
  return "Other";
}
function formatBytes(n = 0) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(n) / Math.log(1024)),
    units.length - 1,
  );
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
module.exports = {
  sanitizeFilename,
  getFilenameFromHeaders,
  getFilenameFromURL,
  validateUrl,
  validateHeaders,
  categoryFor,
  formatBytes,
};
