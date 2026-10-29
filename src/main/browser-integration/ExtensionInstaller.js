const fs = require("node:fs/promises");
const path = require("node:path");
const { getBrowser } = require("./catalog");
// MSI resources can be read-only. Only normalize our per-user prepared copies;
// never change installed resources or the user's browser/profile permissions.
async function makeWritable(folder) {
  for (const entry of await fs
    .readdir(folder, { withFileTypes: true })
    .catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      await fs.chmod(file, 0o700);
      await makeWritable(file);
    } else if (entry.isFile()) await fs.chmod(file, 0o600);
  }
}
class ExtensionInstaller {
  constructor({ extensionPath, userDataPath } = {}) {
    this.extensionPath = extensionPath;
    this.userDataPath = userDataPath;
  }
  async install(browserId) {
    const browser = getBrowser(browserId);
    const source = path.join(
      this.extensionPath,
      browser.family === "firefox" ? "firefox" : "chromium",
    );
    await fs.access(path.join(source, "manifest.json")).catch(() => {
      throw new Error(
        "Extension resources are missing. Run npm run build-extension or reinstall GetANNY.",
      );
    });
    const target = path.join(this.userDataPath, "extensions", browserId);
    await fs.mkdir(target, { recursive: true });
    // Preserve a stable unpacked extension directory across application updates.
    await makeWritable(target);
    await fs.cp(source, target, { recursive: true, force: true });
    await makeWritable(target);
    await fs.writeFile(
      path.join(target, "config.js"),
      `globalThis.GETANNY_BROWSER = ${JSON.stringify(browserId)};\n`,
    );
    return {
      prepared: true,
      installed: null,
      enabled: null,
      browserId,
      path: target,
      extensionsPage: browser.page,
      instructions:
        browser.family === "firefox"
          ? "For development: open about:debugging, choose This Firefox → Load Temporary Add-on and select manifest.json. This lasts until Firefox restarts. Permanent installation requires a Mozilla-signed XPI."
          : `Open ${browser.page}, enable Developer mode, choose Load unpacked, and select this folder. Approve the requested permissions. Then open the extension popup and click Reconnect.`,
    };
  }
  async check(browserId) {
    getBrowser(browserId);
    const folder = path.join(this.userDataPath, "extensions", browserId);
    const prepared = await fs.access(path.join(folder, "manifest.json")).then(
      () => true,
      () => false,
    );
    return { prepared, installed: null, enabled: null, path: folder };
  }
}
module.exports = { ExtensionInstaller };
