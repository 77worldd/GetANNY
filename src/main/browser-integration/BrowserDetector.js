const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { browsers, getBrowser } = require("./catalog");
const exec = promisify(execFile);

class BrowserDetector {
  constructor({
    platform = process.platform,
    home = os.homedir(),
    env = process.env,
    userDataPath,
    exists,
  } = {}) {
    Object.assign(this, { platform, home, env, userDataPath });
    this.exists =
      exists ||
      (async (file) =>
        fs.stat(file).then(
          (stat) => stat.isFile(),
          () => false,
        ));
    this.overrides = {};
  }
  expand(value) {
    return value
      .replace(
        /%([^%]+)%/g,
        (_m, key) =>
          this.env[key] ||
          this.env[
            Object.keys(this.env).find(
              (name) => name.toLowerCase() === key.toLowerCase(),
            )
          ] ||
          "__missing__",
      )
      .replaceAll("/", path.sep);
  }
  async loadOverrides() {
    if (this.userDataPath)
      try {
        this.overrides = JSON.parse(
          await fs.readFile(
            path.join(this.userDataPath, "browser-paths.json"),
            "utf8",
          ),
        );
      } catch {
        /* none */
      }
  }
  async detect() {
    await this.loadOverrides();
    return Promise.all(
      browsers.map(async (browser) => {
        let candidates =
          this.platform === "win32"
            ? browser.win.map((file) => this.expand(file))
            : this.platform === "darwin"
              ? [
                  `/Applications/${browser.mac}.app/Contents/MacOS/${browser.mac}`,
                  path.join(
                    this.home,
                    "Applications",
                    `${browser.mac}.app`,
                    "Contents",
                    "MacOS",
                    browser.mac,
                  ),
                ]
              : browser.linux.flatMap((name) =>
                  (this.env.PATH || "/usr/bin:/usr/local/bin:/opt/bin")
                    .split(path.delimiter)
                    .map((dir) => path.join(dir, name)),
                );
        if (this.overrides[browser.id])
          candidates.unshift(this.overrides[browser.id]);
        let executable = null;
        for (const candidate of candidates)
          if (await this.exists(candidate)) {
            executable = candidate;
            break;
          }
        // App Paths supports non-default and per-user Windows installations, without reading profiles.
        if (
          !executable &&
          this.platform === "win32" &&
          process.platform === "win32"
        ) {
          const names = [
            ...new Set(
              browser.win.map((file) =>
                path.win32.basename(file.replaceAll("/", "\\")),
              ),
            ),
          ];
          for (const name of names) {
            // chrome.exe also names Helium / Chromium; do not misattribute it to those browsers.
            if (["helium", "chromium"].includes(browser.id)) continue;
            // launcher.exe is generic; only trust Opera's explicit install paths.
            if (name.toLowerCase() === "launcher.exe") continue;
            for (const hive of ["HKCU", "HKLM"]) {
              try {
                const result = await exec(
                  "reg.exe",
                  [
                    "query",
                    `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${name}`,
                    "/ve",
                  ],
                  { windowsHide: true, timeout: 2000 },
                );
                const candidate = result.stdout
                  .match(/REG_SZ\s+(.+)/)?.[1]
                  ?.trim()
                  .replace(/^"|"$/g, "");
                if (candidate && (await this.exists(candidate))) {
                  executable = candidate;
                  break;
                }
              } catch {
                /* not registered */
              }
            }
            if (executable) break;
          }
        }
        return {
          id: browser.id,
          name: browser.name,
          family: browser.family,
          installed: !!executable,
          executable,
          extensionsPage: browser.page,
          detection: executable ? "executable" : "not-detected",
        };
      }),
    );
  }
  async locate(browserId, executable) {
    getBrowser(browserId);
    if (!path.isAbsolute(executable) || !(await this.exists(executable)))
      throw new Error("Select an existing browser executable.");
    this.overrides[browserId] = executable;
    if (this.userDataPath)
      await fs.writeFile(
        path.join(this.userDataPath, "browser-paths.json"),
        JSON.stringify(this.overrides, null, 2),
      );
    return this.detect();
  }
  async openExtensions(browserId) {
    const browser = getBrowser(browserId);
    const detected = (await this.detect()).find(
      (value) => value.id === browserId,
    );
    if (!detected.executable)
      throw new Error(
        "Browser executable not detected. Use Locate browser, or open its extensions page manually.",
      );
    const child = spawn(detected.executable, [browser.page], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    return { opened: true, page: browser.page };
  }
}
module.exports = { BrowserDetector };
