import React, { useEffect, useState } from "react";
import {
  LuArrowDownToLine,
  LuFolderOpen,
  LuGlobe,
  LuSlidersHorizontal,
  LuCheck,
  LuRotateCcw,
  LuExternalLink,
  LuCircleHelp,
  LuMonitor,
  LuPalette,
} from "react-icons/lu";
import { api, errorMessage } from "../api";
import {
  Button,
  ConfirmDialog,
  ErrorBanner,
  PageHeader,
  Select,
  Switch,
} from "../components/ui";
import useSettingsStore from "../stores/useSettingsStore";
import useUIStore from "../stores/useUIStore";
function NumberControl({ value, onChange, min, max, label, suffix, disabled }) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => setDraft(String(value ?? "")), [value]);
  const commit = () => {
    const number = Number(draft);
    if (
      draft.trim() &&
      Number.isInteger(number) &&
      number >= min &&
      number <= max
    ) {
      if (number !== value) onChange(number);
    } else {
      setDraft(String(value));
      useUIStore
        .getState()
        .notify(
          `${label}: enter a whole number from ${min} to ${max}.`,
          "error",
        );
    }
  };
  return (
    <div className="number-control">
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step="1"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}
function ScheduleTime({ value, label, disabled, onChange }) {
  const minutes = Number.isInteger(value) ? value : 0;
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <input
      type="time"
      aria-label={label}
      value={time}
      disabled={disabled}
      onChange={(event) => {
        const match = /^(\d{2}):(\d{2})$/.exec(event.target.value);
        if (match) onChange(Number(match[1]) * 60 + Number(match[2]));
      }}
    />
  );
}
function SettingRow({ title, description, children, disabled = false }) {
  return (
    <div className={`setting-row ${disabled ? "unavailable" : ""}`}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
export default function SettingsPage({ capabilities, version }) {
  const settings = useSettingsStore((state) => state.settings),
    save = useSettingsStore((state) => state.save);
  const [section, setSection] = useState("downloads"),
    [saving, setSaving] = useState(""),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [reset, setReset] = useState(false);
  const persist = async (key, value) => {
    setSaving(key);
    setSaved(false);
    setError("");
    try {
      await save(key, value);
      setSaved(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving("");
    }
  };
  const toggle = (key) => (
    <Switch
      label={key}
      checked={!!settings[key]}
      onChange={(value) => persist(key, value)}
      disabled={!!saving}
    />
  );
  const number = (key, label, min, max, suffix) => (
    <NumberControl
      label={label}
      value={settings[key]}
      min={min}
      max={max}
      suffix={suffix}
      disabled={!!saving}
      onChange={(value) => persist(key, value)}
    />
  );
  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="MAKE IT YOURS"
        title="Settings"
        description="Thoughtful defaults. Real controls. Saved automatically."
      >
        <span className="save-indicator">
          {saving ? (
            "Saving…"
          ) : saved ? (
            <>
              <LuCheck />
              Changes saved
            </>
          ) : (
            "Stored on this device"
          )}
        </span>
      </PageHeader>
      <nav className="settings-tabs" aria-label="Settings categories">
        {[
          ["downloads", LuArrowDownToLine, "Downloads"],
          ["storage", LuFolderOpen, "Storage"],
          ["browser", LuGlobe, "Browser"],
          ["application", LuSlidersHorizontal, "Application"],
        ].map(([key, Icon, label]) => (
          <button
            key={key}
            aria-current={section === key ? "page" : undefined}
            className={section === key ? "selected" : ""}
            onClick={() => setSection(key)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {section === "downloads" && (
        <>
          <section className="settings-panel">
            <div className="settings-section-heading">
              <h2>Transfer behavior</h2>
              <p>Choose how GetANNY starts, connects, and recovers.</p>
            </div>
            <SettingRow
              title="Start new downloads immediately"
              description="When off, new downloads are added in a paused state."
            >
              {toggle("autoStartDownloads")}
            </SettingRow>
            <SettingRow
              title="Maximum simultaneous downloads"
              description="One queue for file, media, and torrent downloads."
            >
              {number(
                "maxConcurrentDownloads",
                "Maximum simultaneous downloads",
                1,
                12,
              )}
            </SettingRow>
            <SettingRow
              title="Connections per file"
              description="Parallel HTTP ranges are used only when the server supports them. Applied on new or resumed transfers."
            >
              <Select
                aria-label="Connections per file"
                value={settings.maxConnectionsPerDownload}
                disabled={!!saving}
                onChange={(event) =>
                  persist(
                    "maxConnectionsPerDownload",
                    Number(event.target.value),
                  )
                }
              >
                {[1, 2, 4, 6, 8, 12, 16].map((value) => (
                  <option key={value} value={value}>
                    {value === 1
                      ? "1 · Single connection"
                      : `${value} connections`}
                  </option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow
              title="Resume paused downloads at startup"
              description="Otherwise interrupted transfers stay paused after a restart."
            >
              {toggle("resumeOnStartup")}
            </SettingRow>
          </section>
          <section className="settings-panel">
            <div className="settings-section-heading">
              <h2>Download schedule</h2>
              <p>
                Times use this device’s local time. Keep GetANNY running to
                start queued transfers.
              </p>
            </div>
            <SettingRow
              title="Schedule new transfers"
              description="Only start queued downloads during the daily window. Transfers already running may finish outside it."
            >
              {toggle("scheduleEnabled")}
            </SettingRow>
            <SettingRow
              title="Start time"
              description="The beginning of the daily start window."
            >
              <ScheduleTime
                label="Schedule start time"
                value={settings.scheduleStartMinute}
                disabled={!!saving || !settings.scheduleEnabled}
                onChange={(value) => persist("scheduleStartMinute", value)}
              />
            </SettingRow>
            <SettingRow
              title="End time"
              description="An earlier end time crosses midnight. Equal times allow starts all day."
            >
              <ScheduleTime
                label="Schedule end time"
                value={settings.scheduleEndMinute}
                disabled={!!saving || !settings.scheduleEnabled}
                onChange={(value) => persist("scheduleEndMinute", value)}
              />
            </SettingRow>
          </section>
          <section className="settings-panel">
            <div className="settings-section-heading">
              <h2>Bandwidth & recovery</h2>
              <p>
                Limits and connection preferences apply to new or resumed
                transfers.
              </p>
            </div>
            <SettingRow
              title="Per-download speed limit"
              description="Kilobytes per second (1 KB = 1024 bytes). 0 means unlimited. Shared across a file’s connections, not multiplied by them."
            >
              <NumberControl
                label="Per-download speed limit"
                min={0}
                max={1048576}
                suffix="KB/s"
                value={Math.round((settings.speedLimit || 0) / 1024)}
                disabled={!!saving}
                onChange={(value) => persist("speedLimit", value * 1024)}
              />
            </SettingRow>
            <SettingRow
              title="Connection timeout"
              description="Stop requests that are inactive for this many seconds."
            >
              {number(
                "requestTimeoutSeconds",
                "Connection timeout",
                5,
                300,
                "sec",
              )}
            </SettingRow>
            <SettingRow
              title="Automatic retries"
              description="Retry transient HTTP failures. Authentication, invalid ranges, and disk errors require attention."
            >
              {number("retryAttempts", "Automatic retries", 0, 5, "tries")}
            </SettingRow>
            <SettingRow
              title="Retry delay"
              description="Seconds before the first retry. Subsequent retries wait proportionally longer."
            >
              {number("retryDelaySeconds", "Retry delay", 1, 120, "sec")}
            </SettingRow>
          </section>
        </>
      )}
      {section === "storage" && (
        <section className="settings-panel">
          <div className="settings-section-heading">
            <h2>Files & organization</h2>
            <p>
              Your files stay yours. Removing history never silently deletes
              completed files.
            </p>
          </div>
          <SettingRow
            title="Default download folder"
            description={
              settings.defaultDownloadPath || "Choose a download location"
            }
          >
            <Button
              icon={LuFolderOpen}
              disabled={!capabilities.dialogs}
              busy={saving === "defaultDownloadPath"}
              onClick={async () => {
                try {
                  const folder = await api.invoke("dialog:select-folder");
                  if (folder) persist("defaultDownloadPath", folder);
                } catch (error) {
                  setError(errorMessage(error));
                }
              }}
            >
              Choose folder
            </Button>
          </SettingRow>
          {!capabilities.dialogs && (
            <div className="setting-preview-path">
              <label htmlFor="preview-path">Sandbox download path</label>
              <input
                id="preview-path"
                key={settings.defaultDownloadPath}
                defaultValue={settings.defaultDownloadPath}
                onBlur={(event) => {
                  if (event.target.value !== settings.defaultDownloadPath)
                    persist("defaultDownloadPath", event.target.value);
                }}
              />
              <small>
                The web preview uses a real isolated sandbox folder, not your
                personal Downloads directory.
              </small>
            </div>
          )}
          <SettingRow
            title="Organize files by type"
            description="For the default location, create Video, Audio, Archives, Documents, Images and Applications subfolders. Explicit destinations are unchanged."
          >
            {toggle("organizeByType")}
          </SettingRow>
          <SettingRow
            title="Application data"
            description="SQLite history, preferences, extension packages and diagnostics stay on this device."
          >
            <Button
              icon={LuExternalLink}
              disabled={!api.desktop}
              onClick={() =>
                api
                  .invoke("app:open-data-folder")
                  .catch((error) => setError(errorMessage(error)))
              }
            >
              Open data folder
            </Button>
          </SettingRow>
          <div className="settings-note">
            <LuCircleHelp />
            <span>
              Files with the same name are numbered instead of overwritten.
              Partial downloads are isolated by ID and are never shown as
              completed.
            </span>
          </div>
        </section>
      )}
      {section === "browser" && (
        <section className="settings-panel">
          <div className="settings-section-heading">
            <h2>Browser connection</h2>
            <p>
              Authenticated native messaging, with an explicitly paired local
              fallback.
            </p>
          </div>
          <SettingRow
            title="Enable browser integration"
            description="Allow connected extensions to send file and media requests. Turning off disconnects existing browser sessions."
          >
            {toggle("browserIntegrationEnabled")}
          </SettingRow>
          <SettingRow
            title="Review browser downloads"
            description="Ask for confirmation and a destination before adding browser file links to the queue."
          >
            {toggle("confirmBrowserDownloads")}
          </SettingRow>
          <SettingRow
            title="Accept media page requests"
            description="Open video and audio pages from the extension in Media studio, where you choose the format."
          >
            {toggle("mediaIntegration")}
          </SettingRow>
          <SettingRow
            title="Manage connected browsers"
            description="Prepare extension files, register the native host, and verify real connections."
          >
            <Button
              icon={LuGlobe}
              onClick={() => useUIStore.getState().setActiveTab("browser")}
            >
              Browser setup
            </Button>
          </SettingRow>
        </section>
      )}
      {section === "application" && (
        <>
          <section className="settings-panel">
            <div className="settings-section-heading">
              <h2>Appearance</h2>
              <p>A quieter workspace, tuned to your preferences.</p>
            </div>
            <SettingRow
              title="Color theme"
              description="Explore twelve coordinated palettes, or follow your operating system."
            >
              <Button
                icon={LuPalette}
                onClick={() => useUIStore.getState().setActiveTab("themes")}
              >
                Open theme gallery
              </Button>
            </SettingRow>
            <SettingRow
              title="Compact download rows"
              description="Fit more files in the library without hiding transfer information."
            >
              {toggle("compactList")}
            </SettingRow>
            <SettingRow
              title="Animations"
              description="Choose how much motion to show. Your system’s reduced-motion preference is always respected."
            >
              <Select
                aria-label="Animations"
                value={settings.animationMode || "standard"}
                disabled={!!saving}
                onChange={(event) =>
                  persist("animationMode", event.target.value)
                }
              >
                <option value="standard">Standard</option>
                <option value="reduced">Reduced</option>
                <option value="disabled">Disabled</option>
              </Select>
            </SettingRow>
          </section>
          <section className="settings-panel">
            <div className="settings-section-heading">
              <h2>Startup & notifications</h2>
              <p>
                Decide when GetANNY is present, and when it gets out of the way.
              </p>
            </div>
            <SettingRow
              title="Desktop completion notifications"
              description="Show an operating-system notification after a verified successful download."
            >
              {toggle("notifications")}
            </SettingRow>
            <SettingRow
              title="Close to system tray"
              description="Keep transfers running when the window closes. If a tray is unavailable, closing quits safely."
            >
              {toggle("closeToTray")}
            </SettingRow>
            <SettingRow
              title="Launch at login"
              description={
                capabilities.login
                  ? "Start GetANNY when you sign in to Windows or macOS."
                  : "Available in the installed Windows and macOS application."
              }
              disabled={!capabilities.login}
            >
              <Switch
                label="Launch at login"
                checked={!!settings.launchAtLogin}
                disabled={!capabilities.login || !!saving}
                onChange={(value) => persist("launchAtLogin", value)}
              />
            </SettingRow>
            <SettingRow
              title="Start minimized"
              description="Start in the tray when available, or minimize the window."
            >
              {toggle("startMinimized")}
            </SettingRow>
          </section>
        </>
      )}
      <div className="settings-bottom">
        <div className="about-app">
          <img src="./icon.png" alt="" />
          <div>
            <strong>
              GetANNY <span>{version}</span>
            </strong>
            <small>Reliable downloads. Clear control.</small>
          </div>
        </div>
        <Button
          variant="ghost"
          icon={LuRotateCcw}
          onClick={() => setReset(true)}
        >
          Reset preferences
        </Button>
      </div>
      {reset && (
        <ConfirmDialog
          title="Restore default preferences?"
          description="Your download history and files will stay untouched. Login behavior, theme and transfer preferences will return to defaults."
          label="Reset preferences"
          onClose={() => setReset(false)}
          onConfirm={async () => {
            const values = await api.invoke("settings:reset");
            useSettingsStore.getState().setSettings(values);
            setSaved(true);
          }}
        />
      )}
    </div>
  );
}
