// Publication/provenance unit fixtures, NOT installed-app or browser evidence.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertProvenance,
  parseChecksums,
  qualification,
} = require("../scripts/publish-existing-candidate");

test("publication provenance rejects source/run/digest mismatches and expired artifacts", () => {
  const expected = {
    source: "a".repeat(40),
    branch: "arena/9c64a2a0-getanny",
    runId: 12,
    artifactId: 34,
    archiveSha256: "b".repeat(64),
  };
  const run = { id: 12, head_sha: expected.source };
  const artifact = {
    id: 34,
    name: "GetANNY-unsigned-test-build",
    expired: false,
    digest: "sha256:" + expected.archiveSha256,
    workflow_run: {
      id: 12,
      head_sha: expected.source,
      head_branch: "arena/9c64a2a0-getanny",
    },
  };
  assert.doesNotThrow(() => assertProvenance(artifact, run, expected));
  for (const change of [
    { expired: true },
    { id: 35 },
    { digest: "sha256:" + "c".repeat(64) },
    { workflow_run: { ...artifact.workflow_run, head_sha: "c".repeat(40) } },
    { workflow_run: { ...artifact.workflow_run, id: 13 } },
  ])
    assert.throws(() =>
      assertProvenance({ ...artifact, ...change }, run, expected),
    );
  assert.throws(() =>
    assertProvenance(artifact, { ...run, head_sha: "d".repeat(40) }, expected),
  );
});
test("checksum records preserve installer spaces but reject traversal and duplicate names", () => {
  const hash = "a".repeat(64);
  assert.equal(
    parseChecksums(`${hash}  GetANNY Setup.exe\n`).get("GetANNY Setup.exe"),
    hash,
  );
  for (const name of ["../outside", "folder/file", "folder\\file", ".", ".."])
    assert.throws(() => parseChecksums(`${hash}  ${name}`));
  assert.throws(() => parseChecksums(`${hash}  same\n${hash}  same`));
  assert.throws(() => parseChecksums("not-a-checksum"));
});
test("pending, failed and cancelled workflows can never be described as passed", () => {
  assert.match(
    qualification({ status: "in_progress", conclusion: null }),
    /NOT finished/,
  );
  assert.match(
    qualification({ status: "completed", conclusion: "failure" }),
    /did NOT pass/,
  );
  assert.match(
    qualification({ status: "completed", conclusion: "cancelled" }),
    /did NOT pass/,
  );
  assert.match(
    qualification({ status: "completed", conclusion: "success" }),
    /completed successfully/,
  );
});

// This fixture is publication authorization logic, never operational evidence.
test("only the specifically prepared marked prerelease may receive assets", () => {
  const {
    assertPreparedRelease,
  } = require("../scripts/publish-existing-candidate");
  const expected = { releaseId: 21, source: "a".repeat(40), artifactId: 34 };
  const release = {
    id: 21,
    tag_name: "v2.0.0-rc.1",
    prerelease: true,
    draft: false,
    body: `GetANNY-RC-Existing: ${expected.source} / artifact 34`,
  };
  assert.doesNotThrow(() =>
    assertPreparedRelease(release, expected, "v2.0.0-rc.1"),
  );
  for (const change of [
    { id: 22 },
    { prerelease: false },
    { draft: true },
    { body: "unrelated release" },
    { tag_name: "v1.0.0" },
  ])
    assert.throws(() =>
      assertPreparedRelease({ ...release, ...change }, expected, "v2.0.0-rc.1"),
    );
});

test("draft release must contain every byte-verified asset before publication", async (t) => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { createHash } = require("node:crypto");
  const { verifyReleaseAssets } = require("../scripts/verify-release-assets");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "getanny-release-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const bytes = Buffer.from("test only");
  await fs.writeFile(path.join(dir, "GetANNY Setup.exe"), bytes);
  const release = {
    tag_name: "v2.0.0-rc.3",
    target_commitish: "commit",
    draft: true,
    prerelease: true,
    assets: [
      {
        label: "GetANNY Setup.exe",
        name: "GetANNY.Setup.exe",
        state: "uploaded",
        digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      },
    ],
  };
  const expected = { tag: "v2.0.0-rc.3", source: "commit" };
  assert.equal(await verifyReleaseAssets(release, dir, expected), 1);
  for (const change of [
    { draft: false },
    { prerelease: false },
    { target_commitish: "other" },
    { assets: [] },
    { assets: [{ ...release.assets[0], digest: "sha256:wrong" }] },
    { assets: [{ ...release.assets[0], state: "starter" }] },
  ])
    await assert.rejects(
      verifyReleaseAssets({ ...release, ...change }, dir, expected),
    );
});
