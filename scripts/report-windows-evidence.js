// Secret-free, bounded GitHub annotations; complete reports stay in evidence ZIP.
// GitHub truncates messages near 4 KiB and caps annotations per step. Emit compact
// real counts and deduplicated check definitions, never repeated verbose reports.
const fs = require("node:fs/promises");
const path = require("node:path");
function annotation(title, value) {
  const escape = (text) =>
    String(text)
      .replaceAll("%", "%25")
      .replaceAll("\r", "%0D")
      .replaceAll("\n", "%0A");
  process.stdout.write(
    `::notice title=${escape(title)}::${escape(JSON.stringify(value))}\n`,
  );
}
function emitRecords(title, records) {
  let batch = [];
  for (const record of records) {
    if (
      batch.length &&
      Buffer.byteLength(JSON.stringify([...batch, record])) > 3300
    ) {
      annotation(title, batch);
      batch = [];
    }
    if (Buffer.byteLength(JSON.stringify(record)) > 3300)
      throw new Error(
        `Evidence record too large for a readable annotation: ${title}`,
      );
    batch.push(record);
  }
  if (batch.length) annotation(title, batch);
}
function compact(data, relative) {
  const result = {
    report: relative.replaceAll("\\", "/"),
    passed: data.passed,
  };
  for (const key of [
    "date",
    "version",
    "electron",
    "platform",
    "packaged",
    "browser",
    "browserVersion",
    "temporary",
    "headless",
    "extensionId",
    "exe",
    "msi",
    "signatures",
    "defaultProfileRetention",
  ]) {
    if (data[key] !== undefined) result[key] = data[key];
  }
  if (data.baseline)
    result.baseline = {
      passed: data.baseline.passed,
      version: data.baseline.version,
      error: data.baseline.error,
    };
  if (data.transport)
    result.transport =
      data.transport === "native"
        ? "native"
        : data.transport.startsWith("Native Messaging")
          ? "native-chain"
          : data.transport;
  if (data.installation?.startsWith("Normal developer-mode UI"))
    result.normalDeveloperUIConsent = true;
  if (data.shortcuts)
    result.shortcuts = {
      exe: (data.shortcuts.exe || []).length,
      msi: (data.shortcuts.msi || []).length,
      createdAndTargetsVerified: data.shortcuts.createdAndTargetsVerified,
      removedOnUninstall: data.shortcuts.removedOnUninstall,
      shellLaunch: data.shortcuts.shellLaunch,
    };
  if (Array.isArray(data.checks)) {
    result.checks = {
      total: data.checks.length,
      passed: data.checks.filter((check) =>
        typeof check === "string" ? data.passed : check.passed === true,
      ).length,
    };
    const failed = data.checks
      .filter((check) => typeof check === "object" && check.passed === false)
      .map((check) => check.name);
    if (failed.length) result.checks.failed = failed;
    const marker = data.checks.find(
      (check) => check.detail?.priorRunObserved !== undefined,
    );
    if (marker)
      result.restart = {
        priorRunObserved: marker.detail.priorRunObserved,
        history: marker.detail.history,
      };
  }
  return result;
}
async function report(root) {
  const files = await fs.readdir(root, { recursive: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const native = await fs
    .readFile(path.join(root, "native-launcher.log"), "utf8")
    .catch(() => "");
  const nativeCounts = {};
  for (const key of ["tests", "pass", "fail", "skipped"]) {
    const match = native.match(new RegExp(`^# ${key} (\\d+)$`, "m"));
    if (match) nativeCounts[key] = Number(match[1]);
  }
  if (nativeCounts.tests)
    annotation("Compiled C# native bridge suite", nativeCounts);
  const xml = await fs
    .readFile(path.join(root, "backend-junit.xml"), "utf8")
    .catch(() => "");
  if (xml)
    annotation("Windows backend suite", {
      tests: (xml.match(/<testcase\b/g) || []).length,
      failures: (xml.match(/<failure\b/g) || []).length,
      skipped: (xml.match(/<skipped\b/g) || []).length,
    });
  const groups = { installed: [], browsers: [], installer: [], matrix: [] },
    definitions = { installed: new Set(), browsers: new Set() };
  for (const relative of files) {
    if (!relative.endsWith(".json")) continue;
    const file = path.join(root, relative);
    if (!(await fs.stat(file)).isFile()) continue;
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    if (path.basename(file) === "matrix.json" && Array.isArray(data)) {
      groups.matrix.push(
        ...data.map((item) => ({
          browser: item.browser,
          status: item.status,
          reason: item.reason,
          report: item.report,
        })),
      );
      continue;
    }
    if (typeof data.passed !== "boolean") continue;
    const summary = compact(data, relative);
    const group =
      path.basename(file) === "installer-report.json"
        ? "installer"
        : summary.report.startsWith("browser/") ||
            summary.report.startsWith("browser-matrix/")
          ? "browsers"
          : "installed";
    groups[group].push(summary);
    for (const check of data.checks || []) {
      const name = typeof check === "string" ? check : check.name;
      if (name && definitions[group]) definitions[group].add(name);
    }
  }
  emitRecords("Installed Windows app reports", groups.installed);
  emitRecords("Installed check definitions", [...definitions.installed]);
  emitRecords("Individual browser matrix", groups.matrix);
  emitRecords("Actual browser reports", groups.browsers);
  emitRecords("Browser check definitions", [...definitions.browsers]);
  emitRecords(
    "Installer lifecycle, retention, shortcuts and signatures",
    groups.installer,
  );
}
if (require.main === module)
  report(path.resolve(process.argv[2] || "test-results/windows")).catch(
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
module.exports = { report };
