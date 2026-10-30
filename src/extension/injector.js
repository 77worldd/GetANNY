(() => {
  const api = globalThis.browser || globalThis.chrome;
  const provider =
    /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|dailymotion\.com|soundcloud\.com)$/i.test(
      location.hostname,
    );
  const dismissed = new Set();
  let current, host, button, close, frame;
  const key = () => {
    const url = new URL(location.href);
    const video = url.searchParams.get("v");
    return /(^|\.)youtube\.com$/i.test(location.hostname) && video
      ? `youtube:${video}`
      : `${url.origin}${url.pathname}`;
  };
  const isDismissed = () => {
    const id = key();
    if (dismissed.has(id)) return true;
    try {
      return sessionStorage.getItem(`getanny-overlay:${id}`) === "1";
    } catch {
      return false;
    }
  };
  function ensure() {
    if (host) return;
    let logo = "icons/icon48.png";
    try {
      logo = api.runtime.getURL("icons/icon48.png");
    } catch {
      /* keep a relative resource path if the API is unavailable */
    }
    host = document.createElement("div");
    host.style.cssText =
      "position:fixed;z-index:2147483646;display:none;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      .wrap{display:flex;align-items:center;gap:4px;pointer-events:auto;font-family:system-ui,-apple-system,sans-serif}
      button{all:initial;box-sizing:border-box;display:flex;align-items:center;justify-content:center;height:28px;background:#151d24eF;color:#e8f0f2;border:1px solid #40515c;cursor:pointer;font:600 11px/1 system-ui,-apple-system,sans-serif;transition:background .12s,border-color .12s}
      .send{gap:5px;padding:0 8px;border-radius:6px;box-shadow:0 2px 8px #0004;white-space:nowrap}
      .logo{width:15px;height:15px;object-fit:contain;display:block;flex:none}
      .dismiss{width:22px;height:22px;margin-left:1px;border-radius:50%;background:#151d24d9;color:#b9c5cc;font-size:14px;font-weight:400}
      button:hover{background:#24323b;border-color:#a2dfc2;color:#fff}
      button:focus-visible{outline:2px solid #a2dfc2;outline-offset:2px}
      button:disabled{opacity:.65;cursor:wait}
      @media(prefers-reduced-motion:reduce){button{transition:none}}
    </style><div class="wrap"><button class="send" type="button" aria-label="Send media to GetANNY"><img class="logo" alt="" src="${logo}" draggable="false"><span class="label">GetANNY</span></button><button class="dismiss" type="button" aria-label="Dismiss GetANNY for this video" title="Dismiss for this video">×</button></div>`;
    document.documentElement.appendChild(host);
    button = shadow.querySelector(".send");
    close = shadow.querySelector(".dismiss");
    button.addEventListener("click", send);
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = key();
      dismissed.add(id);
      try {
        sessionStorage.setItem(`getanny-overlay:${id}`, "1");
      } catch {
        /* in-memory dismissal still covers this viewing session */
      }
      hide();
    });
  }
  function hide() {
    if (host) host.style.display = "none";
  }
  function place() {
    frame = null;
    if (!host) return;
    if (!current?.isConnected || isDismissed() || document.fullscreenElement) {
      hide();
      return;
    }
    const box = current.getBoundingClientRect();
    if (
      box.width < 180 ||
      box.height < 100 ||
      box.bottom < 40 ||
      box.top > innerHeight - 40
    ) {
      hide();
      return;
    }
    host.style.display = "block";
    const width = host.offsetWidth || 112;
    host.style.top = `${Math.max(6, box.top + 8)}px`;
    host.style.left = `${Math.max(6, Math.min(innerWidth - width - 6, box.right - width - 8))}px`;
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(place);
  }
  function activate(video) {
    if (isDismissed()) return;
    ensure();
    current = video;
    schedule();
  }
  document.addEventListener(
    "pointerover",
    (event) => {
      if (event.target instanceof HTMLVideoElement) activate(event.target);
    },
    true,
  );
  document.addEventListener(
    "play",
    (event) => {
      if (event.target instanceof HTMLVideoElement) activate(event.target);
    },
    true,
  );
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  document.addEventListener("fullscreenchange", schedule);
  document.addEventListener("yt-navigate-finish", () => {
    current = null;
    hide();
  });
  async function send() {
    if (!current) return;
    const source = current.currentSrc || current.src;
    const media = provider || !/^https?:\/\//.test(source);
    button.disabled = true;
    shadowLabel("Sending…");
    try {
      const result = await api.runtime.sendMessage({
        type: "download",
        url: media ? location.href : source,
        kind: media ? "media" : "file",
      });
      shadowLabel(result?.success ? "Sent ✓" : "Unavailable");
      button.title = result?.error || "Open GetANNY to manage this request.";
    } catch (error) {
      shadowLabel("Open GetANNY");
      button.title = error.message;
    } finally {
      button.disabled = false;
      setTimeout(() => shadowLabel("GetANNY"), 2500);
    }
  }
  function shadowLabel(text) {
    const label = button?.querySelector(".label");
    if (label) label.textContent = text;
  }
})();
