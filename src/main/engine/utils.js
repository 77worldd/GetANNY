const path = require('node:path');
const contentDisposition = require('content-disposition');
function sanitizeFilename(name='download') { return path.basename(String(name).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')).replace(/^\.+/,'').replace(/\.+$/,'').slice(0,240) || 'download'; }
function getFilenameFromHeaders(header) { try { return header ? contentDisposition.parse(header).parameters.filename : null; } catch { return null; } }
function getFilenameFromURL(value) { try { return decodeURIComponent(path.posix.basename(new URL(value).pathname)) || null; } catch { return null; } }
function formatBytes(n=0) { if(!Number.isFinite(n)||n<=0)return '0 B'; const u=['B','KB','MB','GB','TB']; const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1); return `${(n/1024**i).toFixed(i?1:0)} ${u[i]}`; }
module.exports={sanitizeFilename,getFilenameFromHeaders,getFilenameFromURL,formatBytes};
