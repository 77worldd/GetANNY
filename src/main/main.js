const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  Notification,
  nativeImage,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { setupIpcHandlers } = require("./ipc-handlers");
const { createTray } = require("./tray");
const { shouldRevealOnActivation } = require("./tray-window");
const { createMenu } = require("./menu");
const { Logger } = require("./utils/logger");
const { validateUrl } = require("./engine/utils");
const {
  clearDesktopExitMarker,
  desktopExitMarkerPath,
  isDesktopExitMarked,
  markDesktopExited,
} = require("./browser-integration/DesktopExitMarker");
const log = new Logger("Main");
let win,
  services,
  tray,
  exiting = false,
  hiddenToTray = false,
  shutdownFinished = false;
if (process.platform === "win32") app.setAppUserModelId("com.getanny.app");
const selfTest = process.argv.includes("--self-test");
if (selfTest) app.disableHardwareAcceleration();
const setupOnly = process.argv.includes("--setup-browser-hosts");
const unregisterOnly = process.argv.includes("--unregister-browser-hosts");
const testDataIndex = process.argv.indexOf("--test-user-data");
if (testDataIndex >= 0 && process.argv[testDataIndex + 1])
  app.setPath("userData", path.resolve(process.argv[testDataIndex + 1]));
function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}
function showWindow() {
  if (win) {
    hiddenToTray = false;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    show: false,
    frame: process.platform === "darwin",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    title: "GetANNY",
    icon: path.resolve(__dirname, "../../assets/icon.png"),
    backgroundColor: "#101418",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      shell.openExternal(validateUrl(url));
    } catch (error) {
      log.warn(error.message);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault();
      try {
        shell.openExternal(validateUrl(url));
      } catch {
        /* unsupported navigation */
      }
    }
  });
  win.webContents.on("before-input-event", (event, input) => {
    if ((input.control || input.meta) && input.type === "keyDown") {
      if (input.key.toLowerCase() === "n") {
        event.preventDefault();
        send("menu:add-download");
      }
      if (input.key === ",") {
        event.preventDefault();
        send("menu:settings");
      }
    }
  });
  win.on("maximize", () => send("window:state", { maximized: true }));
  win.on("unmaximize", () => send("window:state", { maximized: false }));
  win.on("hide", () => {
    hiddenToTray = true;
  });
  win.on("show", () => {
    hiddenToTray = false;
  });
  win.on("close", (event) => {
    if (!exiting && services.settings.get("closeToTray") && tray && !selfTest) {
      event.preventDefault();
      hiddenToTray = true;
      win.hide();
    }
  });
  win.on("closed", () => {
    win = null;
  });
  if (app.isPackaged || selfTest)
    await win.loadFile(
      path.resolve(__dirname, "../../dist-renderer/index.html"),
    );
  else await win.loadURL("http://127.0.0.1:5173");
  if (
    !services.settings.get("startMinimized") ||
    selfTest ||
    process.argv.includes("--from-browser")
  )
    win.show();
  else if (tray) win.hide();
  else {
    win.show();
    win.minimize();
  }
}
async function recordOperationStage(stage, detail = {}) {
  if (!setupOnly && !unregisterOnly) return;
  const index = process.argv.indexOf("--report");
  const report = index >= 0 ? process.argv[index + 1] : null;
  if (!report) return;
  const file = path.resolve(report);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify(
      {
        passed: stage === "complete",
        operation: setupOnly ? "setup" : "unregister",
        stage,
        date: new Date().toISOString(),
        ...detail,
      },
      null,
      2,
    ),
  );
}
async function init() {
  await recordOperationStage("init");
  const { createServices } = require("./services");
  await recordOperationStage("services-module-loaded");
  const userDataPath = app.getPath("userData");
  const binPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.resolve(__dirname, "../../bin");
  const extensionPath = app.isPackaged
    ? path.join(process.resourcesPath, "extension")
    : path.resolve(__dirname, "../../dist-extension");
  services = await createServices({
    userDataPath,
    downloadPath: app.getPath("downloads"),
    binPath,
    extensionPath,
    appPath: process.execPath,
    isPackaged: app.isPackaged,
    nativeImage,
    port: selfTest ? 0 : 29615,
    startTransfers: !setupOnly && !unregisterOnly,
    onSettingChange: async (key, value) => {
      if (key === "launchAtLogin") {
        if (!["win32", "darwin"].includes(process.platform) && value)
          throw new Error("Launch at login is supported on Windows and macOS.");
        if (["win32", "darwin"].includes(process.platform))
          app.setLoginItemSettings({
            openAtLogin: value,
            path: process.execPath,
          });
      }
    },
    onBrowserRequest: () => showWindow(),
  });
  await recordOperationStage("services-created");
  if (unregisterOnly) {
    const result = await services.nativeMessagingHost.unregisterAll();
    await recordOperationStage("hosts-unregistered");
    await fs.rm(path.join(userDataPath, "extensions"), {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 150,
    });
    if (["win32", "darwin"].includes(process.platform))
      app.setLoginItemSettings({ openAtLogin: false });
    await services.close();
    await recordOperationStage("services-closed");
    await fs.writeFile(
      path.join(userDataPath, "browser-uninstall-report.json"),
      JSON.stringify(
        {
          passed: result.removed,
          date: new Date().toISOString(),
          nativeFilesRemoved: result.removed,
          extensionFilesRemoved: true,
          errors: result.errors,
        },
        null,
        2,
      ),
    );
    await recordOperationStage("complete", { succeeded: result.removed });
    app.exit(result.removed ? 0 : 1);
    return;
  }
  if (setupOnly) {
    const result = await services.setupInstalledBrowsers(recordOperationStage);
    await recordOperationStage("browsers-prepared", {
      browsers: result.length,
    });
    await services.close();
    await recordOperationStage("services-closed");
    await recordOperationStage("complete", {
      succeeded: !result.some((value) => value.error),
    });
    app.exit(result.some((value) => value.error) ? 1 : 0);
    return;
  }
  if (
    !selfTest &&
    testDataIndex < 0 &&
    ["win32", "darwin"].includes(process.platform)
  )
    app.setLoginItemSettings({
      openAtLogin: services.settings.get("launchAtLogin"),
      path: process.execPath,
    });
  services.events.on("event", send);
  services.events.on("event", (channel, data) => {
    if (
      channel === "download:complete" &&
      services.settings.get("notifications") &&
      Notification.isSupported() &&
      !selfTest
    ) {
      const item = services.manager.requireItem(data.id);
      const notification = new Notification({
        title: "Download complete",
        body: item.filename,
        icon: path.resolve(__dirname, "../../assets/icon.png"),
      });
      notification.on("click", showWindow);
      notification.show();
    }
  });
  setupIpcHandlers({
    ipcMain,
    services,
    desktop: { app, shell, dialog, mainWindow: () => win },
  });
  if (process.platform === "darwin") createMenu({ mainWindow: () => win });
  else Menu.setApplicationMenu(null);
  await createWindow();
  if (!selfTest) {
    try {
      tray = createTray({
        mainWindow: () => win,
        app,
        iconPath: path.resolve(__dirname, "../../assets/tray-icon.png"),
      });
    } catch (error) {
      log.warn("System tray unavailable:", error.message);
    }
  }
  if (selfTest) {
    const reportIndex = process.argv.indexOf("--report");
    const report = process.argv[reportIndex + 1];
    try {
      const result = await require("./self-test").runSelfTest({
        services,
        win,
        app,
        binPath,
        userDataPath,
      });
      await fs.mkdir(path.dirname(path.resolve(report)), { recursive: true });
      await fs.writeFile(report, JSON.stringify(result, null, 2));
      await services.close();
      shutdownFinished = true;
      app.exit(result.passed ? 0 : 1);
    } catch (error) {
      await fs.writeFile(
        report,
        JSON.stringify({ passed: false, error: error.stack }),
      );
      await services.close();
      shutdownFinished = true;
      app.exit(1);
    }
  }
  log.info("Ready", {
    version: app.getVersion(),
    bridge: services.wsServer.status(),
  });
}
if (
  !setupOnly &&
  !unregisterOnly &&
  !selfTest &&
  !app.requestSingleInstanceLock()
)
  app.quit();
else {
  app.on("second-instance", showWindow);
  app
    .whenReady()
    .then(async () => {
      const markerPath = desktopExitMarkerPath(app.getPath("userData"));
      const fromBrowser = process.argv.includes("--from-browser");
      if (fromBrowser && isDesktopExitMarked(markerPath)) {
        log.info("Browser launch ignored because GetANNY was explicitly closed.");
        app.exit(0);
        return;
      }
      if (!fromBrowser && !setupOnly && !unregisterOnly && !selfTest)
        clearDesktopExitMarker(markerPath);
      await init();
    })
    .catch(async (error) => {
      log.error(error);
      await recordOperationStage("error", { error: error.message }).catch(
        () => {},
      );
      if (unregisterOnly)
        await fs
          .writeFile(
            path.join(app.getPath("userData"), "browser-uninstall-report.json"),
            JSON.stringify(
              {
                passed: false,
                date: new Date().toISOString(),
                error: error.message,
              },
              null,
              2,
            ),
          )
          .catch(() => {});
      if (!setupOnly && !unregisterOnly && !selfTest)
        dialog.showErrorBox("GetANNY could not start", error.message);
      app.exit(1);
    });
  app.on("before-quit", (event) => {
    exiting = true;
    if (shutdownFinished || !services) return;
    event.preventDefault();
    if (services.closing) return;
    services.closing = true;
    if (!selfTest && !setupOnly && !unregisterOnly)
      markDesktopExited(desktopExitMarkerPath(app.getPath("userData")));
    services
      .close()
      .catch((error) => log.error("Shutdown:", error))
      .finally(() => {
        shutdownFinished = true;
        tray?.destroy();
        app.exit(0);
      });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (!shouldRevealOnActivation(hiddenToTray)) return;
    if (win) showWindow();
    else if (services) createWindow().catch((error) => log.error(error));
  });
}
process.on("uncaughtException", (error) => log.error(error));
process.on("unhandledRejection", (error) => log.error(error));
