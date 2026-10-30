const WebSocket = require("ws");
const { timingSafeEqual, randomBytes, randomUUID } = require("node:crypto");
const { getBrowser, CHROMIUM_ID, FIREFOX_ID } = require("./catalog");
function equalSecret(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    Buffer.byteLength(a) !== Buffer.byteLength(b)
  )
    return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
class WebSocketServer {
  constructor({
    port = 29615,
    token = randomBytes(32).toString("hex"),
    enabled = true,
    onMediaDetected = () => {},
    onDownloadRequest = async () => {
      throw new Error("Download handler unavailable.");
    },
    onDownloadStatus = async () => ({ action: "missing" }),
    onHello = () => {},
    theme = null,
  } = {}) {
    Object.assign(this, {
      port,
      token,
      enabled,
      onMediaDetected,
      onDownloadRequest,
      onDownloadStatus,
      onHello,
      theme,
    });
    this.clients = new Map();
    this.browserCommands = new Map();
    this.server = new WebSocket.Server({
      host: "127.0.0.1",
      port,
      maxPayload: 128 * 1024,
      verifyClient: ({ origin }) =>
        !origin ||
        origin === `chrome-extension://${CHROMIUM_ID}` ||
        /^moz-extension:\/\/[a-f0-9-]+$/i.test(origin),
    });
    this.server.on("listening", () => {
      this.port = this.server.address().port;
    });
    this.server.on("error", (error) => {
      this.error = error;
    });
    this.server.on("connection", (socket, request) => {
      const state = {
        sessionId: randomUUID(),
        authenticated: false,
        lastSeen: Date.now(),
        origin: request.headers.origin || null,
        pendingRequests: new Set(),
      };
      this.clients.set(socket, state);
      const authTimeout = setTimeout(() => {
        if (!state.authenticated) socket.close(1008, "Pairing required");
      }, 10000);
      socket.on("close", () => {
        clearTimeout(authTimeout);
        this.clients.delete(socket);
      });
      socket.on("error", () => {
        clearTimeout(authTimeout);
        this.clients.delete(socket);
      });
      socket.on("message", (raw) => this.handle(socket, state, raw));
    });
    this.heartbeat = setInterval(() => {
      for (const [socket, state] of this.clients)
        if (Date.now() - state.lastSeen > 65000) socket.terminate();
    }, 15000);
    this.heartbeat.unref?.();
  }
  async handle(socket, state, raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
      if (!message || typeof message !== "object" || Array.isArray(message))
        throw new Error("Invalid bridge message.");
      state.lastSeen = Date.now();
      if (message.type === "authenticate") {
        if (!this.enabled)
          throw new Error(
            "Browser integration is disabled in GetANNY settings.",
          );
        if (!equalSecret(message.token, this.token)) {
          this.reply(socket, {
            type: "authentication-error",
            success: false,
            error:
              "Pairing key is incorrect. Copy the key from Browser integration in GetANNY.",
          });
          socket.close(1008, "Invalid pairing");
          return;
        }
        state.authenticated = true;
        state.transport =
          message.transport === "native" && !state.origin
            ? "native"
            : "websocket";
        this.reply(socket, { type: "authenticated", success: true });
        return;
      }
      if (message.type === "ping") {
        this.reply(socket, {
          type: "pong",
          requestId: message.requestId,
          authenticated: state.authenticated && !!state.browserId,
        });
        return;
      }
      if (!this.enabled || !state.authenticated)
        throw new Error(
          "Connect through the registered native host or pair this extension first.",
        );
      if (message.type === "hello") {
        getBrowser(message.browserId);
        if (![CHROMIUM_ID, FIREFOX_ID].includes(message.extensionId))
          throw new Error("Unrecognized GetANNY extension identity.");
        if (
          message.browserId === "firefox" &&
          message.extensionId !== FIREFOX_ID
        )
          throw new Error("Use the Firefox extension build.");
        state.browserId = message.browserId;
        state.extensionId = message.extensionId;
        state.version = String(message.version || "").slice(0, 40);
        this.onHello({ ...state });
        this.reply(socket, {
          type: "hello-result",
          requestId: message.requestId,
          success: true,
          connected: true,
          browserId: state.browserId,
          transport: state.transport,
          theme: this.theme,
        });
      } else if (!state.browserId)
        throw new Error(
          "Extension handshake is incomplete. Reconnect the extension.",
        );
      else if (message.type === "browser-download-result") {
        const pending = this.browserCommands.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.browserCommands.delete(message.requestId);
          pending.resolve(message);
        }
      } else if (message.type === "download-status") {
        const result = await this.onDownloadStatus(
          {
            transferId: String(message.transferId || "").slice(0, 100),
            source: state.browserId,
          },
          { sessionId: state.sessionId },
        );
        this.reply(socket, {
          type: "download-status-result",
          requestId: message.requestId,
          success: true,
          ...result,
        });
      } else if (message.type === "download") {
        if (state.pendingRequests.size >= 20)
          throw new Error(
            "Too many browser downloads are being handed off. Try again shortly.",
          );
        const key = String(message.requestId || randomUUID());
        state.pendingRequests.add(key);
        try {
          const result = await this.onDownloadRequest(
            {
              url: message.url,
              filename: message.filename,
              headers: message.headers,
              mimeType: message.mimeType,
              kind: message.kind === "media" ? "media" : "file",
              intercepted: message.intercepted === true,
              transferId:
                typeof message.transferId === "string"
                  ? message.transferId.slice(0, 100)
                  : null,
              source: state.browserId,
            },
            { sessionId: state.sessionId },
          );
          this.reply(socket, {
            type: "download-result",
            requestId: message.requestId,
            success: true,
            ...result,
          });
        } finally {
          state.pendingRequests.delete(key);
        }
      } else if (message.type === "media-detected") {
        if (
          typeof message.url === "string" &&
          /^https?:\/\//.test(message.url) &&
          message.url.length < 8192
        )
          this.onMediaDetected({
            url: message.url,
            pageUrl: message.pageUrl,
            title: String(message.title || "").slice(0, 240),
            source: state.browserId,
            detectedAt: Date.now(),
          });
      } else throw new Error("Unsupported bridge action.");
    } catch (error) {
      this.reply(socket, {
        type: "error",
        requestId: message?.requestId,
        success: false,
        error: error.message,
      });
    }
  }
  reply(socket, data) {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
  }
  downloadCommand(sessionId, action, transferId) {
    const session = [...this.clients.entries()].find(
      ([socket, state]) =>
        state.sessionId === sessionId &&
        state.browserId &&
        socket.readyState === WebSocket.OPEN,
    );
    if (!session) return Promise.resolve({ success: false, missing: true });
    const [socket] = session;
    const requestId = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.browserCommands.delete(requestId);
        resolve({ success: false, error: "Browser command timed out." });
      }, 8000);
      this.browserCommands.set(requestId, { resolve, timer });
      this.reply(socket, {
        type: "browser-download-command",
        requestId,
        action,
        transferId: String(transferId),
      });
    });
  }
  setTheme(theme) {
    this.theme = theme || null;
    if (!this.theme) return;
    for (const [socket, state] of this.clients)
      if (state.authenticated && state.browserId && socket.readyState === WebSocket.OPEN)
        this.reply(socket, { type: "theme", theme: this.theme });
  }
  status() {
    const sessions = [...this.clients.values()]
      .filter(
        (client) =>
          client.authenticated &&
          client.browserId &&
          Date.now() - client.lastSeen < 65000,
      )
      .map(({ browserId, transport, version, lastSeen }) => ({
        browserId,
        transport,
        version,
        lastSeen,
      }));
    return {
      running: !!this.server?.address(),
      enabled: this.enabled,
      port: this.port,
      clients: sessions.length,
      sessions,
      error: this.error?.message || null,
    };
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled)
      for (const socket of this.clients.keys())
        socket.close(1008, "Browser integration disabled");
  }
  async close() {
    clearInterval(this.heartbeat);
    for (const pending of this.browserCommands.values()) {
      clearTimeout(pending.timer);
      pending.resolve({ success: false, error: "Desktop bridge closed." });
    }
    this.browserCommands.clear();
    for (const socket of this.clients.keys()) socket.terminate();
    this.clients.clear();
    await new Promise((resolve) => this.server.close(resolve));
  }
}
module.exports = { WebSocketServer, equalSecret };
