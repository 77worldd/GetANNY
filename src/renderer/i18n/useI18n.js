import { useMemo } from "react";
import useSettingsStore from "../stores/useSettingsStore";
import { isRtl, languages, translate } from ".";

export function useI18n() {
  const language = useSettingsStore(
    (state) => state.settings.language || "en",
  );
  return useMemo(
    () => ({
      language,
      languages,
      rtl: isRtl(language),
      t: (key, values) => translate(language, key, values),
    }),
    [language],
  );
}
