(() => {
  const api = globalThis.browser || globalThis.chrome;
  const provider =
    /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|dailymotion\.com|soundcloud\.com)$/i.test(
      location.hostname,
    );
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;z-index:2147483647;display:none;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML =
    '<style>button{all:initial;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:9px 12px;background:#171d23;color:#e9f1f5;border:1px solid #43535e;border-radius:6px;font:600 12px system-ui;cursor:pointer;box-shadow:0 3px 12px #0006}button:hover{background:#24313b;border-color:#80ccb2}button:focus-visible{outline:2px solid #80ccb2;outline-offset:2px}button:disabled{opacity:.65;cursor:wait}</style><button type="button" aria-label="Send media to GetANNY">↓ GetANNY</button>';
  document.documentElement.appendChild(host);
  const button = shadow.querySelector("button");
  let current;
  function place() {
    if (!current || !current.isConnected) {
      host.style.display = "none";
      return;
    }
    const box = current.getBoundingClientRect();
    if (
      box.width < 180 ||
      box.height < 100 ||
      box.bottom < 40 ||
      box.top > innerHeight - 40
    ) {
      host.style.display = "none";
      return;
    }
    host.style.display = "block";
    host.style.top = `${Math.max(8, box.top + 12)}px`;
    host.style.left = `${Math.max(8, Math.min(innerWidth - 132, box.right - 130))}px`;
  }
  document.addEventListener(
    "pointerover",
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        current = event.target;
        place();
      }
    },
    true,
  );
  document.addEventListener(
    "play",
    (event) => {
      if (event.target instanceof HTMLVideoElement) {
        current = event.target;
        place();
      }
    },
    true,
  );
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
  button.addEventListener("click", async () => {
    if (!current) return;
    const source = current.currentSrc || current.src;
    const media = provider || !/^https?:\/\//.test(source);
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const result = await api.runtime.sendMessage({
        type: "download",
        url: media ? location.href : source,
        kind: media ? "media" : "file",
      });
      button.textContent = result?.success
        ? result.action === "queued"
          ? "✓ Download queued"
          : "✓ Review in GetANNY"
        : "Could not send";
      button.title = result?.error || "Open GetANNY to manage this request.";
    } catch (error) {
      button.textContent = "Open GetANNY";
      button.title = error.message;
    } finally {
      button.disabled = false;
      setTimeout(() => {
        button.textContent = "↓ GetANNY";
      }, 3500);
    }
  });
})();
