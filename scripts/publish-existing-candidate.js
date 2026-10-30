// Publish an explicitly requested, verification-incomplete RC from immutable CI
// bytes. This is NOT the full installed-app verification/promotion workflow.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 600000,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${program} failed (${result.status}): ${result.stderr || ""}`,
    );
  return result.stdout;
}
function api(route) {
  return JSON.parse(command("gh", ["api", route]));
}
async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
function assertProvenance(artifact, run, expected) {
  assert.equal(artifact.id, expected.artifactId, "Wrong artifact ID");
  assert.equal(artifact.name, "GetANNY-unsigned-test-build");
  assert.equal(artifact.expired, false, "Artifact expired");
  assert.equal(artifact.digest, `sha256:${expected.archiveSha256}`);
  assert.equal(artifact.workflow_run.id, expected.runId);
  assert.equal(artifact.workflow_run.head_sha, expected.source);
  assert.equal(artifact.workflow_run.head_branch, "arena/9c64a2a0-getanny");
  assert.equal(run.id, expected.runId);
  assert.equal(run.head_sha, expected.source);
}
function parseChecksums(text) {
  const records = new Map();
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})  (.+)$/i.exec(line);
    assert.ok(match, "Invalid checksum record");
    const [, digest, name] = match;
    assert.ok(
      !/[\\/]/.test(name) && name !== "." && name !== "..",
      "Unsafe checksum filename",
    );
    assert.ok(!records.has(name), "Duplicate checksum filename");
    records.set(name, digest.toLowerCase());
  }
  return records;
}
function qualification(run) {
  if (run.status !== "completed")
    return "Windows installation/uninstallation/browser verification has NOT finished. This is NOT a stable or fully verified release.";
  if (run.conclusion !== "success")
    return `Windows verification did NOT pass (workflow conclusion: ${run.conclusion}). This is NOT a stable or fully verified release.`;
  return "The linked Windows workflow completed successfully. Consumer-machine, signing and permanent extension-installation limitations still apply.";
}
function assertAbsent(route, description) {
  const result = spawnSync("gh", ["api", route], { encoding: "utf8" });
  if (result.status === 0)
    throw new Error(
      `${description} already exists; nothing will be overwritten.`,
    );
  if (!/HTTP 404/.test(result.stderr || ""))
    throw new Error(
      `Cannot establish absence of ${description}: ${result.stderr}`,
    );
}
async function downloadArtifact(repo, id, target, digest) {
  const fd = fs.openSync(target, "w");
  try {
    command("gh", ["api", `repos/${repo}/actions/artifacts/${id}/zip`], {
      stdio: ["ignore", fd, "pipe"],
    });
  } finally {
    fs.closeSync(fd);
  }
  assert.equal(
    await sha256(target),
    digest,
    "Downloaded artifact digest mismatch",
  );
}
async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  assert.equal(
    repo,
    "77worldd/GetANNY",
    "Publication is restricted to the requested repository",
  );
  assert.equal(process.env.CI, "true", "Use the explicit CI publication job");
  const expected = {
    source: process.env.GETANNY_SOURCE_SHA,
    runId: Number(process.env.GETANNY_SOURCE_RUN),
    artifactId: Number(process.env.GETANNY_ARTIFACT_ID),
    archiveSha256: process.env.GETANNY_ARTIFACT_SHA256,
  };
  assert.match(expected.source || "", /^[0-9a-f]{40}$/);
  assert.match(expected.archiveSha256 || "", /^[0-9a-f]{64}$/);
  const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
  assert.match(
    version,
    /^\d+\.\d+\.\d+-rc\.\d+$/,
    "This path may publish RCs only",
  );
  const tag = `v${version}`;
  assertAbsent(`repos/${repo}/releases/tags/${tag}`, `Release ${tag}`);
  // Nothing shipped in the app may have changed since the recorded build.
  command("git", ["merge-base", "--is-ancestor", expected.source, "HEAD"]);
  command("git", [
    "diff",
    "--exit-code",
    expected.source,
    "HEAD",
    "--",
    "src",
    "assets",
    "bin",
    "package.json",
    "package-lock.json",
    "LICENSE",
    "electron-builder.yml",
    "index.html",
    "vite.config.js",
    "docs/THIRD_PARTY.md",
    "scripts/build-extension.js",
    "scripts/download-tools.js",
    "scripts/prepare-tools.js",
    "scripts/tools-manifest.json",
    "scripts/verify-package.js",
    "scripts/verify-installed-resources.js",
    "scripts/windows/NativeHost.cs",
    "scripts/windows/build-native-host.ps1",
    "scripts/windows/customize-msi.js",
    "scripts/windows/installer.nsh",
  ]);
  const artifact = api(
    `repos/${repo}/actions/artifacts/${expected.artifactId}`,
  );
  let run = api(`repos/${repo}/actions/runs/${expected.runId}`);
  assertProvenance(artifact, run, expected);
  const work = await fsp.mkdtemp(
    path.join(process.env.RUNNER_TEMP, "getanny-publication-"),
  );
  const archive = path.join(work, "build.zip"),
    unpacked = path.join(work, "build"),
    out = path.join(work, "release");
  await downloadArtifact(
    repo,
    expected.artifactId,
    archive,
    expected.archiveSha256,
  );
  await fsp.mkdir(unpacked);
  await fsp.mkdir(out);
  command("unzip", ["-q", archive, "-d", unpacked]);
  const original = parseChecksums(
    await fsp.readFile(path.join(unpacked, "SHA256SUMS.txt"), "utf8"),
  );
  const required = [
    "GetANNY Setup.exe",
    "GetANNY Setup.msi",
    ...[
      "helium",
      "chrome",
      "chromium",
      "brave",
      "firefox",
      "vivaldi",
      "opera",
      "edge",
    ].map((browser) => `GetANNY-${browser}-${version}.zip`),
  ];
  for (const name of required)
    assert.ok(original.has(name), `Required asset missing: ${name}`);
  for (const [name, digest] of original) {
    const file = path.join(unpacked, name);
    assert.equal(
      await sha256(file),
      digest,
      `Build checksum mismatch: ${name}`,
    );
    await fsp.copyFile(file, path.join(out, name));
  }
  const exe = await fsp.open(path.join(out, "GetANNY Setup.exe"));
  const msi = await fsp.open(path.join(out, "GetANNY Setup.msi"));
  try {
    const a = Buffer.alloc(2),
      b = Buffer.alloc(8);
    await exe.read(a, 0, 2, 0);
    await msi.read(b, 0, 8, 0);
    assert.equal(a.toString("ascii"), "MZ", "EXE header missing");
    assert.equal(
      b.toString("hex"),
      "d0cf11e0a1b11ae1",
      "MSI compound-file header missing",
    );
  } finally {
    await exe.close();
    await msi.close();
  }
  // Build digests cover unchanged binaries/packages; public-release guides are
  // updated separately and receive their own final SHA256SUMS records.
  await fsp.writeFile(
    path.join(out, "BUILD_SHA256SUMS.txt"),
    [...original]
      .filter(([name]) => /\.(exe|msi|zip)$/i.test(name))
      .map(([name, digest]) => `${digest}  ${name}`)
      .join("\n") + "\n",
  );
  await fsp.copyFile(
    "docs/INSTALL_WINDOWS.md",
    path.join(out, "INSTALL_WINDOWS.md"),
  );
  await fsp.copyFile("docs/BROWSERS.md", path.join(out, "BROWSERS.md"));
  await fsp.copyFile(
    "docs/RELEASE_NOTES.md",
    path.join(out, "RELEASE_NOTES.md"),
  );
  await fsp.copyFile("docs/TESTING.md", path.join(out, "TESTING.md"));
  // Refresh status immediately before publication; pending/failed is never success.
  run = api(`repos/${repo}/actions/runs/${expected.runId}`);
  const jobs = api(`repos/${repo}/actions/runs/${expected.runId}/jobs`);
  const status = {
    source: expected.source,
    run: run.html_url,
    status: run.status,
    conclusion: run.conclusion,
    recordedAt: new Date().toISOString(),
    jobs: jobs.jobs.map((job) => ({
      id: job.id,
      status: job.status,
      conclusion: job.conclusion,
      steps: job.steps,
    })),
  };
  await fsp.writeFile(
    path.join(out, "WINDOWS_VERIFICATION_STATUS.json"),
    JSON.stringify(status, null, 2) + "\n",
  );
  const artifacts = api(
    `repos/${repo}/actions/runs/${expected.runId}/artifacts`,
  );
  const evidence = artifacts.artifacts.find(
    (item) => item.name === "windows-test-evidence" && !item.expired,
  );
  if (evidence) {
    assert.match(evidence.digest || "", /^sha256:[0-9a-f]{64}$/);
    await downloadArtifact(
      repo,
      evidence.id,
      path.join(out, "Windows-test-evidence.zip"),
      evidence.digest.slice(7),
    );
  }
  const warning = qualification(run);
  const measured = `# Verification status at publication\n\n**${warning}**\n\nSource: \`${expected.source}\`.\n\nWindows run: ${run.html_url}\n\n${evidence ? "Raw Windows evidence is attached. Inspect per-check failures and browser results; the archive is not itself proof of a pass." : "The current run has not published its raw installed/browser evidence yet. No current MSI-uninstall or seven-browser pass is claimed."}\n\nSee WINDOWS_VERIFICATION_STATUS.json for actual stage statuses and TESTING.md for dated source-level/historical measurements.\n\nInstallers are unsigned. Firefox ZIP is unsigned development source, not a permanently installable signed XPI. Chromium packages require ordinary developer-mode consent. Consumer clean-install, v1 upgrade and interactive wizard certification remain incomplete.\n`;
  await fsp.writeFile(path.join(out, "MEASURED_RESULTS.md"), measured);
  await fsp.writeFile(
    path.join(out, "SOURCE_COMMIT.txt"),
    expected.source + "\n",
  );
  await fsp.writeFile(
    path.join(out, "PROVENANCE.json"),
    JSON.stringify(
      {
        version,
        source: expected.source,
        publicationCommit: process.env.GITHUB_SHA,
        artifactId: expected.artifactId,
        artifactSha256: expected.archiveSha256,
        originalBuildChecksums: Object.fromEntries(original),
        sourceRun: expected.runId,
        verificationAtPublication: {
          status: run.status,
          conclusion: run.conclusion,
        },
        identicalToPreviouslySharedTestBuild: true,
      },
      null,
      2,
    ) + "\n",
  );
  const names = (await fsp.readdir(out)).sort(),
    sums = new Map();
  for (const name of names) sums.set(name, await sha256(path.join(out, name)));
  const checksumText =
    [...sums].map(([name, hash]) => `${hash}  ${name}`).join("\n") + "\n";
  await fsp.writeFile(path.join(out, "SHA256SUMS.txt"), checksumText);
  const notes = path.join(work, "notes.md");
  await fsp.writeFile(
    notes,
    `> **Release candidate — verification incomplete.** ${warning}\n> Public release hosting is not certification. These are the **same binaries** previously shared as an Actions artifact, not a new app build.\n\n${await fsp.readFile("docs/RELEASE_NOTES.md", "utf8")}\n\n${measured}\n## Build identity\n\nBuilt from: \`${expected.source}\`\n\nOriginal immutable artifact: https://github.com/${repo}/actions/runs/${expected.runId}/artifacts/${expected.artifactId}\n\n## SHA-256\n\n\`\`\`text\n${checksumText}\`\`\`\n`,
  );
  const files = (await fsp.readdir(out)).sort();
  command("gh", [
    "release",
    "create",
    tag,
    ...files.map((name) => `${path.join(out, name)}#${name}`),
    "--repo",
    repo,
    "--target",
    expected.source,
    "--prerelease",
    "--latest=false",
    "--title",
    `GetANNY ${version} · Windows release candidate`,
    "--notes-file",
    notes,
  ]);
  const release = api(`repos/${repo}/releases/tags/${tag}`);
  assert.equal(release.prerelease, true);
  assert.equal(release.draft, false);
  const ref = api(`repos/${repo}/git/ref/tags/${tag}`);
  assert.equal(
    ref.object.sha,
    expected.source,
    "Release tag must point at the actual build source",
  );
  for (const name of files) {
    const asset = release.assets.find(
      (item) => item.label === name || item.name === name,
    );
    assert.ok(asset, `Uploaded asset missing: ${name}`);
    const digest = await sha256(path.join(out, name));
    assert.equal(
      asset.digest,
      `sha256:${digest}`,
      `Published digest mismatch: ${name}`,
    );
  }
  console.log(
    JSON.stringify(
      {
        url: release.html_url,
        source: expected.source,
        prerelease: true,
        verification: status.status,
        conclusion: status.conclusion,
        assets: release.assets.map((item) => ({
          name: item.name,
          label: item.label,
          size: item.size,
          digest: item.digest,
          url: item.browser_download_url,
        })),
      },
      null,
      2,
    ),
  );
}
if (require.main === module)
  main().catch((error) => {
    console.error(error);
    // Preserve the precise blocker through the Checks API even when the
    // sandbox cannot reach the external Actions ZIP-log host.
    const message = String(error.stack || error.message)
      .slice(0, 3000)
      .replaceAll("%", "%25")
      .replaceAll("\r", "%0D")
      .replaceAll("\n", "%0A");
    console.log(`::error title=RC publication blocked::${message}`);
    process.exitCode = 1;
  });
module.exports = { assertProvenance, parseChecksums, qualification };
