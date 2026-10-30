import React, { useState } from "react";
import { LuCheck, LuMonitor, LuMoon, LuPalette, LuSun } from "react-icons/lu";
import { errorMessage } from "../api";
import { ErrorBanner, PageHeader } from "../components/ui";
import useSettingsStore from "../stores/useSettingsStore";
import { themes } from "../utils/theme";
import { useI18n } from "../i18n/useI18n";

function Preview({ theme }) {
  const c = theme.colors;
  return (
    <div
      className="theme-preview"
      style={{ background: c["--bg"], borderColor: c["--line"] }}
      aria-hidden
    >
      <div
        className="theme-preview-sidebar"
        style={{ background: c["--sidebar"], borderColor: c["--line-soft"] }}
      >
        <i style={{ background: c["--accent"] }} />
        <span style={{ background: c["--line"] }} />
        <span style={{ background: c["--line"] }} />
        <span style={{ background: c["--line"] }} />
      </div>
      <div className="theme-preview-content">
        <div className="theme-preview-title">
          <span style={{ background: c["--text"] }} />
          <i style={{ background: c["--accent"] }} />
        </div>
        <div
          className="theme-preview-panel"
          style={{ background: c["--panel"], borderColor: c["--line"] }}
        >
          <span style={{ background: c["--raised"] }} />
          <span style={{ background: c["--raised"] }} />
          <div style={{ background: c["--accent-soft"] }}>
            <i style={{ background: c["--accent"] }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThemesPage() {
  const { t } = useI18n();
  const selected = useSettingsStore(
    (state) => state.settings.theme || "graphite",
  );
  const save = useSettingsStore((state) => state.save);
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const choose = async (id) => {
    if (id === selected) return;
    setSaving(id);
    setError("");
    try {
      await save("theme", id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving("");
    }
  };
  const visible = themes.filter(
    (theme) => filter === "all" || theme.mode === filter,
  );
  return (
    <div className="page themes-page">
      <PageHeader
        eyebrow={t("themes.eyebrow")}
        title={t("themes.title")}
        description={t("themes.description")}
      >
        <span className="theme-count">
          <LuPalette /> {t("themes.count", { count: themes.length })}
        </span>
      </PageHeader>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="theme-toolbar">
        <div
          className="theme-filters"
          role="group"
          aria-label={t("common.filterThemes")}
        >
          {[
            ["all", LuPalette, t("common.allThemes")],
            ["dark", LuMoon, t("common.dark")],
            ["light", LuSun, t("common.light")],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <span>{t("themes.appliedNote")}</span>
      </div>
      {filter === "all" && (
        <button
          className={`system-theme-card ${selected === "system" ? "selected" : ""}`}
          onClick={() => choose("system")}
          disabled={!!saving}
        >
          <span className="system-theme-icon">
            <LuMonitor />
          </span>
          <span>
            <strong>{t("themes.systemTitle")}</strong>
            <small>{t("themes.systemHint")}</small>
          </span>
          <span className="theme-selected-label">
            {selected === "system" ? (
              <>
                <LuCheck /> {t("common.selected")}
              </>
            ) : (
              t("themes.automatic")
            )}
          </span>
        </button>
      )}
      <div className="theme-grid">
        {visible.map((theme) => (
          <button
            key={theme.id}
            className={`theme-card ${selected === theme.id ? "selected" : ""}`}
            onClick={() => choose(theme.id)}
            disabled={!!saving}
            aria-pressed={selected === theme.id}
            aria-label={`${saving === theme.id ? t("common.applying") : t("common.apply")} ${theme.name}`}
          >
            <Preview theme={theme} />
            <span className="theme-card-info">
              <span className="theme-card-title">
                <strong>{theme.name}</strong>
                <small>
                  {theme.mode === "dark" ? <LuMoon /> : <LuSun />}
                  {theme.mode}
                </small>
              </span>
              <span className="theme-description">{theme.description}</span>
              <span className="theme-card-footer">
                <span className="theme-swatches" aria-hidden>
                  {[
                    theme.colors["--bg"],
                    theme.colors["--raised"],
                    theme.colors["--accent"],
                    theme.colors["--red"],
                  ].map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <span className="theme-selected-label">
                  {saving === theme.id ? (
                    t("common.applying")
                  ) : selected === theme.id ? (
                    <>
                      <LuCheck /> {t("common.selected")}
                    </>
                  ) : (
                    t("common.applyTheme")
                  )}
                </span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
