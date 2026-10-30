export function bytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(number) / Math.log(1024)), 4);
  return `${(number / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
export function duration(seconds) {
  if (
    seconds === null ||
    seconds === undefined ||
    !Number.isFinite(Number(seconds)) ||
    seconds < 0
  )
    return "—";
  if (seconds >= 86400)
    return `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h`;
  if (seconds >= 3600)
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m`;
  if (seconds >= 60)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.max(1, Math.round(seconds))}s`;
}
export const percent = (value) =>
  `${Math.min(100, Math.max(0, Number(value) || 0)).toFixed(1)}%`;
export const active = (item) =>
  ["connecting", "downloading", "processing"].includes(item.status);
export const statusLabel = (item) =>
  ({
    connecting: "Connecting",
    downloading: "Downloading",
    processing: "Finalizing",
    retrying: "Retry scheduled",
    completed: "Completed",
    queued: "Queued",
    paused: "Paused",
    failed: "Failed",
    cancelled: "Cancelled",
  })[item.status] || item.status;
export const shortHost = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "Torrent";
  }
};
