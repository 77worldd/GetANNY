const fs = require("node:fs/promises");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
async function getBridgeIdentity(userDataPath) {
  const file = path.join(userDataPath, "browser-bridge.json");
  try {
    const identity = JSON.parse(await fs.readFile(file, "utf8"));
    if (/^[a-f0-9]{64}$/.test(identity.token)) return identity;
  } catch {
    /* generate a new per-user identity */
  }
  const identity = { token: randomBytes(32).toString("hex") };
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(file, JSON.stringify(identity), { mode: 0o600 });
  return identity;
}
module.exports = { getBridgeIdentity };
