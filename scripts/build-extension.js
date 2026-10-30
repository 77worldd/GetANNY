const fs = require("node:fs/promises");
const path = require("node:path");
const { zipSync, strToU8 } = require("fflate");
const { browsers } = require("../src/main/browser-integration/catalog");
const root = path.resolve(__dirname, "..");
const source = path.join(root, "src/extension");
const output = path.join(root, "dist-extension");
const version = require("../package.json").version;
const assets = path.join(root, "release-assets");
const files = [
  "background.js",
  "content.js",
  "injector.js",
  "config.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
];
async function build(family) {
  const dest = path.join(output, family);
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.join(dest, "icons"), { recursive: true });
  for (const file of files)
    await fs.copyFile(path.join(source, file), path.join(dest, file));
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(
        source,
        family === "firefox" ? "manifest-firefox.json" : "manifest.json",
      ),
      "utf8",
    ),
  );
  manifest.version = version.replace(/-rc\.(\d+)$/, ".$1");
  if (family === "chromium") manifest.version_name = version;
  await fs.writeFile(
    path.join(dest, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  if (family === "firefox")
    await fs.writeFile(
      path.join(dest, "config.js"),
      "globalThis.GETANNY_BROWSER = 'firefox';\n",
    );
  return dest;
}
async function packageBrowser(browser) {
  const folder = path.join(
    output,
    browser.family === "firefox" ? "firefox" : "chromium",
  );
  const entries = {};
  for (const file of [...files, "manifest.json"])
    entries[file] = new Uint8Array(await fs.readFile(path.join(folder, file)));
  entries["config.js"] = strToU8(
    `globalThis.GETANNY_BROWSER = ${JSON.stringify(browser.id)};\n`,
  );
  const instructions = `# GetANNY ${version} — ${browser.name}\n\n${browser.family === "firefox" ? "UNSIGNED DEVELOPMENT PACKAGE. In about:debugging → This Firefox → Load Temporary Add-on select manifest.json. It unloads when Firefox restarts. Permanent installation requires Mozilla signing; this ZIP is NOT a signed XPI." : `Extract this ZIP to a permanent folder. Open ${browser.page}, enable Developer mode, choose Load unpacked, and select the extracted folder. This is not a signed store CRX. Do not delete the folder while using the extension.`}\n\nIn the GetANNY desktop application open Browser integration, select ${browser.name}, and choose Set up. This registers the native messaging host for your user. Open the extension popup and Reconnect. Only a successful handshake is a verified connection.\n\nIf native messaging is unavailable, copy the desktop pairing key into the extension's Connection & pairing panel. Select ${browser.name}, save, and reconnect. Never share this key.\n\nRight-click a file link → Download with GetANNY. Use Analyze media in GetANNY for video pages; choose quality and destination in Media studio. The popup lists detected HTTP media. Blob/DRM streams are not direct file downloads.\n\nUpdate: replace files in this same permanent folder and Reload on the extensions page, or rerun desktop Set up to refresh its prepared folder. Firefox temporary add-ons must be loaded again. No extension store update service is configured.\n\nTroubleshooting and browser-specific compatibility: https://github.com/77worldd/GetANNY/blob/arena/9c64a2a0-getanny/docs/BROWSERS.md\n\nPermissions: nativeMessaging (local host); storage (preferences / pairing); tabs (active page and detections); contextMenus (explicit send actions); webRequest + HTTP(S) host access (read media response headers and add media actions). No cookies, passwords, browser profile edits, enterprise policies or automatic download interception.\n`;
  entries["INSTALL.md"] = strToU8(instructions);
  const name = `GetANNY-${browser.id}-${version}.zip`;
  await fs.writeFile(path.join(assets, name), zipSync(entries, { level: 9 }));
  console.log(`Packaged ${browser.name}: ${name}`);
}
(async () => {
  await fs.mkdir(assets, { recursive: true });
  await Promise.all([build("chromium"), build("firefox")]);
  for (const browser of browsers) await packageBrowser(browser);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
