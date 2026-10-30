import en from "../../shared/locales/en.json";
import ar from "../../shared/locales/ar.json";
import fr from "../../shared/locales/fr.json";
import es from "../../shared/locales/es.json";
import languages from "../../shared/languages.json";

const resources = { en, ar, fr, es };

export { languages };

export const isRtl = (code) =>
  languages.find((language) => language.code === code)?.dir === "rtl";

export function translate(code, key, values = {}) {
  const table = resources[code] || resources.en;
  // Fallback to English keeps newly added strings readable instead of showing
  // raw translation keys when a locale has not caught up yet.
  const template = table[key] ?? resources.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : match,
  );
}
