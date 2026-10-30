import React, { useEffect, useRef, useState } from "react";
import { LuCheck, LuChevronDown, LuMonitor, LuPalette } from "react-icons/lu";
import { errorMessage } from "../api";
import useSettingsStore from "../stores/useSettingsStore";
import useUIStore from "../stores/useUIStore";
import { themes } from "../utils/theme";

export default function ThemeSwitcher() {
  const selected = useSettingsStore(
    (state) => state.settings.theme || "graphite",
  );
  const save = useSettingsStore((state) => state.save);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const current = themes.find((theme) => theme.id === selected);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const key = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const choose = async (theme) => {
    setBusy(true);
    try {
      await save("theme", theme);
      setOpen(false);
    } catch (error) {
      useUIStore.getState().notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="theme-quick-button"
        aria-label={`Theme: ${selected === "system" ? "System" : current?.name || "Graphite"}. Change theme`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LuPalette />
        <span className="theme-quick-name">
          {selected === "system" ? "System" : current?.name || "Graphite"}
        </span>
        <LuChevronDown className="theme-chevron" />
      </button>
      {open && (
        <div className="theme-quick-menu" role="menu" aria-label="Choose theme">
          <div className="theme-menu-heading">
            <span>APPEARANCE</span>
            <button
              type="button"
              onClick={() => useUIStore.getState().setActiveTab("themes")}
            >
              View gallery
            </button>
          </div>
          <div className="theme-menu-list">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected === "system"}
              disabled={busy}
              onClick={() => choose("system")}
            >
              <span className="theme-system-icon">
                <LuMonitor />
              </span>
              <span>System</span>
              {selected === "system" && <LuCheck />}
            </button>
            {themes.map((theme) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected === theme.id}
                disabled={busy}
                key={theme.id}
                onClick={() => choose(theme.id)}
              >
                <span className="theme-mini-swatches" aria-hidden>
                  {[
                    theme.colors["--bg"],
                    theme.colors["--panel"],
                    theme.colors["--accent"],
                  ].map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <span>{theme.name}</span>
                {selected === theme.id && <LuCheck />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
