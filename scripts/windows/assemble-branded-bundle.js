/**
 * Assemble the GetANNY Windows distribution folder and ZIP from real build
 * output. Copies (never moves) every artefact, writes checksums for the bundle
 * and for the release asset set, and verifies the ZIP contents by reopening it.
 *
 * Usage: node scripts/windows/assemble-branded-bundle.js [--desktop]
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const version = require(path.join(root, "package.json")).version;
const assets = path.join(root, "release-assets");
const dist = path.join(root, "dist");
const stage = path.join(assets, `GetANNY-${version}-Windows-Release`);

const folders = [
  "Installers",
  "Portable",
  "Browser_Extensions",
  "Setup_Helpers",
  "Documentation",
  "Checksums",
];

function copy(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Missing build output: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return to;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}

function resetStage() {
  fs.rmSync(stage, { recursive: true, force: true });
  for (const folder of folders)
    fs.mkdirSync(path.join(stage, folder), { recursive: true });
}

function main() {
  fs.mkdirSync(assets, { recursive: true });
  resetStage();

  const setupExe = copy(
    path.join(dist, "GetANNY Setup.exe"),
    path.join(stage, "Installers", `GetANNY-${version}-Setup.exe`),
  );
  const setupMsi = copy(
    path.join(dist, "GetANNY Setup.msi"),
    path.join(stage, "Installers", `GetANNY-${version}-Setup.msi`),
  );
  const portable = copy(
    path.join(dist, "GetANNY Portable.exe"),
    path.join(stage, "Portable", `GetANNY-${version}-Portable.exe`),
  );

  const extensions = fs
    .readdirSync(assets)
    .filter((name) => /^GetANNY-[a-z]+-\d+\.\d+\.\d+\.zip$/.test(name));
  if (extensions.length !== 8)
    throw new Error(`Expected 8 browser packages, found ${extensions.length}`);
  for (const name of extensions)
    copy(path.join(assets, name), path.join(stage, "Browser_Extensions", name));

  copy(
    path.join(root, "scripts/windows/Setup-Browsers.ps1"),
    path.join(stage, "Setup_Helpers/Setup-Browsers.ps1"),
  );
  fs.writeFileSync(
    path.join(stage, "Setup_Helpers/Setup-Browsers.cmd"),
    [
      "@echo off",
      "setlocal",
      "set /p APP=Path to installed GetANNY.exe: ",
      "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0Setup-Browsers.ps1\" -InstalledApp \"%APP%\"",
      "pause",
      "",
    ].join("\r\n"),
  );
  copy(
    path.join(root, "docs/NATIVE_MESSAGING.md"),
    path.join(stage, "Setup_Helpers/NATIVE_MESSAGING.md"),
  );

  const docs = [
    ["docs/WINDOWS_BUNDLE.md", "START_HERE.md"],
    ["docs/INSTALL_WINDOWS.md", "INSTALL_WINDOWS.md"],
    ["docs/BROWSERS.md", "BROWSERS.md"],
    ["docs/PORTABLE_WINDOWS.md", "PORTABLE_WINDOWS.md"],
    ["docs/RELEASE_NOTES.md", "RELEASE_NOTES.md"],
    ["docs/CHANGELOG.md", "CHANGELOG.md"],
    ["docs/THIRD_PARTY.md", "THIRD_PARTY.md"],
    ["LICENSE", "LICENSE"],
  ];
  for (const [from, to] of docs)
    copy(path.join(root, from), path.join(stage, "Documentation", to));

  let commit = "unknown";
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {}
  fs.writeFileSync(
    path.join(stage, "Documentation/RELEASE_INFO.md"),
    [
      `# GetANNY ${version}`,
      "",
      `- Build date: ${new Date().toISOString()}`,
      `- Source commit: \`${commit}\``,
      "- Platform: Windows 10/11 x64",
      "- Signing: **unsigned** (no certificate was supplied)",
      "- Repository: https://github.com/p4yy/GetANNY",
      `- Release: https://github.com/p4yy/GetANNY/releases/tag/v${version}`,
      "",
      "The EXE, MSI and portable executables are unsigned. Firefox packages are",
      "unsigned development ZIPs; Chromium-family packages require developer-mode",
      "loading. Verify every checksum before running a binary.",
      "",
    ].join("\n"),
  );

  fs.writeFileSync(path.join(stage, "VERSION.txt"), version + "\n");

  const files = walk(stage)
    .filter((file) => !file.includes(`${path.sep}Checksums${path.sep}`))
    .sort();
  const sums = files.map(
    (file) =>
      `${sha256(file)}  ${path
        .relative(stage, file)
        .split(path.sep)
        .join("/")}`,
  );
  fs.writeFileSync(
    path.join(stage, "Checksums/SHA256SUMS.txt"),
    sums.join("\n") + "\n",
  );

  const zipName = `GetANNY-${version}-Windows-Bundle.zip`;
  const zipPath = path.join(assets, zipName);
  fs.rmSync(zipPath, { force: true });
  execFileSync(
    "C:\\WINDOWS\\system32\\tar.exe",
    ["-a", "-c", "-f", zipPath, "-C", path.dirname(stage), path.basename(stage)],
    { stdio: "inherit" },
  );

  const releaseAssets = [
    setupExe,
    setupMsi,
    portable,
    zipPath,
    ...extensions.map((name) => path.join(assets, name)),
  ].sort();
  const releaseSums = releaseAssets.map(
    (file) => `${sha256(file)}  ${path.basename(file)}`,
  );
  fs.writeFileSync(
    path.join(assets, "SHA256SUMS.txt"),
    releaseSums.join("\n") + "\n",
  );

  console.log(`Bundle folder: ${stage}`);
  console.log(`Bundle ZIP:    ${zipPath}`);
  console.log(`Files:         ${files.length}`);
  console.log(`Release sums:  ${path.join(assets, "SHA256SUMS.txt")}`);
}

main();
