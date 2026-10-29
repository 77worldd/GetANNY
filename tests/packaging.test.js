const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const ejs = require("ejs");
const { temporary } = require("./helpers");
const verify = require("../scripts/verify-package");
const customizeMsi = require("../scripts/windows/customize-msi");

test("Windows packaging fails closed when required runtime resources are absent", async (t) => {
  const root = await temporary(t);
  await assert.rejects(
    verify({ packager: { projectDir: root }, electronPlatformName: "win32" }),
    /Required packaged resource missing/,
  );
});
test("Windows packaging rejects existing but checksum-invalid tools", async (t) => {
  const root = await temporary(t);
  for (const file of [
    "dist-renderer/index.html",
    "dist-extension/chromium/manifest.json",
    "dist-extension/firefox/manifest.json",
    "bin/yt-dlp.exe",
    "bin/ffmpeg.exe",
    "bin/ffprobe.exe",
    "bin/GetANNY.NativeHost.exe",
    "bin/FFmpeg-LICENSE.txt",
    "bin/FFmpeg-SOURCE.txt",
  ]) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(
      path.join(root, file),
      "deliberately invalid unit-test input",
    );
  }
  await assert.rejects(
    verify({ packager: { projectDir: root }, electronPlatformName: "win32" }),
    /checksum mismatch/,
  );
});
test("real electron-builder MSI template gets safe shortcut components, OS check and real native hooks", async (t) => {
  const root = await temporary(t),
    filename = path.join(root, "project.wxs");
  const template = (
    await fs.readFile(
      require.resolve("app-builder-lib/templates/msi/template.xml"),
      "utf8",
    )
  )
    .replace(/{{/g, "<%")
    .replace(/}}/g, "%>")
    .replace(/\${([^}]+)}/g, "<%=$1%>");
  const xml = ejs.render(template, {
    productName: "GetANNY",
    upgradeCode: "A76CA441-1688-4E23-AE86-D70D12758488",
    version: "2.0.0.1",
    manufacturer: "GetANNY",
    compressionLevel: "high",
    iconPath: "icon.ico",
    iconId: "GetANNYIcon.exe",
    installationDirectoryWixName: "GetANNY",
    isRunAfterFinish: false,
    isAssisted: true,
    isPerMachine: false,
    isCreateDesktopShortcut: true,
    isCreateStartMenuShortcut: true,
    programFilesId: "ProgramFiles64Folder",
    menuCategory: null,
    files:
      '<Component><File Id="mainExecutable" Source="GetANNY.exe"><Shortcut Id="desktopShortcut" Directory="DesktopFolder" Name="GetANNY" Advertise="yes" Icon="GetANNYIcon.exe"/></File></Component>',
    dirs: "",
  });
  await fs.writeFile(filename, xml);
  await customizeMsi(filename);
  const result = await fs.readFile(filename, "utf8");
  assert.match(result, /http:\/\/schemas.microsoft.com\/wix\/2006\/wi/);
  assert.match(
    result,
    /GETANNY_WINDOWS_BUILD &gt;= 10240|GETANNY_WINDOWS_BUILD >= 10240/,
  );
  assert.match(
    result,
    /<Component Id="OptionalDesktopShortcut"[^>]*>[\s\S]*?<Condition>GETANNY_DESKTOP_SHORTCUT=1<\/Condition>/,
  );
  assert.match(
    result,
    /<File Id="mainExecutable" Source="GetANNY.exe"><\/File>/,
  );
  assert.match(result, /--setup-browser-hosts --quiet/);
  assert.match(result, /--unregister-browser-hosts --quiet/);
  assert.match(
    result,
    /Dialog="InstallScopeDlg" Control="Next" Event="NewDialog" Value="InstallDirDlg"/,
  );
  assert.equal(
    (result.match(/<Shortcut Id="desktopShortcut"/g) || []).length,
    1,
  );
});
test("checked-in Chromium public key derives the allowlisted extension ID", async () => {
  const manifest = JSON.parse(
    await fs.readFile("src/extension/manifest.json", "utf8"),
  );
  const id = createHash("sha256")
    .update(Buffer.from(manifest.key, "base64"))
    .digest("hex")
    .slice(0, 32)
    .split("")
    .map((char) => String.fromCharCode(97 + parseInt(char, 16)))
    .join("");
  assert.equal(
    id,
    require("../src/main/browser-integration/catalog").CHROMIUM_ID,
  );
  assert.ok(manifest.permissions.includes("nativeMessaging"));
});
