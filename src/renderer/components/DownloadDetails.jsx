import React from "react";
import { Button, Dialog } from "./ui";
import { bytes, duration, statusLabel } from "../utils/format";
export default function DownloadDetails({ item, onClose }) {
  const fields = [
    ["Status", statusLabel(item)],
    ["Type", item.kind],
    [
      "Format",
      item.filename.match(/\.([^.]+)$/)?.[1]?.toUpperCase() ||
        item.mimeType ||
        "Unknown",
    ],
    [
      "Completed",
      item.completedAt
        ? new Date(item.completedAt).toLocaleString()
        : "Not completed",
    ],
    [
      "File size",
      item.totalSize > 0 || item.status === "completed"
        ? `${item.approximateSize ? "Approximately " : ""}${bytes(item.totalSize)}`
        : "Not provided by server",
    ],
    ["Transferred", bytes(item.downloadedSize)],
    ["Speed", item.speed > 0 ? `${bytes(item.speed)}/s` : "—"],
    ["Remaining", duration(item.eta)],
    [
      "Resumable",
      item.kind === "file"
        ? item.resumable === undefined
          ? "Not checked yet"
          : item.resumable
            ? "Server supports byte ranges"
            : "Server does not support byte ranges"
        : item.kind === "media"
          ? "yt-dlp continuation where supported"
          : "Verified torrent pieces",
    ],
    ["Connections", item.connections || "—"],
    ["Created", new Date(item.createdAt).toLocaleString()],
    ["Location", item.filePath || item.savePath],
    ["Source", item.url],
  ];
  return (
    <Dialog
      title="Download details"
      description={item.filename}
      onClose={onClose}
    >
      <div className="dialog-body">
        <dl className="details-list">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {item.error && <div className="error-banner">{item.error}</div>}
      </div>
      <footer className="dialog-footer">
        <Button onClick={onClose}>Done</Button>
      </footer>
    </Dialog>
  );
}
