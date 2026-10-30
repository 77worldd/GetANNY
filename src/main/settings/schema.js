const path = require("node:path");
const THEMES = require("../../shared/themes.json").map((theme) => theme.id);
const BOOLEAN_KEYS = [
  "autoStartDownloads",
  "resumeOnStartup",
  "scheduleEnabled",
  "organizeByType",
  "confirmBrowserDownloads",
  "notifications",
  "closeToTray",
  "launchAtLogin",
  "startMinimized",
  "compactList",
  "reduceMotion",
  "browserIntegrationEnabled",
  "mediaIntegration",
  "firstRunCompleted",
];
const NUMBER_RULES = {
  maxConcurrentDownloads: [1, 12],
  maxConnectionsPerDownload: [1, 16],
  speedLimit: [0, 1024 ** 4],
  requestTimeoutSeconds: [5, 300],
  retryAttempts: [0, 5],
  retryDelaySeconds: [1, 120],
  scheduleStartMinute: [0, 1439],
  scheduleEndMinute: [0, 1439],
};
const BROWSERS = [
  "helium",
  "chrome",
  "chromium",
  "brave",
  "firefox",
  "vivaldi",
  "opera",
  "edge",
];
function defaults(downloadPath) {
  return {
    defaultDownloadPath: downloadPath,
    maxConcurrentDownloads: 3,
    maxConnectionsPerDownload: 8,
    speedLimit: 0,
    requestTimeoutSeconds: 30,
    retryAttempts: 2,
    retryDelaySeconds: 3,
    autoStartDownloads: true,
    resumeOnStartup: false,
    scheduleEnabled: false,
    scheduleStartMinute: 0,
    scheduleEndMinute: 360,
    organizeByType: false,
    confirmBrowserDownloads: true,
    notifications: true,
    closeToTray: true,
    launchAtLogin: false,
    startMinimized: false,
    theme: "graphite",
    compactList: false,
    reduceMotion: false,
    animationMode: "standard",
    browserIntegrationEnabled: true,
    mediaIntegration: true,
    firstRunCompleted: false,
    preferredBrowser: "chrome",
  };
}
function validateSetting(key, value) {
  if (BOOLEAN_KEYS.includes(key)) {
    if (typeof value !== "boolean")
      throw new Error(`${key} must be on or off.`);
  } else if (NUMBER_RULES[key]) {
    const [min, max] = NUMBER_RULES[key];
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw new Error(
        `${key} must be a whole number between ${min} and ${max}.`,
      );
  } else if (key === "defaultDownloadPath") {
    if (
      typeof value !== "string" ||
      !path.isAbsolute(value) ||
      value.includes("\0")
    )
      throw new Error("Select an absolute download folder path.");
  } else if (key === "theme") {
    if (![...THEMES, "system"].includes(value))
      throw new Error("Choose a supported theme.");
  } else if (key === "animationMode") {
    if (!["standard", "reduced", "disabled"].includes(value))
      throw new Error("Choose a supported animation mode.");
  } else if (key === "preferredBrowser") {
    if (!BROWSERS.includes(value))
      throw new Error("Choose a supported browser.");
  } else throw new Error(`Unknown preference: ${key}`);
  return value;
}
module.exports = { defaults, validateSetting, BROWSERS };
