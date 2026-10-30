import React from "react";
import { Button, Dialog } from "./ui";
import { bytes, duration } from "../utils/format";
import { useI18n } from "../i18n/useI18n";

export default function DownloadDetails({ item, onClose }) {
  const { t } = useI18n();
  const kindKey =
    item.kind === "torrent"
      ? "details.kindTorrent"
      : item.kind === "media"
        ? "details.kindMedia"
        : "details.kindFile";
  const fields = [
    ["details.status", t(`status.${item.status}`)],
    ["details.type", t(kindKey)],
    [
      "details.format",
      item.filename.match(/\.([^.]+)$/)?.[1]?.toUpperCase() ||
        item.mimeType ||
        t("common.unknown"),
    ],
    [
      "details.completed",
      item.completedAt
        ? new Date(item.completedAt).toLocaleString()
        : t("details.notCompleted"),
    ],
    [
      "details.fileSize",
      item.totalSize > 0 || item.status === "completed"
        ? `${item.approximateSize ? `${t("details.approximately")} ` : ""}${bytes(item.totalSize)}`
        : t("details.notProvidedServer"),
    ],
    ["details.transferred", bytes(item.downloadedSize)],
    [
      "details.speed",
      item.speed > 0 ? `${bytes(item.speed)}/s` : "—",
    ],
    ["details.remaining", duration(item.eta)],
    [
      "details.resumable",
      item.kind === "file"
        ? item.resumable === undefined
          ? t("details.notChecked")
          : item.resumable
            ? t("details.serverRanges")
            : t("details.noRanges")
        : item.kind === "media"
          ? t("details.ytdlpContinuation")
          : t("details.torrentPieces"),
    ],
    ["details.connections", item.connections || "—"],
    ["details.created", new Date(item.createdAt).toLocaleString()],
    ["details.location", item.filePath || item.savePath],
    ["details.source", item.url],
  ];
  return (
    <Dialog
      title={t("details.title")}
      description={item.filename}
      onClose={onClose}
    >
      <div className="dialog-body">
        <dl className="details-list">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {item.error && <div className="error-banner">{item.error}</div>}
      </div>
      <footer className="dialog-footer">
        <Button onClick={onClose}>{t("details.done")}</Button>
      </footer>
    </Dialog>
  );
}
