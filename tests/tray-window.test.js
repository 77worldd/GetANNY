const test = require("node:test");
const assert = require("node:assert/strict");
const {
  showTrayWindow,
  toggleTrayWindow,
  shouldRevealOnActivation,
} = require("../src/main/tray-window");

function fakeWindow({ visible = false, minimized = false, destroyed = false } = {}) {
  const calls = [];
  return {
    calls,
    isDestroyed: () => destroyed,
    isMinimized: () => minimized,
    isVisible: () => visible,
    restore: () => calls.push("restore"),
    show: () => calls.push("show"),
    focus: () => calls.push("focus"),
    hide: () => calls.push("hide"),
  };
}

test("tray click hides a visible window and reveals a hidden one", () => {
  const visible = fakeWindow({ visible: true });
  toggleTrayWindow(visible);
  assert.deepEqual(visible.calls, ["hide"]);

  const hidden = fakeWindow();
  toggleTrayWindow(hidden);
  assert.deepEqual(hidden.calls, ["show", "focus"]);
});

test("explicit tray show restores and focuses a minimized window", () => {
  const window = fakeWindow({ minimized: true });
  showTrayWindow(window);
  assert.deepEqual(window.calls, ["restore", "show", "focus"]);
});

test("tray actions ignore a destroyed window", () => {
  const window = fakeWindow({ destroyed: true });
  showTrayWindow(window);
  toggleTrayWindow(window);
  assert.deepEqual(window.calls, []);
});

test("OS activation does not reopen a window intentionally hidden to tray", () => {
  assert.equal(shouldRevealOnActivation(true), false);
  assert.equal(shouldRevealOnActivation(false), true);
});
