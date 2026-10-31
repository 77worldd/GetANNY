const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { WebSocket } = require("ws");
const {
  clearDesktopExitMarker,
  isDesktopExitMarked,
  markDesktopExited,
} = require("./DesktopExitMarker");

function runNativeHost({
  config,
  input = process.stdin,
  output = process.stdout,
  exit = (code) => process.exit(code),
} = {}) {
  if (!config) {
    const index = process.argv.indexOf("--config");
    if (index < 0) throw new Error("Native-host configuration is required.");
    config = JSON.parse(fs.readFileSync(process.argv[index + 1], "utf8"));
  }
  let buffer = Buffer.alloc(0),
    socket,
    closed = false,
    authenticated = false,
    timer,
    launched = false,
    hadDesktop = false,
    reconnectAttempt = 0;
  const queue = [];
  let lastHello;
  function send(message) {
    if (closed) return;
    const body = Buffer.from(JSON.stringify(message));
    if (body.length > 1024 * 1024) return;
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length);
    output.write(Buffer.concat([header, body]));
  }
  function close(code = 0) {
    closed = true;
    clearTimeout(timer);
    socket?.terminate();
    exit(code);
  }
  function connect() {
    if (closed) return;
    authenticated = false;
    socket = new WebSocket(`ws://127.0.0.1:${config.port || 29615}`);
    socket.on("open", () => {
      clearDesktopExitMarker(config.desktopExitMarker);
      hadDesktop = true;
      socket.send(
        JSON.stringify({
          type: "authenticate",
          token: config.token,
          transport: "native",
        }),
      );
    });
    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "authenticated") {
          authenticated = true;
          reconnectAttempt = 0;
          if (lastHello && !queue.some((message) => message.type === "hello"))
            socket.send(JSON.stringify(lastHello));
          while (queue.length) socket.send(JSON.stringify(queue.shift()));
        } else send(message);
      } catch {
        send({
          type: "transport-error",
          success: false,
          error: "Invalid response from GetANNY.",
        });
      }
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      authenticated = false;
      if (closed) return;
      if (hadDesktop) markDesktopExited(config.desktopExitMarker);
      send({
        type: "transport-error",
        success: false,
        error: hadDesktop
          ? "GetANNY desktop connection closed. Open the app or choose Reconnect."
          : config.appPath
            ? "Starting or reconnecting to GetANNY…"
            : "GetANNY desktop bridge is offline. Start the app.",
      });
      const delay = Math.min(30000, 1500 * 2 ** reconnectAttempt++);
      timer = setTimeout(() => {
        if (closed) return;
        if (
          !launched &&
          !hadDesktop &&
          config.appPath &&
          !isDesktopExitMarked(config.desktopExitMarker)
        ) {
          launched = true;
          const env = { ...process.env };
          delete env.ELECTRON_RUN_AS_NODE;
          const child = spawn(config.appPath, ["--from-browser"], {
            env,
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          });
          child.on("error", () => {});
          child.unref();
        }
        connect();
      }, delay);
    });
  }
  input.on("data", (data) => {
    buffer = Buffer.concat([buffer, data]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (!length || length > 128 * 1024) {
        send({
          type: "error",
          success: false,
          error: "Native message exceeds the allowed size.",
        });
        close(1);
        return;
      }
      if (buffer.length < 4 + length) break;
      let message;
      try {
        message = JSON.parse(buffer.subarray(4, 4 + length).toString());
      } catch {
        send({ type: "error", success: false, error: "Invalid native JSON." });
        buffer = buffer.subarray(4 + length);
        continue;
      }
      buffer = buffer.subarray(4 + length);
      if (message.type === "hello") lastHello = message;
      if (authenticated && socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(message));
      else if (queue.length < 20) queue.push(message);
      else
        send({
          type: "error",
          requestId: message.requestId,
          success: false,
          error: "Desktop is offline and the native request queue is full.",
        });
    }
  });
  input.on("end", () => close());
  input.on("error", () => close(1));
  connect();
  return { close };
}
if (require.main === module) {
  try {
    runNativeHost();
  } catch (error) {
    process.stderr.write(`GetANNY native host: ${error.message}\n`);
    process.exitCode = 1;
  }
}
module.exports = { runNativeHost };
