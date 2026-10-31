function showTrayWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function toggleTrayWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isVisible()) {
    window.hide();
    return;
  }
  showTrayWindow(window);
}

function shouldRevealOnActivation(hiddenToTray) {
  return !hiddenToTray;
}

module.exports = {
  showTrayWindow,
  toggleTrayWindow,
  shouldRevealOnActivation,
};
