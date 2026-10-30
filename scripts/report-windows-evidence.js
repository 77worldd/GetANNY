// Machine-readable, secret-free summaries in GitHub check annotations. The full
// real reports remain artifacts/release assets; never emit pairing/config data.
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
  // GitHub retains only a small number of annotations per step. Aggregate
  // reports instead of silently losing later browsers to that limit.
  const groups = { installed: [], browsers: [], installer: [], matrix: [] };
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
    const summary = {};
    for (const key of [
      "passed",
      "date",
      "version",
      "electron",
      "platform",
      "packaged",
      "browser",
      "browserVersion",
      "temporary",
      "signatures",
      "exe",
      "msi",
      "limitations",
      "defaultProfileRetention",
      "shortcuts",
      "installation",
      "headless",
      "transport",
      "extensionId",
    ])
      if (data[key] !== undefined) summary[key] = data[key];
    if (data.checks)
      summary.checks = data.checks.map((check) =>
        typeof check === "string"
          ? check
          : {
              name: check.name,
              passed: check.passed,
              ms: check.ms,
              ...(check.detail?.priorRunObserved !== undefined
                ? {
                    priorRunObserved: check.detail.priorRunObserved,
                    history: check.detail.history,
                  }
                : {}),
            },
      );
    summary.report = relative.replaceAll("\\", "/");
    if (path.basename(file) === "installer-report.json")
      groups.installer.push(summary);
    else if (
      summary.report.startsWith("browser/") ||
      summary.report.startsWith("browser-matrix/")
    )
      groups.browsers.push(summary);
    else groups.installed.push(summary);
  }
  for (const [key, title] of [
    ["installed", "Installed Windows app reports"],
    ["matrix", "Individual browser matrix"],
    ["browsers", "Actual browser reports"],
    ["installer", "Installer lifecycle, retention, shortcuts and signatures"],
  ]) {
    if (groups[key].length) annotation(title, groups[key]);
  }
}
if (require.main === module)
  report(path.resolve(process.argv[2] || "test-results/windows")).catch(
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
module.exports = { report };
