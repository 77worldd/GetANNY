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
  for (const relative of files) {
    if (!relative.endsWith(".json")) continue;
    const file = path.join(root, relative);
    if (!(await fs.stat(file)).isFile()) continue;
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    if (path.basename(file) === "matrix.json" && Array.isArray(data)) {
      for (const item of data)
        annotation(`Browser ${item.browser}`, {
          browser: item.browser,
          status: item.status,
          reason: item.reason,
          report: item.report,
        });
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
    annotation(relative.replaceAll("\\", "/"), summary);
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
