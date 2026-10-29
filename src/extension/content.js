(() => {
  const api = globalThis.browser || globalThis.chrome;
  const seen = new Set();
  const send = (media) => {
    if (!media.url || seen.has(media.url)) return;
    try {
      const url = new URL(media.url, location.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      seen.add(url.href);
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
  function scan() {
    for (const element of document.querySelectorAll("video,audio")) {
      const url = element.currentSrc || element.src;
      if (url && !url.startsWith("blob:")) send({ url, kind: "file" });
      else send({ url: location.href, kind: "media" });
      for (const source of element.querySelectorAll("source"))
        send({
          url: source.src,
          mimeType: source.type,
          kind: /mpegurl|dash/.test(source.type) ? "media" : "file",
        });
    }
  }
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 400);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  document.addEventListener("play", scan, true);
  scan();
})();
