const { autoUpdater } = require("electron-updater");
function configureAutoUpdater({ mainWindow, logger = console } = {}) {
  autoUpdater.autoDownload = false;
  autoUpdater.on("checking-for-update", () =>
    mainWindow()?.webContents.send("update:status", { status: "checking" }),
  );
  autoUpdater.on("update-available", (info) =>
    mainWindow()?.webContents.send("update:status", {
      status: "available",
      version: info.version,
    }),
  );
  autoUpdater.on("update-not-available", () =>
    mainWindow()?.webContents.send("update:status", { status: "current" }),
  );
  autoUpdater.on("error", (error) =>
    logger.error("Update check failed", error),
  );
  return {
    check: () => autoUpdater.checkForUpdates(),
    download: () => autoUpdater.downloadUpdate(),
    install: () => autoUpdater.quitAndInstall(),
  };
}
module.exports = { configureAutoUpdater };
