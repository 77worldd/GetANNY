import React, { useState } from "react";
import {
  LuArrowDownToLine,
  LuLink,
  LuFolderOpen,
  LuMagnet,
  LuArrowUpRight,
  LuX,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import {
  Button,
  Dialog,
  Field,
  FolderField,
  ErrorBanner,
  IconButton,
} from "./ui";
import useSettingsStore from "../stores/useSettingsStore";
import useUIStore from "../stores/useUIStore";
import { useI18n } from "../i18n/useI18n";
export default function AddDownloadDialog({ initial = {}, onClose }) {
  const { t } = useI18n();
  const settings = useSettingsStore((state) => state.settings);
  const intercepted = Boolean(initial.browserRequestId);
  const [kind, setKind] = useState(initial.torrent ? "torrent" : "file");
  const [url, setUrl] = useState(initial.url || "");
  const [filename, setFilename] = useState(initial.filename || "");
  const [folder, setFolder] = useState(settings.defaultDownloadPath || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const clearLink = () => {
    setUrl("");
    setError("");
    document.getElementById("download-url")?.focus();
  };
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (intercepted && (kind !== "file" || url.trim() !== initial.url))
        throw new Error(t("add.handoffMismatch"));
      if (kind === "file" && !/^https?:\/\//i.test(url.trim()))
        throw new Error(t("add.invalidUrl"));
      const downloadId = await api.invoke(
        kind === "torrent" ? "download:add-torrent" : "download:add",
        kind === "torrent"
          ? { torrent: url.trim(), savePath: folder }
          : {
              url: url.trim(),
              filename: filename || undefined,
              headers: initial.headers,
              browserTransferId: initial.browserTransferId,
              browserSource: initial.browserSource,
              ...(folder !== settings.defaultDownloadPath
                ? { savePath: folder }
                : {}),
            },
      );
      if (initial.browserRequestId) {
        useUIStore.getState().removeRequest(initial.browserRequestId);
        try {
          const handoff = await api.invoke("browser:commit-request", {
            id: initial.browserRequestId,
            downloadId,
          });
          if (handoff.cancelled === false)
            useUIStore
              .getState()
              .notify(t("add.handoffUnconfirmed"), "error");
        } catch (error) {
          useUIStore
            .getState()
            .notify(
              t("add.handoffFailed", { error: errorMessage(error) }),
              "error",
            );
        }
      }
      useUIStore
        .getState()
        .notify(
          settings.autoStartDownloads
            ? t("add.queuedNotice")
            : t("add.pausedNotice"),
        );
      useUIStore
        .getState()
        .setActiveTab(kind === "torrent" ? "torrent" : "all");
      onClose(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={t("add.title")}
      description={
        initial.source
          ? t("add.descriptionSource", { source: initial.source })
          : t("add.descriptionDefault")
      }
      onClose={() => !busy && onClose()}
      busy={busy}
    >
      <form onSubmit={submit}>
        <div className="dialog-body">
          <div className="segmented">
            <button
              type="button"
              className={kind === "file" ? "selected" : ""}
              onClick={() => {
                setKind("file");
                setError("");
              }}
            >
              <LuLink />
              {t("add.fileUrl")}
            </button>
            <button
              type="button"
              className={kind === "torrent" ? "selected" : ""}
              disabled={intercepted}
              title={intercepted ? t("add.torrentLocked") : undefined}
              onClick={() => {
                setKind("torrent");
                setError("");
              }}
            >
              <LuMagnet />
              {t("add.torrent")}
            </button>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <Field
            label={
              kind === "file" ? t("add.downloadLink") : t("add.torrentLink")
            }
            id="download-url"
            hint={
              intercepted
                ? t("add.handoffLocked")
                : kind === "file"
                  ? t("add.fileHint")
                  : t("add.torrentHint")
            }
          >
            <div className="input-group">
              <LuLink />
              <input
                autoFocus
                id="download-url"
                required
                readOnly={intercepted}
                type={kind === "file" ? "url" : "text"}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={
                  kind === "file"
                    ? "https://example.com/file.zip"
                    : "magnet:?xt=urn:btih:…"
                }
                autoComplete="off"
                spellCheck="false"
              />
              {url && !intercepted && (
                <IconButton
                  label={t("add.clearLink")}
                  className="clear-link"
                  onClick={clearLink}
                >
                  <LuX />
                </IconButton>
              )}
              {kind === "torrent" && api.desktop && (
                <Button
                  variant="ghost"
                  icon={LuFolderOpen}
                  onClick={async () => {
                    try {
                      const file = await api.invoke("dialog:select-torrent");
                      if (file) setUrl(file);
                    } catch (error) {
                      setError(errorMessage(error));
                    }
                  }}
                >
                  {t("add.chooseFile")}
                </Button>
              )}
            </div>
          </Field>
          {kind === "file" && (
            <Field
              label={t("add.fileName")}
              id="download-name"
              hint={t("add.fileNameHint")}
            >
              <input
                id="download-name"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                placeholder={t("add.automatic")}
                maxLength={220}
              />
            </Field>
          )}
          <FolderField value={folder} onChange={setFolder} />
          <div className="form-note">
            <LuArrowDownToLine />
            <span>
              {t("add.connections", {
                count: settings.maxConnectionsPerDownload || 8,
              })}{" "}
              ·{" "}
              {settings.autoStartDownloads
                ? t("add.autoStart")
                : t("add.paused")}
              <br />
              {t("add.existingNote")}
            </span>
          </div>
          {kind === "file" && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                useUIStore.getState().openMedia(url);
                onClose();
              }}
            >
              {t("add.mediaLink")} <LuArrowUpRight />
            </button>
          )}
        </div>
        <footer className="dialog-footer">
          <Button disabled={busy} onClick={onClose}>
            {t("add.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={LuArrowDownToLine}
            busy={busy}
          >
            {settings.autoStartDownloads ? t("add.start") : t("add.add")}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
