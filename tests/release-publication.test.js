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
