import React, { useState } from "react";
import {
  LuArrowDownToLine,
  LuLink,
  LuFolderOpen,
  LuMagnet,
  LuArrowUpRight,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import { Button, Dialog, Field, FolderField, ErrorBanner } from "./ui";
import useSettingsStore from "../stores/useSettingsStore";
import useUIStore from "../stores/useUIStore";
export default function AddDownloadDialog({ initial = {}, onClose }) {
  const settings = useSettingsStore((state) => state.settings);
  const intercepted = Boolean(initial.browserRequestId);
  const [kind, setKind] = useState(initial.torrent ? "torrent" : "file");
  const [url, setUrl] = useState(initial.url || "");
  const [filename, setFilename] = useState(initial.filename || "");
  const [folder, setFolder] = useState(settings.defaultDownloadPath || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (intercepted && (kind !== "file" || url.trim() !== initial.url))
        throw new Error("A browser handoff must keep its original file link.");
      if (kind === "file" && !/^https?:\/\//i.test(url.trim()))
        throw new Error(
          "Enter an HTTP or HTTPS file URL. Use Media studio for a video page.",
        );
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
              .notify(
                "GetANNY queued the file, but the browser did not confirm cancellation. Check its download list to avoid a duplicate.",
                "error",
              );
        } catch (error) {
          useUIStore
            .getState()
            .notify(
              `Download queued; browser cleanup needs attention: ${errorMessage(error)}`,
              "error",
            );
        }
      }
      useUIStore
        .getState()
        .notify(
          settings.autoStartDownloads
            ? "Download added to the queue."
            : "Download added in paused state. Start it when you’re ready.",
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
      title="New download"
      description={
        initial.source
          ? `Sent from ${initial.source}. Review the file and destination.`
          : "A direct link. A destination. You’re in control."
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
              File URL
            </button>
            <button
              type="button"
              className={kind === "torrent" ? "selected" : ""}
              disabled={intercepted}
              title={
                intercepted
                  ? "Browser handoffs must keep their original file link"
                  : undefined
              }
              onClick={() => {
                setKind("torrent");
                setError("");
              }}
            >
              <LuMagnet />
              Torrent
            </button>
          </div>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <Field
            label={
              kind === "file" ? "Download link" : "Magnet link or torrent file"
            }
            id="download-url"
            hint={
              intercepted
                ? "The original browser link is locked to keep this handoff safe."
                : kind === "file"
                  ? "Paste the direct HTTP(S) link to a file, not a website’s download page."
                  : "Transfers depend on available peers. Pausing disconnects the torrent; resuming rechecks saved pieces."
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
                  Choose file
                </Button>
              )}
            </div>
          </Field>
          {kind === "file" && (
            <Field
              label="File name"
              id="download-name"
              hint="Optional. Leave blank to use the name provided by the server."
            >
              <input
                id="download-name"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                placeholder="Automatic"
                maxLength={220}
              />
            </Field>
          )}
          <FolderField value={folder} onChange={setFolder} />
          <div className="form-note">
            <LuArrowDownToLine />
            <span>
              {settings.maxConnectionsPerDownload || 8} connections when
              supported ·{" "}
              {settings.autoStartDownloads
                ? "Starts automatically"
                : "Starts paused"}
              <br />
              Existing files are never overwritten.
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
              Downloading video or audio? Open Media studio <LuArrowUpRight />
            </button>
          )}
        </div>
        <footer className="dialog-footer">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={LuArrowDownToLine}
            busy={busy}
          >
            {settings.autoStartDownloads ? "Start download" : "Add download"}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
