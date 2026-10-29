const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const {
  getBrowser,
  browsers,
  CHROMIUM_ID,
  FIREFOX_ID,
  HOST_ID,
} = require("./catalog");
const exec = promisify(execFile);
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

class NativeMessagingHost {
  constructor({
    userDataPath,
    appPath = process.execPath,
    isPackaged = false,
    binPath,
    token,
    port = 29615,
    platform = process.platform,
    home = os.homedir(),
  } = {}) {
    Object.assign(this, {
      userDataPath,
      appPath,
      isPackaged,
      binPath,
      token,
      port,
      platform,
      home,
    });
    this.base = path.join(userDataPath, "native-messaging");
    this.sourceHost = isPackaged
      ? path.join(
          process.resourcesPath ||
            path.join(path.dirname(appPath), "resources"),
          "native-host",
          "native-host.js",
        )
      : path.resolve(__dirname, "native-host.js");
  }
  manifestFile(browserId) {
    const browser = getBrowser(browserId);
    if (this.platform === "win32")
      return path.join(this.base, `${HOST_ID}.${browser.family}.json`);
    if (browser.family === "firefox")
      return path.join(
        this.home,
        ...(this.platform === "darwin"
          ? [
              "Library",
              "Application Support",
              "Mozilla",
              "NativeMessagingHosts",
            ]
          : [".mozilla", "native-messaging-hosts"]),
        `${HOST_ID}.json`,
      );
    return path.join(
      this.home,
      ...(this.platform === "darwin"
        ? [
            "Library",
            "Application Support",
            browser.id === "chrome" ? "Google/Chrome" : browser.mac,
            "NativeMessagingHosts",
          ]
        : [".config", browser.config, "NativeMessagingHosts"]),
      `${HOST_ID}.json`,
    );
  }
  async prepareLauncher() {
    if (!this.token)
      throw new Error("The browser bridge identity has not been initialized.");
    await fs.access(this.sourceHost).catch(() => {
      throw new Error(
        "The native bridge script is missing. Reinstall the complete GetANNY package.",
      );
    });
    await fs.mkdir(this.base, { recursive: true });
    const config = path.join(this.base, "bridge-config.json");
    await fs.writeFile(
      config,
      JSON.stringify(
        {
          token: this.token,
          port: this.port,
          executable: this.appPath,
          script: this.sourceHost,
          appPath: this.isPackaged ? this.appPath : null,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    if (this.platform === "win32") {
      const launcher = path.join(this.base, "GetANNY.NativeHost.exe");
      const source = path.join(this.binPath || "", "GetANNY.NativeHost.exe");
      await fs.access(source).catch(() => {
        throw new Error(
          "The Windows native-host executable is missing. Run scripts/windows/build-native-host.ps1 or reinstall GetANNY.",
        );
      });
      // Do not replace a running host when identical; Windows locks active EXEs.
      const [newFile, oldFile] = await Promise.all([
        fs.readFile(source),
        fs.readFile(launcher).catch(() => null),
      ]);
      if (!oldFile || !newFile.equals(oldFile)) {
        // CopyFile retains MSI's read-only attribute. Our per-user launcher
        // must remain replaceable on upgrade; never chmod the installed source.
        if (oldFile) await fs.chmod(launcher, 0o700);
        await fs.copyFile(source, launcher);
        await fs.chmod(launcher, 0o700);
      }
      return launcher;
    }
    const launcher = path.join(this.base, "getanny-native-host");
    const runAsNode = this.isPackaged || !!process.versions.electron;
    const command = `#!/bin/sh\n${runAsNode ? "export ELECTRON_RUN_AS_NODE=1\n" : ""}exec ${shellQuote(this.appPath)} ${shellQuote(this.sourceHost)} --config ${shellQuote(config)}\n`;
    await fs.writeFile(launcher, command, { mode: 0o700 });
    await fs.chmod(launcher, 0o700);
    return launcher;
  }
  async register(browserId) {
    const browser = getBrowser(browserId);
    const launcher = await this.prepareLauncher();
    const manifest = {
      name: HOST_ID,
      description: "GetANNY authenticated desktop download bridge",
      path: launcher,
      type: "stdio",
      ...(browser.family === "firefox"
        ? { allowed_extensions: [FIREFOX_ID] }
        : { allowed_origins: [`chrome-extension://${CHROMIUM_ID}/`] }),
    };
    const file = this.manifestFile(browserId);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(manifest, null, 2), {
      mode: 0o600,
    });
    if (this.platform === "win32") {
      for (const vendor of browser.registry)
        await exec(
          "reg.exe",
          [
            "add",
            `HKCU\\Software\\${vendor}\\NativeMessagingHosts\\${HOST_ID}`,
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            file,
            "/f",
          ],
          { windowsHide: true },
        );
    }
    return {
      registered: true,
      browserId,
      path: file,
      hostPath: launcher,
      note: "Native host registered for the current user. This does not install or enable the browser extension. Open its popup to verify a real connection.",
    };
  }
  async check(browserId) {
    const browser = getBrowser(browserId);
    const file = this.manifestFile(browserId);
    try {
      const manifest = JSON.parse(await fs.readFile(file, "utf8"));
      await fs.access(manifest.path);
      if (this.platform === "win32") {
        let matching = false;
        for (const vendor of browser.registry) {
          try {
            const result = await exec(
              "reg.exe",
              [
                "query",
                `HKCU\\Software\\${vendor}\\NativeMessagingHosts\\${HOST_ID}`,
                "/ve",
              ],
              { windowsHide: true },
            );
            if (result.stdout.includes(file)) matching = true;
          } catch {
            /* absent */
          }
        }
        if (!matching) return { registered: false, path: file };
      }
      return { registered: manifest.name === HOST_ID, path: file };
    } catch {
      return { registered: false, path: file };
    }
  }
  async unregisterAll() {
    const errors = [];
    for (const browser of browsers) {
      const file = this.manifestFile(browser.id);
      if (this.platform === "win32") {
        for (const vendor of browser.registry) {
          const key = `HKCU\\Software\\${vendor}\\NativeMessagingHosts\\${HOST_ID}`;
          try {
            const { stdout } = await exec("reg.exe", ["query", key, "/ve"], {
              windowsHide: true,
            });
            if (stdout.includes(this.base))
              await exec("reg.exe", ["delete", key, "/f"], {
                windowsHide: true,
              });
          } catch {
            /* absent or already removed */
          }
        }
      } else {
        try {
          const manifest = JSON.parse(await fs.readFile(file, "utf8"));
          if (manifest.path.startsWith(this.base + path.sep))
            await fs.rm(file, { force: true });
        } catch {
          /* absent */
        }
      }
    }
    await fs
      .rm(this.base, { force: true, recursive: true })
      .catch((error) => errors.push(error.message));
    return { removed: errors.length === 0, errors };
  }
}
module.exports = { NativeMessagingHost, shellQuote };
