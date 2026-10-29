const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
(async () => {
  const dir = path.resolve("release-assets");
  const files = (await fs.readdir(dir))
    .filter((name) => !name.endsWith(".sha256") && name !== "SHA256SUMS.txt")
    .sort();
  const lines = [];
  for (const name of files) {
    if (!(await fs.stat(path.join(dir, name))).isFile()) continue;
    const hash = createHash("sha256")
      .update(await fs.readFile(path.join(dir, name)))
      .digest("hex");
    lines.push(`${hash}  ${name}`);
  }
  await fs.writeFile(path.join(dir, "SHA256SUMS.txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
