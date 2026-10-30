import catalog from "../../shared/themes.json";

export const themes = catalog;
let applied = false;
let transitionTimer;

export function themeById(id) {
  return themes.find((theme) => theme.id === id) || themes[0];
}

export function resolveTheme(id, light = false) {
  return id === "system"
    ? themeById(light ? "porcelain" : "nord")
    : themeById(id);
}

export function applyTheme(id) {
  const root = document.documentElement;
  const systemLight =
    id === "system" &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = resolveTheme(id, systemLight);
  if (
    applied &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    root.classList.add("theme-transition");
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(
      () => root.classList.remove("theme-transition"),
      200,
    );
  }
  for (const [token, value] of Object.entries(theme.colors))
    root.style.setProperty(token, value);
  root.dataset.theme = id;
  root.dataset.themeResolved = theme.id;
  root.style.colorScheme = theme.mode;
  applied = true;
  return theme;
}
