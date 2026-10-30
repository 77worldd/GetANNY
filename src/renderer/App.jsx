import React, { useEffect, useState } from "react";
import {
  LuArrowDownToLine,
  LuArrowDown,
  LuActivity,
  LuCircleCheck,
  LuPause,
  LuCircleAlert,
  LuFilm,
  LuMagnet,
  LuGlobe,
  LuSettings2,
  LuPalette,
  LuMinus,
  LuSquare,
  LuCopy,
  LuX,
  LuPlus,
  LuFolderOpen,
  LuChevronRight,
  LuLink,
  LuMonitor,
  LuWifiOff,
  LuLoaderCircle,
  LuRefreshCw,
  LuArrowLeft,
} from "react-icons/lu";
import { api, errorMessage } from "./api";
import { useIPC } from "./hooks/useIPC";
import useDownloadStore from "./stores/useDownloadStore";
import useSettingsStore from "./stores/useSettingsStore";
import useUIStore from "./stores/useUIStore";
import DownloadsPage from "./pages/DownloadsPage";
import MediaPage from "./pages/MediaPage";
import BrowserPage from "./pages/BrowserPage";
import SettingsPage from "./pages/SettingsPage";
import ThemesPage from "./pages/ThemesPage";
import ThemeSwitcher from "./components/ThemeSwitcher";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { useI18n } from "./i18n/useI18n";
import { applyTheme } from "./utils/theme";
import AddDownloadDialog from "./components/AddDownloadDialog";
import DownloadDetails from "./components/DownloadDetails";
import { Button, IconButton, Toasts } from "./components/ui";
import { active, bytes } from "./utils/format";
const navigation = [
  ["all", LuArrowDownToLine, "nav.all"],
  ["active", LuActivity, "nav.active"],
  ["completed", LuCircleCheck, "nav.completed"],
  ["paused", LuPause, "nav.paused"],
  ["failed", LuCircleAlert, "nav.failed"],
];
const downloadTabs = navigation.map(([id]) => id);
function Sidebar({ bridge, version }) {
  const { t } = useI18n();
  const tab = useUIStore((state) => state.activeTab),
    setTab = useUIStore((state) => state.setActiveTab);
  const downloads = useDownloadStore((state) => state.downloads),
    settings = useSettingsStore((state) => state.settings);
  const count = (key) =>
    downloads.filter((item) =>
      key === "all"
        ? true
        : key === "active"
          ? active(item) || ["queued", "retrying"].includes(item.status)
          : item.status === key,
    ).length;
  const Nav = ({ id, icon: Icon, label, count: amount }) => (
    <button
      className={`nav-item ${tab === id ? "selected" : ""}`}
      aria-current={tab === id ? "page" : undefined}
      title={label}
      onClick={() => setTab(id)}
    >
      <Icon />
      <span>{label}</span>
      {amount > 0 && <b>{amount}</b>}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="workspace-label">{t("shell.personalWorkspace")}</div>
        <Button
          icon={LuPlus}
          variant="primary"
          className="sidebar-add"
          onClick={() => useUIStore.getState().setAddModal({})}
        >
          {t("shell.newDownload")}
          <kbd>⌘ / Ctrl N</kbd>
        </Button>
      </div>
      <nav aria-label="Main navigation">
        <div className="nav-group-label">{t("nav.library")}</div>
        {navigation.map(([id, Icon, key]) => (
          <Nav
            key={id}
            id={id}
            icon={Icon}
            label={t(key)}
            count={count(id)}
          />
        ))}
        <div className="nav-group-label tools-label">{t("nav.tools")}</div>
        <Nav id="media" icon={LuFilm} label={t("nav.media")} />
        <Nav
          id="torrent"
          icon={LuMagnet}
          label={t("nav.torrents")}
          count={
            downloads.filter((item) => item.kind === "torrent" && active(item))
              .length
          }
        />
      </nav>
      <div className="sidebar-bottom">
        <button
          className="save-location"
          onClick={() => setTab("settings")}
          title={settings.defaultDownloadPath}
        >
          <LuFolderOpen />
          <div>
            <small>{t("shell.defaultLocation")}</small>
            <span>
              {settings.defaultDownloadPath
                ?.split(/[\\/]/)
                .filter(Boolean)
                .at(-1) || "Downloads"}
            </span>
          </div>
          <LuChevronRight />
        </button>
        <Nav id="browser" icon={LuGlobe} label={t("nav.browser")} />
        <Nav id="themes" icon={LuPalette} label={t("nav.themes")} />
        <Nav id="settings" icon={LuSettings2} label={t("nav.settings")} />
        <button
          className="sidebar-connection"
          onClick={() => setTab("browser")}
        >
          <span className={`live-dot ${bridge.clients > 0 ? "live" : ""}`} />
          <span>
            {bridge.clients > 0
              ? t(
                  bridge.clients > 1
                    ? "shell.browsersConnected"
                    : "shell.browserConnected",
                  { count: bridge.clients },
                )
              : bridge.running && bridge.enabled
                ? t("shell.noBrowser")
                : t("shell.bridgeOffline")}
          </span>
          <LuChevronRight />
        </button>
        <div className="sidebar-version">
          GETANNY <span>{version}</span>
        </div>
      </div>
    </aside>
  );
}
export default function App() {
  useIPC();
  const { t, language, rtl } = useI18n();
  const [boot, setBoot] = useState(null),
    [error, setError] = useState(""),
    [bridge, setBridge] = useState({
      running: false,
      enabled: true,
      clients: 0,
    }),
    [maximized, setMaximized] = useState(false);
  const tab = useUIStore((state) => state.activeTab),
    addModal = useUIStore((state) => state.addModal),
    setAddModal = useUIStore((state) => state.setAddModal),
    detailId = useUIStore((state) => state.details),
    requests = useUIStore((state) => state.browserRequests),
    tabHistory = useUIStore((state) => state.tabHistory),
    goBack = useUIStore((state) => state.goBack);
  const downloads = useDownloadStore((state) => state.downloads),
    settings = useSettingsStore((state) => state.settings);
  const [visited, setVisited] = useState(() => new Set(["all"]));
  useEffect(() => {
    setVisited((previous) =>
      previous.has(tab) ? previous : new Set(previous).add(tab),
    );
  }, [tab]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }, [language, rtl]);
  const load = async () => {
    setError("");
    try {
      const data = await api.invoke("app:bootstrap");
      useDownloadStore.getState().setDownloads(data.downloads);
      useSettingsStore.getState().setSettings(data.settings);
      setBridge(data.bridge);
      setBoot(data);
      for (const request of data.pendingRequests)
        useUIStore.getState().addRequest(request);
      if (!data.settings.firstRunCompleted)
        useUIStore.getState().setActiveTab("browser");
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  useEffect(() => {
    load();
    const cleanup = api.on("window:state", (value) =>
      setMaximized(!!value.maximized),
    );
    return cleanup;
  }, []);
  useEffect(() => {
    if (!boot) return;
    const poll = () =>
      api
        .invoke("browser:bridge-status")
        .then(setBridge)
        .catch(() =>
          setBridge((old) => ({ ...old, running: false, clients: 0 })),
        );
    // Connection events are primary; this lightweight visible-window fallback
    // expires stale sessions without repeatedly scanning browser installations.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, 30000);
    const cleanup = api.on("browser:changed", setBridge);
    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, [!!boot]);
  useEffect(() => {
    applyTheme(settings.theme || "graphite");
    const system = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => {
      if ((settings.theme || "graphite") === "system") applyTheme("system");
    };
    system.addEventListener("change", update);
    return () => system.removeEventListener("change", update);
  }, [settings.theme]);
  useEffect(() => {
    document.documentElement.dataset.motion =
      settings.animationMode || "standard";
    document.documentElement.dataset.density = settings.compactList
      ? "compact"
      : "comfortable";
  }, [settings.animationMode, settings.compactList]);
  const detail = downloads.find((item) => item.id === detailId);
  // File handoffs are queued automatically by the desktop bridge, so the only
  // request that still needs attention is a media page awaiting a format.
  const review = (request) => {
    useUIStore.getState().openMedia(request.url);
    useUIStore.getState().removeRequest(request.id);
    api
      .invoke("browser:ack-request", request.id)
      .catch((error) =>
        useUIStore.getState().notify(errorMessage(error), "error"),
      );
  };
  const closeAdd = (submitted = false) => {
    const requestId = addModal?.browserRequestId;
    setAddModal(null);
    if (
      !submitted &&
      requestId &&
      useUIStore
        .getState()
        .browserRequests.some((request) => request.id === requestId)
    ) {
      useUIStore.getState().removeRequest(requestId);
      api
        .invoke("browser:ack-request", requestId)
        .catch((error) =>
          useUIStore.getState().notify(errorMessage(error), "error"),
        );
    }
  };
  const speed = downloads
    .filter((item) => item.status === "downloading")
    .reduce((sum, item) => sum + (item.speed || 0), 0);
  useEffect(() => {
    if (boot && requests[0]?.kind === "media" && !addModal && !detailId)
      review(requests[0]);
  }, [!!boot, requests[0]?.id, !!addModal, detailId]);
  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="titlebar-left">
          <div className="app-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span
              className="brand-wordmark"
              role="img"
              aria-label="GetANNY"
            />
            <span className="brand-divider" />
            <span className="app-caption">{t("shell.downloadManager")}</span>
          </div>
          {(tabHistory.length > 0 || detailId) && (
            <button
              type="button"
              className="back-button"
              title={t("shell.backTitle")}
              onClick={() => {
                // A detail sheet is the deepest view; back closes it before
                // returning to the previous workspace section.
                if (detailId) useUIStore.getState().setDetails(null);
                else goBack();
              }}
            >
              <LuArrowLeft />
              <span>{t("shell.back")}</span>
            </button>
          )}
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
        <div className="titlebar-right">
          {!api.desktop && (
            <span className="preview-label">
              <LuMonitor />
              {t("shell.livePreview")}
            </span>
          )}
          {api.desktop && boot?.platform !== "darwin" && (
            <div className="window-controls">
              <button
                aria-label="Minimize window"
                onClick={() => api.window.minimize()}
              >
                <LuMinus />
              </button>
              <button
                aria-label={maximized ? "Restore window" : "Maximize window"}
                onClick={() => api.window.maximize()}
              >
                {maximized ? <LuCopy /> : <LuSquare />}
              </button>
              <button
                aria-label="Close window"
                className="window-close"
                onClick={() => api.window.close()}
              >
                <LuX />
              </button>
            </div>
          )}
        </div>
      </header>
      {boot ? (
        <>
          <div className="app-body">
            <Sidebar bridge={bridge} version={boot.version} />
            <main className="main-content" id="main-content">
              {!api.desktop && (
                <div className="preview-strip">
                  <LuMonitor />
                  {t("shell.sandbox")}
                </div>
              )}
              {requests.length > 0 && (
                <div className="browser-request">
                  <LuLink />
                  <div>
                    <strong>
                      {t("shell.mediaReceived", {
                        source: requests[0].source,
                      })}
                    </strong>
                    <span>{requests[0].url}</span>
                  </div>
                  <Button variant="primary" onClick={() => review(requests[0])}>
                    {t("shell.analyzePage")}
                  </Button>
                  <IconButton
                    label={t("shell.dismissRequest")}
                    onClick={() => {
                      const request = requests[0];
                      useUIStore.getState().removeRequest(request.id);
                      api
                        .invoke("browser:ack-request", request.id)
                        .catch(() => {});
                    }}
                  >
                    <LuX />
                  </IconButton>
                </div>
              )}
              {downloadTabs.map(
                (id) =>
                  (visited.has(id) || tab === id) && (
                    <div
                      className="page-slot"
                      hidden={tab !== id}
                      key={id}
                      aria-hidden={tab !== id}
                    >
                      <DownloadsPage filter={id} />
                    </div>
                  ),
              )}
              {(visited.has("media") || tab === "media") && (
                <div className="page-slot" hidden={tab !== "media"}>
                  <MediaPage tools={boot.tools} />
                </div>
              )}
              {(visited.has("browser") || tab === "browser") && (
                <div className="page-slot" hidden={tab !== "browser"}>
                  <BrowserPage />
                </div>
              )}
              {(visited.has("themes") || tab === "themes") && (
                <div className="page-slot" hidden={tab !== "themes"}>
                  <ThemesPage />
                </div>
              )}
              {(visited.has("settings") || tab === "settings") && (
                <div className="page-slot" hidden={tab !== "settings"}>
                  <SettingsPage
                    capabilities={boot.capabilities}
                    version={boot.version}
                  />
                </div>
              )}
            </main>
          </div>
          <footer className="statusbar">
            <div>
              <span
                className={`live-dot ${downloads.some(active) ? "live" : ""}`}
              />
              {downloads.some(active)
                ? t("shell.activeTransfers", {
                    count: downloads.filter(active).length,
                  })
                : t("shell.ready")}
              <span className="status-separator">/</span>
              <span>
                {t("shell.queued", {
                  count: downloads.filter((item) => item.status === "queued")
                    .length,
                })}
              </span>
            </div>
            <div>
              <LuArrowDown />
              {speed > 0 ? `${bytes(speed)}/s` : "0 B/s"}
              <span className="status-separator">/</span>
              <span>
                {t("shell.storedLocally")} · {boot.version}
              </span>
            </div>
          </footer>
        </>
      ) : (
        <div className="startup-screen">
          <div className="startup-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span
              className="brand-wordmark"
              role="img"
              aria-label="GetANNY"
            />
          </div>
          <h1 className="visually-hidden">GetANNY</h1>
          {error ? (
            <>
              <p className="error-text">{error}</p>
              <Button icon={LuRefreshCw} onClick={load}>
                {t("shell.tryAgain")}
              </Button>
            </>
          ) : (
            <>
              <LuLoaderCircle className="spin" />
              <p>{t("shell.opening")}</p>
            </>
          )}
        </div>
      )}
      {addModal && (
        <AddDownloadDialog initial={addModal} onClose={closeAdd} />
      )}
      {detail && (
        <DownloadDetails
          item={detail}
          onClose={() => useUIStore.getState().setDetails(null)}
        />
      )}
      <Toasts />
    </div>
  );
}
