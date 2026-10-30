import React, { useCallback, useEffect, useState } from "react";
import {
  LuArrowRight,
  LuCheck,
  LuCircleCheck,
  LuCopy,
  LuExternalLink,
  LuFolderOpen,
  LuGlobe,
  LuKeyRound,
  LuLink,
  LuRefreshCw,
  LuShieldCheck,
  LuCircleHelp,
  LuChevronRight,
  LuMonitor,
  LuPlug,
  LuSearch,
} from "react-icons/lu";
import { FaChrome, FaFirefoxBrowser, FaOpera, FaEdge } from "react-icons/fa6";
import { SiBrave, SiVivaldi } from "react-icons/si";
import { api, errorMessage } from "../api";
import { Button, ErrorBanner, IconButton, PageHeader } from "../components/ui";
import useUIStore from "../stores/useUIStore";
import useSettingsStore from "../stores/useSettingsStore";
const browserIcons = {
  chrome: FaChrome,
  chromium: FaChrome,
  brave: SiBrave,
  firefox: FaFirefoxBrowser,
  vivaldi: SiVivaldi,
  opera: FaOpera,
  edge: FaEdge,
  helium: LuGlobe,
};
export default function BrowserPage() {
  const settings = useSettingsStore((state) => state.settings),
    save = useSettingsStore((state) => state.save);
  const [info, setInfo] = useState(null),
    [selected, setSelected] = useState(settings.preferredBrowser || "chrome"),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState(null),
    [pairing, setPairing] = useState("");
  const refresh = useCallback(async (visible = false) => {
    if (visible) setRefreshing(true);
    try {
      setInfo(await api.invoke("browser:status"));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      if (visible) setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    const cleanup = api.on("browser:changed", () => refresh());
    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, [refresh]);
  const browser = info?.browsers.find((item) => item.id === selected);
  const Icon = browserIcons[selected] || LuGlobe;
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      const value = await action();
      await refresh();
      return value;
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const prepare = () =>
    run(async () => {
      const result = await api.invoke("browser:prepare", selected);
      setPrepared(result);
      await save("preferredBrowser", selected);
      useUIStore
        .getState()
        .notify(
          "Extension prepared and native host registered. Browser installation still needs your approval.",
        );
    });
  const copy = (text) =>
    navigator.clipboard.writeText(text).then(
      () => useUIStore.getState().notify("Copied to clipboard."),
      () =>
        useUIStore
          .getState()
          .notify(
            "Clipboard access was denied. Select and copy the text manually.",
            "error",
          ),
    );
  const packagePath =
    prepared?.browserId === selected
      ? prepared.path
      : browser?.prepared
        ? browser.packagePath
        : null;
  return (
    <div className="page browser-page">
      <PageHeader
        eyebrow="CONNECTED WORKFLOW"
        title="Browser integration"
        description="Bring download links from your browser straight to your desktop."
      >
        <Button
          icon={LuRefreshCw}
          busy={refreshing}
          onClick={() => refresh(true)}
        >
          Refresh status
        </Button>
      </PageHeader>
      {!settings.firstRunCompleted && (
        <section className="onboarding">
          <div className="onboarding-mark">
            <LuPlug />
          </div>
          <div>
            <span className="eyebrow">WELCOME TO GETANNY</span>
            <h2>A smoother way to bring it all in.</h2>
            <p>
              Connect your browser once. Send files with a right-click, or
              analyze a media page without copying links back and forth.
            </p>
            <div className="onboarding-points">
              <span>
                <LuCheck />
                Your choice of browser
              </span>
              <span>
                <LuCheck />
                Local, authenticated connection
              </span>
              <span>
                <LuCheck />
                You approve every install
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              save("firstRunCompleted", true).catch((error) =>
                setError(errorMessage(error)),
              )
            }
          >
            I’ll set this up later <LuArrowRight />
          </Button>
        </section>
      )}
      {!api.desktop && (
        <div className="notice">
          <LuMonitor />
          <span>
            This is a live web preview of the real download engine. Browser
            registration and installation require the Windows desktop
            application; no browser connection is being simulated.
          </span>
        </div>
      )}
      {!settings.browserIntegrationEnabled && (
        <div className="notice warning">
          <LuCircleHelp />
          <span>
            Browser integration is disabled in Settings. The desktop service
            will reject extension requests until you enable it.
          </span>
          <Button
            variant="ghost"
            onClick={() => useUIStore.getState().setActiveTab("settings")}
          >
            Open settings
          </Button>
        </div>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="bridge-health">
        <div>
          <span
            className={`live-dot ${info?.websocket.running && info?.websocket.enabled ? "live" : ""}`}
          />
          <span>Desktop bridge</span>
          <strong>
            {info
              ? info.websocket.running && info.websocket.enabled
                ? "Listening"
                : info.websocket.enabled
                  ? "Offline"
                  : "Disabled"
              : "Checking…"}
          </strong>
        </div>
        <span className="mono">127.0.0.1:{info?.websocket.port || 29615}</span>
        <div>
          <LuShieldCheck />
          <span>
            {info?.websocket.clients || 0} verified{" "}
            {info?.websocket.clients === 1 ? "connection" : "connections"}
          </span>
        </div>
      </div>
      {info?.websocket.error && (
        <ErrorBanner>{info.websocket.error}</ErrorBanner>
      )}
      <div className="browser-workspace">
        <section className="browser-picker">
          <div className="panel-heading">
            <h2>Your browsers</h2>
            <span>SELECT ONE</span>
          </div>
          {info ? (
            info.browsers.map((item) => {
              const BrowserIcon = browserIcons[item.id];
              return (
                <button
                  key={item.id}
                  className={`browser-option ${selected === item.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelected(item.id);
                    setError("");
                    setPrepared(null);
                  }}
                >
                  <span className={`browser-logo ${item.id}`}>
                    <BrowserIcon />
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.connected
                        ? "Connection verified"
                        : item.installed
                          ? "Browser detected"
                          : "Not detected"}
                    </small>
                  </div>
                  {item.connected ? (
                    <LuCircleCheck className="success-text" />
                  ) : selected === item.id ? (
                    <LuChevronRight />
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="skeleton-stack" aria-label="Detecting browsers">
              {[1, 2, 3, 4, 5, 6, 7].map((key) => (
                <div className="skeleton" key={key} />
              ))}
            </div>
          )}
          <p>
            Detection checks executable paths, not your personal browsing data.
            Portable installations can be located manually.
          </p>
        </section>
        <section className="browser-setup">
          <div className="browser-setup-heading">
            <span className={`browser-logo large ${selected}`}>
              <Icon />
            </span>
            <div>
              <h2>Connect {browser?.name || "your browser"}</h2>
              <p>
                {browser?.connected
                  ? `Verified over ${browser.transport === "native" ? "Native Messaging" : "paired WebSocket"}. The extension is enabled and talking to this app.`
                  : "Three straightforward steps. No silent installation, no security bypasses."}
              </p>
            </div>
          </div>
          <div
            className={`setup-step ${browser?.prepared && browser?.registered ? "done" : ""}`}
          >
            <span className="step-number">
              {browser?.prepared && browser?.registered ? <LuCheck /> : "1"}
            </span>
            <div className="step-content">
              <h3>Prepare the connection</h3>
              <p>
                Get the compatible extension files and register the native
                messaging host for your Windows user.
              </p>
              <div className="step-actions">
                <Button
                  variant="primary"
                  icon={LuPlug}
                  busy={busy}
                  disabled={!api.desktop || !settings.browserIntegrationEnabled}
                  onClick={prepare}
                >
                  {browser?.prepared && browser?.registered
                    ? "Refresh setup files"
                    : `Set up ${browser?.name || "browser"}`}
                </Button>
                <span className="step-result">
                  {browser?.registered ? (
                    <>
                      <LuCheck />
                      Host registered
                    </>
                  ) : (
                    "No administrator access required"
                  )}
                </span>
              </div>
              {packagePath && (
                <div className="path-box">
                  <code>{packagePath}</code>
                  <IconButton
                    label="Copy extension folder"
                    onClick={() => copy(packagePath)}
                  >
                    <LuCopy />
                  </IconButton>
                  <IconButton
                    label="Open extension folder"
                    disabled={!api.desktop}
                    onClick={() =>
                      run(() => api.invoke("browser:open-package", selected))
                    }
                  >
                    <LuFolderOpen />
                  </IconButton>
                </div>
              )}
            </div>
          </div>
          <div className={`setup-step ${browser?.connected ? "done" : ""}`}>
            <span className="step-number">
              {browser?.connected ? <LuCheck /> : "2"}
            </span>
            <div className="step-content">
              <h3>Add the extension in your browser</h3>
              {selected === "firefox" ? (
                <p>
                  In <code>about:debugging</code>, choose{" "}
                  <b>This Firefox → Load Temporary Add-on</b> and select{" "}
                  <code>manifest.json</code>. This unsigned development install
                  lasts until Firefox restarts. Permanent installs require a
                  Mozilla-signed XPI.
                </p>
              ) : (
                <p>
                  Open{" "}
                  <code>
                    {browser?.extensionsPage || "chrome://extensions"}
                  </code>
                  , turn on <b>Developer mode</b>, choose <b>Load unpacked</b>,
                  and select the prepared folder. Approve the extension
                  permissions.
                </p>
              )}
              <div className="step-actions">
                <Button
                  icon={LuExternalLink}
                  disabled={!api.desktop || !browser?.installed}
                  onClick={() =>
                    run(() => api.invoke("browser:open-extensions", selected))
                  }
                >
                  Open extensions page
                </Button>
                {api.desktop && !browser?.installed && (
                  <Button
                    variant="ghost"
                    icon={LuSearch}
                    onClick={() =>
                      run(() => api.invoke("browser:locate", selected))
                    }
                  >
                    Locate browser
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div
            className={`setup-step last ${browser?.connected ? "done" : ""}`}
          >
            <span className="step-number">
              {browser?.connected ? <LuCheck /> : "3"}
            </span>
            <div className="step-content">
              <h3>Verify a real connection</h3>
              <p>
                Pin GetANNY in the browser toolbar, open its popup, and click{" "}
                <b>Reconnect</b>. A handshake—not a copied folder—is what marks
                a connection verified.
              </p>
              <div
                className={`verification ${browser?.connected ? "verified" : ""}`}
              >
                <LuShieldCheck />
                <div>
                  <strong>
                    {browser?.connected
                      ? "Connected and verified"
                      : "Waiting for extension handshake"}
                  </strong>
                  <small>
                    {browser?.connected
                      ? "Ready to send downloads and media pages."
                      : browser?.lastSeen
                        ? `Last verified ${new Date(browser.lastSeen).toLocaleString()}. Installed / enabled state is currently unknown.`
                        : "Extension installed / enabled state is unknown until it connects."}
                  </small>
                </div>
              </div>
              {browser?.connected && !settings.firstRunCompleted && (
                <Button
                  icon={LuArrowRight}
                  variant="primary"
                  onClick={() =>
                    run(async () => {
                      await save("firstRunCompleted", true);
                      useUIStore.getState().setActiveTab("all");
                    })
                  }
                >
                  Start downloading
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
      <details className="pairing-panel">
        <summary>
          <LuKeyRound />
          <span>Need an alternative connection?</span>
          <LuChevronRight />
        </summary>
        <div>
          <p>
            If a browser cannot locate its native host, use the authenticated
            local WebSocket fallback. In the extension’s{" "}
            <b>Connection & pairing</b> panel, select your browser and paste
            this key. Keep GetANNY running. Treat the key like a password.
          </p>
          {pairing ? (
            <div className="path-box">
              <code className="pairing-secret">{pairing}</code>
              <Button icon={LuCopy} onClick={() => copy(pairing)}>
                Copy key
              </Button>
            </div>
          ) : (
            <Button
              icon={LuKeyRound}
              onClick={() =>
                run(async () =>
                  setPairing(await api.invoke("browser:pairing-key")),
                )
              }
            >
              Reveal my pairing key
            </Button>
          )}
          <p className="muted">
            A prepared package is not an installed extension. A registered host
            is not proof of a connection. Helium, Brave, Vivaldi, Opera and
            Chromium use the shared Chromium build; Firefox has a separate
            manifest.
          </p>
        </div>
      </details>
    </div>
  );
}
