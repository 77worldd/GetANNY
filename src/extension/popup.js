const api = globalThis.browser || globalThis.chrome;
const $ = (id) => document.getElementById(id);
const status = $("status"),
  message = $("message");
function feedback(text, error = false) {
  message.textContent = text;
  message.className = error ? "error" : "";
}
function applyTheme(theme) {
  if (!theme || typeof theme !== "object" || !theme.colors) return;
  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.colors))
    if (/^--[a-z0-9-]+$/.test(token) && typeof value === "string")
      root.style.setProperty(token, value);
  root.style.colorScheme = theme.mode === "light" ? "light" : "dark";
  root.dataset.theme = theme.id || "nord";
}
api.runtime.onMessage.addListener((incoming) => {
  if (incoming?.type === "theme") applyTheme(incoming.theme);
});
async function send(payload) {
  const response = await api.runtime.sendMessage(payload);
  if (response?.success === false) throw new Error(response.error);
  return response;
}
async function refresh() {
  try {
    const response = await send({ type: "status" });
    status.className = `connection ${response.connected ? "online" : "offline"}`;
    status.textContent = response.connected
      ? `Connected · ${response.transport === "native" ? "Native host" : "Paired WebSocket"}`
      : response.error || "Waiting for desktop handshake…";
  } catch (error) {
    status.textContent = error.message;
    status.className = "connection offline";
  }
}
async function submit(url, kind) {
  $("send").disabled = true;
  feedback("Waiting for desktop acknowledgement…");
  try {
    const response = await send({ type: "download", url, kind });
    feedback(
      response.action === "queued"
        ? "Download queued in GetANNY."
        : response.action === "analyze"
          ? "Media page opened in GetANNY. Choose a format there."
          : "Sent for review in GetANNY. Confirm the destination there.",
    );
  } catch (error) {
    feedback(error.message, true);
  } finally {
    $("send").disabled = false;
    refresh();
  }
}
$("download-form").addEventListener("submit", (event) => {
  event.preventDefault();
  submit($("url").value.trim(), $("kind").value);
});
$("tab").onclick = async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (/^https?:\/\//.test(tab?.url || "")) {
    $("url").value = tab.url;
    $("kind").value = "media";
  } else feedback("This browser page cannot be downloaded.", true);
};
$("reconnect").onclick = async () => {
  status.textContent = "Reconnecting…";
  try {
    await send({ type: "reconnect" });
  } catch (error) {
    feedback(error.message, true);
  }
  refresh();
};
$("pair").onclick = async () => {
  $("pair").disabled = true;
  try {
    await send({
      type: "configure",
      browserId: $("browser").value,
      pairingKey: $("pairing").value,
    });
    feedback("Desktop handshake verified.");
  } catch (error) {
    feedback(error.message, true);
  } finally {
    $("pair").disabled = false;
    refresh();
  }
};
(async () => {
  try {
    applyTheme(await send({ type: "theme" }));
  } catch {
    /* the popup still works without a synced palette */
  }
  const saved = await api.storage.local.get(["browserId", "pairingKey"]);
  $("browser").value =
    saved.browserId || globalThis.GETANNY_BROWSER || "chrome";
  $("pairing").value = saved.pairingKey || "";
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const response = await send({ type: "detected", tabId: tab?.id });
  const items = response?.items || [];
  $("detected-section").hidden = !items.length;
  for (const item of items) {
    const button = document.createElement("button");
    button.className = "detected-item";
    let name;
    try {
      name =
        decodeURIComponent(new URL(item.url).pathname.split("/").pop()) ||
        item.title;
    } catch {
      name = item.title;
    }
    button.textContent = `${item.kind === "media" ? "Analyze" : "Download"} · ${name || item.mimeType || "Media"}`;
    button.title = item.url;
    button.onclick = () => submit(item.url, item.kind);
    $("detected").appendChild(button);
  }
})().catch((error) => feedback(error.message, true));
refresh();
setInterval(refresh, 2000);
