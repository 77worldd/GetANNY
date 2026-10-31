const fs = require("node:fs");
const path = require("node:path");

function desktopExitMarkerPath(userDataPath) {
  return path.join(userDataPath, "native-messaging", "desktop-exit.json");
}

function isDesktopExitMarked(markerPath) {
  return Boolean(markerPath && fs.existsSync(markerPath));
}

function markDesktopExited(markerPath) {
  if (!markerPath) return false;
  try {
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(
      markerPath,
      JSON.stringify({ closedAt: new Date().toISOString() }),
      { mode: 0o600 },
    );
    return true;
  } catch {
    return false;
  }
}

function clearDesktopExitMarker(markerPath) {
  if (!markerPath) return false;
  try {
    fs.rmSync(markerPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  desktopExitMarkerPath,
  isDesktopExitMarked,
  markDesktopExited,
  clearDesktopExitMarker,
};
