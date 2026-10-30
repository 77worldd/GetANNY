import React, { useEffect, useRef, useState } from "react";
import { LuCheck, LuChevronDown, LuLanguages } from "react-icons/lu";
import { errorMessage } from "../api";
import useSettingsStore from "../stores/useSettingsStore";
import useUIStore from "../stores/useUIStore";
import { languages } from "../i18n";
import { useI18n } from "../i18n/useI18n";

export default function LanguageSwitcher() {
  const { t, language } = useI18n();
  const save = useSettingsStore((state) => state.save);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const current = languages.find((item) => item.code === language);

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

  const choose = async (code) => {
    setBusy(true);
    try {
      await save("language", code);
      setOpen(false);
    } catch (error) {
      useUIStore.getState().notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="theme-switcher language-switcher" ref={ref}>
      <button
        type="button"
        className="theme-quick-button"
        aria-label={`${t("shell.chooseLanguage")}. ${current?.name || "English"}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LuLanguages />
        <span className="theme-quick-name">{current?.label || "EN"}</span>
        <LuChevronDown className="theme-chevron" />
      </button>
      {open && (
        <div
          className="theme-quick-menu language-quick-menu"
          role="menu"
          aria-label={t("shell.languageMenu")}
        >
          <div className="theme-menu-heading">
            <span>{t("shell.languageMenu").toUpperCase()}</span>
          </div>
          <div className="theme-menu-list">
            {languages.map((item) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={language === item.code}
                disabled={busy}
                key={item.code}
                onClick={() => choose(item.code)}
              >
                <span className="language-code">{item.label}</span>
                <span className="language-name">{item.name}</span>
                {language === item.code && <LuCheck />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
