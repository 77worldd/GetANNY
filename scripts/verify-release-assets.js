// Verify the exact bytes of a draft release before making it public.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { hashFile } = require("./checksums");

async function verifyReleaseAssets(release, directory, { tag, source }) {
  assert.equal(release.tag_name, tag, "Wrong release tag");
  assert.equal(release.target_commitish, source, "Wrong release source");
  assert.equal(
    release.draft,
    true,
    "Release must remain a draft until verified",
  );
  assert.equal(
    release.prerelease,
    true,
    "Only release candidates may be published",
  );
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  assert.ok(names.length > 0, "Release directory is empty");
  assert.equal(
    release.assets.length,
    names.length,
    "Release asset count differs",
  );
  for (const name of names) {
    const matches = release.assets.filter(
      (asset) => asset.label === name || asset.name === name,
    );
    assert.equal(
      matches.length,
      1,
      `Missing or duplicate uploaded asset: ${name}`,
    );
    const asset = matches[0];
    assert.equal(asset.state, "uploaded", `Asset not uploaded: ${name}`);
    assert.equal(
      asset.digest,
      `sha256:${await hashFile(path.join(directory, name))}`,
      `Asset digest mismatch: ${name}`,
    );
  }
  return names.length;
}

if (require.main === module) {
  (async () => {
    const [file, dir, tag, source] = process.argv.slice(2);
    assert.ok(
      file && dir && tag && source,
      "Usage: verify-release-assets <release.json> <dir> <tag> <source>",
    );
    const release = JSON.parse(await fs.readFile(file, "utf8"));
    const count = await verifyReleaseAssets(release, dir, { tag, source });
    console.log(
      `Verified ${count} uploaded draft assets against local SHA-256 digests.`,
    );
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { verifyReleaseAssets };
