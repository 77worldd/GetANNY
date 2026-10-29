import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuPlus,
  LuSearch,
  LuPause,
  LuPlay,
  LuRotateCcw,
  LuEllipsis,
  LuFolderOpen,
  LuArrowUpRight,
  LuTrash2,
  LuX,
  LuInfo,
  LuCopy,
  LuDownload,
  LuFileArchive,
  LuFileText,
  LuFile,
  LuMusic2,
  LuFilm,
  LuPackage,
  LuImage,
  LuArrowDownToLine,
  LuCheck,
  LuClock3,
  LuCircleAlert,
  LuMagnet,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import {
  Button,
  IconButton,
  PageHeader,
  ConfirmDialog,
  Select,
} from "../components/ui";
import useDownloadStore from "../stores/useDownloadStore";
import useUIStore from "../stores/useUIStore";
import {
  active,
  bytes,
  duration,
  percent,
  statusLabel,
  shortHost,
} from "../utils/format";
const icons = {
  Archives: LuFileArchive,
  Documents: LuFileText,
  Audio: LuMusic2,
  Video: LuFilm,
  Applications: LuPackage,
  Images: LuImage,
};
const titles = {
  all: [
    "All downloads",
    "Everything you’ve brought in. Organized, and under control.",
  ],
  active: [
    "Active downloads",
    "Live transfers, queued files, and scheduled retries.",
  ],
  completed: [
    "Completed",
    "Ready when you are. Open a file or find it on disk.",
  ],
  paused: ["Paused", "Pick up where you left off, whenever you’re ready."],
  failed: [
    "Failed downloads",
    "See what went wrong. Retry without losing your place.",
  ],
  torrent: [
    "Torrents",
    "Peer-to-peer transfers with verified pieces and persistent history.",
  ],
};
function ContextMenu({ position, actions, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const root = ref.current;
    root.querySelector("button:not(:disabled)")?.focus();
    const close = (event) => {
      if (!root.contains(event.target)) onClose();
    };
    const key = (event) => {
      const buttons = [...root.querySelectorAll("button:not(:disabled)")],
        index = buttons.indexOf(document.activeElement);
      if (event.key === "Escape") onClose();
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        buttons[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : (index +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  buttons.length) %
                buttons.length
        ]?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return createPortal(
    <div
      role="menu"
      aria-label="Download actions"
      className="context-menu"
      ref={ref}
      style={{
        top: Math.max(
          8,
          Math.min(position.y, innerHeight - actions.length * 38 - 20),
        ),
        left: Math.min(position.x, innerWidth - 228),
      }}
    >
      {actions.map((action, index) => (
        <button
          role="menuitem"
          disabled={action.disabled}
          className={action.danger ? "danger-text" : ""}
          key={index}
          onClick={() => {
            action.run();
            onClose();
          }}
        >
          <action.icon />
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
function DownloadRow({ item, onConfirm }) {
  const [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(null);
  const Icon =
    item.kind === "torrent" ? LuMagnet : icons[item.category] || LuFile;
  const knownSize = item.totalSize > 0 || item.status === "completed";
  const pct =
    item.totalSize > 0
      ? Math.min(100, (item.downloadedSize / item.totalSize) * 100)
      : item.status === "completed"
        ? 100
        : 0;
  const act = async (action) => {
    setBusy(true);
    try {
      const result = await api.invoke(`download:${action}`, item.id);
      if (result === false)
        useUIStore
          .getState()
          .notify(
            "This action is no longer available. The download state has changed.",
            "error",
          );
    } catch (error) {
      useUIStore.getState().notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const openMenu = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    setMenu({ x: box.right - 210, y: box.bottom + 5 });
  };
  const actions = [
    ...(item.status === "completed"
      ? [
          {
            label: "Open downloaded file",
            icon: LuArrowUpRight,
            disabled: !api.desktop,
            run: () => act("open-file"),
          },
        ]
      : []),
    {
      label: "Show in folder",
      icon: LuFolderOpen,
      disabled: !api.desktop,
      run: () => act("open-folder"),
    },
    {
      label: "Copy source link",
      icon: LuCopy,
      run: () =>
        navigator.clipboard.writeText(item.url).then(
          () => useUIStore.getState().notify("Source link copied."),
          () =>
            useUIStore
              .getState()
              .notify("Clipboard access was denied.", "error"),
        ),
    },
    {
      label: "Download details",
      icon: LuInfo,
      run: () => useUIStore.getState().setDetails(item.id),
    },
    ...(!["completed", "cancelled"].includes(item.status)
      ? [
          {
            label: "Cancel transfer",
            icon: LuX,
            run: () =>
              onConfirm({
                title: "Cancel this download?",
                description: item.filename,
                label: "Cancel download",
                onConfirm: () => api.invoke("download:cancel", item.id),
              }),
          },
        ]
      : []),
    {
      label: "Remove from history",
      icon: LuTrash2,
      run: () =>
        onConfirm({
          title: "Remove from history?",
          description: `${item.filename}. Downloaded files will stay on disk. An active transfer will be stopped.`,
          label: "Remove download",
          onConfirm: () => api.invoke("download:remove", { id: item.id }),
        }),
    },
    ...(item.status === "completed" && item.kind !== "torrent"
      ? [
          {
            label: "Delete file from disk",
            icon: LuTrash2,
            danger: true,
            run: () =>
              onConfirm({
                title: "Delete the downloaded file?",
                description: item.filePath || item.filename,
                label: "Delete file",
                destructive: true,
                onConfirm: () =>
                  api.invoke("download:remove", {
                    id: item.id,
                    deleteFile: true,
                  }),
              }),
          },
        ]
      : []),
  ];
  return (
    <article
      className={`download-row status-${item.status}`}
      role="listitem"
      aria-label={`${item.filename}, ${statusLabel(item)}`}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className={`file-icon ${item.category?.toLowerCase()}`}>
        <Icon />
      </div>
      <div className="file-info">
        <button
          className="filename"
          onClick={() => useUIStore.getState().setDetails(item.id)}
          title={item.filename}
        >
          {item.filename}
        </button>
        <div className="file-source">
          {shortHost(item.url)}
          <span>·</span>
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          {item.kind === "media" && (
            <>
              <span>·</span>
              {item.media?.quality}
            </>
          )}
        </div>
        {item.error && (
          <div className="row-error" title={item.error}>
            {item.error}
          </div>
        )}
      </div>
      <div className="transfer-progress">
        <div className="transfer-numbers">
          <span>
            {bytes(item.downloadedSize)}
            {knownSize ? (
              <span className="muted">
                {" "}
                / {item.approximateSize ? "≈ " : ""}
                {bytes(item.totalSize)}
              </span>
            ) : (
              <span className="muted"> / unknown</span>
            )}
          </span>
          <span className="transfer-percent">
            {knownSize
              ? `${item.approximateSize ? "≈ " : ""}${percent(pct)}`
              : "—"}
          </span>
        </div>
        <div
          className={`progress-track ${!knownSize && active(item) ? "indeterminate" : ""}`}
          role="progressbar"
          aria-label={`${item.filename} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={knownSize ? Math.round(pct) : undefined}
          aria-valuetext={
            knownSize
              ? `${item.approximateSize ? "Approximately " : ""}${Math.round(pct)}%`
              : `${bytes(item.downloadedSize)} transferred; total unknown`
          }
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="transfer-caption">
          {item.status === "downloading" ? (
            <>
              <span>
                {item.speed > 0 ? `${bytes(item.speed)}/s` : "Waiting for data"}
              </span>
              <span>
                {item.eta != null && item.totalSize > 0
                  ? `${duration(item.eta)} left`
                  : item.kind === "torrent"
                    ? `${item.peers || 0} peers`
                    : ""}
              </span>
            </>
          ) : item.status === "processing" ? (
            <span>{item.phase || "Verifying output"}</span>
          ) : item.status === "retrying" ? (
            <span>Attempt {item.attempt} · waiting to retry</span>
          ) : (
            <span>
              {item.status === "completed"
                ? "Saved to disk"
                : item.resumable
                  ? "Resume supported"
                  : item.status === "queued"
                    ? "Waiting for a free slot"
                    : "—"}
            </span>
          )}
        </div>
      </div>
      <div className={`status-badge ${item.status}`}>
        {item.status === "completed" ? (
          <LuCheck />
        ) : item.status === "failed" ? (
          <LuCircleAlert />
        ) : item.status === "paused" ? (
          <LuPause />
        ) : active(item) ? (
          <span className="status-dot" />
        ) : (
          <LuClock3 />
        )}
        {statusLabel(item)}
      </div>
      <div className="row-actions">
        {active(item) || ["queued", "retrying"].includes(item.status) ? (
          <IconButton
            label={`Pause ${item.filename}`}
            busy={busy}
            onClick={() => act("pause")}
          >
            <LuPause />
          </IconButton>
        ) : ["paused", "failed", "cancelled"].includes(item.status) ? (
          <IconButton
            label={`${item.status === "paused" ? "Resume" : "Retry"} ${item.filename}`}
            busy={busy}
            onClick={() => act(item.status === "paused" ? "resume" : "retry")}
          >
            {item.status === "paused" ? <LuPlay /> : <LuRotateCcw />}
          </IconButton>
        ) : (
          <IconButton
            label={`Open ${item.filename}`}
            disabled={!api.desktop}
            onClick={() => act("open-file")}
          >
            <LuArrowUpRight />
          </IconButton>
        )}
        <IconButton label={`Actions for ${item.filename}`} onClick={openMenu}>
          <LuEllipsis />
        </IconButton>
      </div>
      {menu && (
        <ContextMenu
          position={menu}
          actions={actions}
          onClose={() => setMenu(null)}
        />
      )}
    </article>
  );
}
export default function DownloadsPage({ filter }) {
  const downloads = useDownloadStore((state) => state.downloads);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All files"),
    [sort, setSort] = useState("latest"),
    [confirm, setConfirm] = useState(null),
    [bulkBusy, setBulkBusy] = useState(false);
  const [title, description] = titles[filter] || titles.all;
  const base = downloads.filter(
    (item) =>
      filter === "all" ||
      (filter === "active" &&
        (active(item) || ["queued", "retrying"].includes(item.status))) ||
      (filter === "torrent" && item.kind === "torrent") ||
      filter === item.status,
  );
  const rows = useMemo(
    () =>
      base
        .filter(
          (item) =>
            (!search ||
              `${item.filename} ${item.url}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (category === "All files" || item.category === category),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.filename.localeCompare(b.filename)
            : sort === "size"
              ? b.totalSize - a.totalSize
              : b.createdAt.localeCompare(a.createdAt),
        ),
    [base, search, category, sort],
  );
  const transferring = downloads.filter(active),
    speed = transferring.reduce(
      (sum, item) =>
        sum + (item.status === "downloading" ? item.speed || 0 : 0),
      0,
    );
  const pauseAll = async () => {
    setBulkBusy(true);
    try {
      await Promise.all(
        base
          .filter(
            (item) =>
              active(item) || ["queued", "retrying"].includes(item.status),
          )
          .map((item) => api.invoke("download:pause", item.id)),
      );
    } catch (error) {
      useUIStore.getState().notify(errorMessage(error), "error");
    } finally {
      setBulkBusy(false);
    }
  };
  return (
    <div className="page downloads-page">
      <PageHeader
        eyebrow="YOUR LIBRARY"
        title={title}
        description={description}
      >
        <Button
          icon={LuPlus}
          variant="primary"
          onClick={() =>
            useUIStore
              .getState()
              .setAddModal(filter === "torrent" ? { torrent: true } : {})
          }
        >
          {filter === "torrent" ? "Add torrent" : "New download"}
        </Button>
      </PageHeader>
      <div className="transfer-summary">
        <div>
          <span className={`live-dot ${transferring.length ? "live" : ""}`} />
          <strong>{transferring.length}</strong>
          <span>transferring</span>
        </div>
        <div>
          <LuDownload />
          <strong>{speed > 0 ? `${bytes(speed)}/s` : "—"}</strong>
          <span>current speed</span>
        </div>
        <div>
          <LuCheck />
          <strong>
            {downloads.filter((item) => item.status === "completed").length}
          </strong>
          <span>completed</span>
        </div>
        <span className="summary-label">
          {downloads.length} {downloads.length === 1 ? "file" : "files"} in your
          library
        </span>
      </div>
      <div className="library-panel">
        <div className="library-toolbar">
          <div className="search-input">
            <LuSearch />
            <input
              aria-label="Search downloads"
              placeholder="Search files or links…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <IconButton label="Clear search" onClick={() => setSearch("")}>
                <LuX />
              </IconButton>
            )}
          </div>
          <div className="toolbar-actions">
            <Button
              variant="ghost"
              icon={LuPause}
              busy={bulkBusy}
              disabled={
                !base.some(
                  (item) =>
                    active(item) ||
                    ["queued", "retrying"].includes(item.status),
                )
              }
              onClick={pauseAll}
            >
              Pause all
            </Button>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort downloads"
            >
              <option value="latest">Newest first</option>
              <option value="name">File name</option>
              <option value="size">Largest first</option>
            </Select>
            {filter === "completed" && (
              <IconButton
                label="Clear completed history"
                disabled={!base.length}
                onClick={() =>
                  setConfirm({
                    title: "Clear completed history?",
                    description:
                      "Completed files remain on disk. Only their history entries will be removed.",
                    label: "Clear history",
                    onConfirm: () => api.invoke("download:clear-completed"),
                  })
                }
              >
                <LuTrash2 />
              </IconButton>
            )}
          </div>
        </div>
        <div
          className="category-tabs"
          role="group"
          aria-label="Filter by file type"
        >
          {[
            "All files",
            "Video",
            "Audio",
            "Archives",
            "Documents",
            "Applications",
            "Images",
            "Other",
          ]
            .filter(
              (name) =>
                [
                  "All files",
                  "Video",
                  "Audio",
                  "Archives",
                  "Documents",
                ].includes(name) || base.some((item) => item.category === name),
            )
            .map((name) => (
              <button
                className={category === name ? "selected" : ""}
                key={name}
                onClick={() => setCategory(name)}
              >
                {name}
                {name === "All files" && <span>{base.length}</span>}
              </button>
            ))}
        </div>
        <div className="list-heading">
          <span className="file-heading">FILE NAME</span>
          <span>TRANSFER</span>
          <span>STATUS</span>
          <span />
        </div>
        <div role="list" aria-label={title} className="download-list">
          {rows.length ? (
            rows.map((item) => (
              <DownloadRow key={item.id} item={item} onConfirm={setConfirm} />
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                {filter === "completed" ? (
                  <LuCheck />
                ) : filter === "failed" ? (
                  <LuCircleAlert />
                ) : filter === "paused" ? (
                  <LuPause />
                ) : (
                  <LuArrowDownToLine />
                )}
              </div>
              <h2>
                {search || category !== "All files"
                  ? "No matching downloads"
                  : filter === "completed"
                    ? "Good things are on their way"
                    : filter === "failed"
                      ? "Nothing to fix here"
                      : filter === "paused"
                        ? "Nothing on hold"
                        : "Your next download starts here"}
              </h2>
              <p>
                {search || category !== "All files"
                  ? "Try another file name, link, or category."
                  : filter === "failed"
                    ? "If a transfer fails, its details and retry action will appear here."
                    : filter === "paused"
                      ? "Paused transfers keep their partial files, ready to resume."
                      : filter === "completed"
                        ? "Your successfully verified downloads will appear here."
                        : "Paste a file link, choose where it goes, and leave the rest to GetANNY."}
              </p>
              {!search && filter !== "failed" && filter !== "paused" && (
                <Button
                  icon={LuPlus}
                  onClick={() =>
                    useUIStore
                      .getState()
                      .setAddModal(
                        filter === "torrent" ? { torrent: true } : {},
                      )
                  }
                >
                  {filter === "torrent"
                    ? "Add a torrent"
                    : "Add your first download"}
                </Button>
              )}
              <span className="keyboard-hint">
                {filter === "all" && (
                  <>
                    Quick add <kbd>Ctrl</kbd>
                    <kbd>N</kbd>
                  </>
                )}
              </span>
            </div>
          )}
        </div>
        <div className="list-footer">
          <span>
            {rows.length} of {base.length} downloads
          </span>
          <span>
            {rows.length
              ? `${bytes(rows.reduce((sum, item) => sum + item.downloadedSize, 0))} transferred`
              : "Your history is stored locally"}
          </span>
        </div>
      </div>
      {filter === "torrent" && (
        <p className="page-footnote">
          <LuInfo />
          Torrents stop seeding when complete. On resume, saved pieces are
          verified before transferring.
        </p>
      )}
      {confirm && (
        <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />
      )}
    </div>
  );
}
