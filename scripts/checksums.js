const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function writeChecksums(dir = path.resolve("release-assets")) {
  const files = (await fs.readdir(dir))
    .filter((name) => !name.endsWith(".sha256") && name !== "SHA256SUMS.txt")
    .sort();
  const lines = [];
  for (const name of files) {
    const file = path.join(dir, name);
    if (!(await fs.stat(file)).isFile()) continue;
    lines.push(`${await hashFile(file)}  ${name}`);
  }
  await fs.writeFile(path.join(dir, "SHA256SUMS.txt"), lines.join("\n") + "\n");
  return lines;
}

if (require.main === module) {
  writeChecksums()
    .then((lines) => console.log(lines.join("\n")))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
module.exports = { hashFile, writeChecksums };
