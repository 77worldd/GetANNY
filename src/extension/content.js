(() => {
  const api = globalThis.browser || globalThis.chrome;
  const seen = new Set();
  const send = (media) => {
    if (!media.url || seen.has(media.url)) return;
    try {
      const url = new URL(media.url, location.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      seen.add(url.href);
      // Media-heavy long-lived pages must not grow this cache indefinitely.
      if (seen.size > 100) seen.delete(seen.values().next().value);
      api.runtime
        .sendMessage({
          type: "media-detected",
          media: { ...media, url: url.href, title: document.title },
        })
        .catch(() => {});
    } catch {
      /* non-downloadable URL */
    }
  };
  function element(root) {
    if (!(root instanceof Element)) return;
    if (root.matches("video,audio")) {
      const url = root.currentSrc || root.src;
      if (url && !url.startsWith("blob:")) send({ url, kind: "file" });
      else send({ url: location.href, kind: "media" });
    }
    if (root.matches("source") && root.parentElement?.matches("video,audio"))
      send({
        url: root.src,
        mimeType: root.type,
        kind: /mpegurl|dash/.test(root.type) ? "media" : "file",
      });
  }
  function scan(root = document) {
    element(root);
    if (root.querySelectorAll)
      for (const node of root.querySelectorAll("video,audio,source"))
        element(node);
  }
  const pending = new Set();
  let timer;
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // Only newly inserted subtrees are scanned, never the whole document on
        // every mutation. Coalesce framework bursts into one inexpensive pass.
        if (pending.size < 100) pending.add(node);
      }
    if (!pending.size) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const node of pending) scan(node);
      pending.clear();
    }, 300);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  document.addEventListener("play", (event) => scan(event.target), true);
  scan();
})();
