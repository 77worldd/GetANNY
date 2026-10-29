const path = require("node:path");
const { createServices } = require("../src/main/services");
const { createHandlers } = require("../src/main/ipc-handlers");
module.exports = function previewPlugin() {
  return {
    name: "getanny-real-backend-preview",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(
        /\s*<meta http-equiv="Content-Security-Policy"[^>]*>/,
        "",
      );
    },
    async configureServer(server) {
      const root = path.resolve(__dirname, "..");
      const services = await createServices({
        userDataPath: path.join(root, ".arena", "preview-data"),
        downloadPath: path.join(root, ".arena", "preview-downloads"),
        binPath: path.join(root, "bin"),
        extensionPath: path.join(root, "dist-extension"),
        port: 0,
      });
      const handlers = createHandlers({ services });
      const streams = new Set();
      services.events.on("event", (channel, data) => {
        for (const response of streams)
          response.write(`data: ${JSON.stringify({ channel, data })}\n\n`);
      });
      server.middlewares.use("/__getanny/events", (request, response) => {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.write(": GetANNY real backend events\n\n");
        streams.add(response);
        request.on("close", () => streams.delete(response));
      });
      server.middlewares.use("/__getanny/invoke", async (request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        const origin = request.headers.origin;
        if (
          request.method !== "POST" ||
          request.headers["x-getanny-preview"] !== "1" ||
          (origin && new URL(origin).host !== request.headers.host)
        ) {
          response.statusCode = 403;
          response.end(
            JSON.stringify({ error: "Preview requests must be same-origin." }),
          );
          return;
        }
        try {
          let body = "";
          for await (const chunk of request) {
            body += chunk.toString();
            if (body.length > 128 * 1024) throw new Error("Request too large.");
          }
          const { channel, args = [] } = JSON.parse(body);
          if (!Object.hasOwn(handlers, channel) || !Array.isArray(args))
            throw new Error("Unsupported preview action.");
          response.end(
            JSON.stringify({ value: await handlers[channel](...args) }),
          );
        } catch (error) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: error.message }));
        }
      });
      server.httpServer?.once("close", async () => {
        for (const response of streams) response.end();
        await services.close();
      });
      console.log(
        "GetANNY web preview: real SQLite/download backend, isolated under .arena/. Desktop-only actions are unavailable.",
      );
    },
  };
};
