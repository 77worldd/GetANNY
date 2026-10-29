const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { WebSocketServer } = require("./WebSocketServer");
test("unauthenticated WebSocket ping is not proof of an extension connection", async (t) => {
  const bridge = new WebSocketServer({ port: 0, token: "a".repeat(64) });
  await new Promise((resolve, reject) => {
    bridge.server.once("listening", resolve);
    bridge.server.once("error", reject);
  });
  const client = new WebSocket(`ws://127.0.0.1:${bridge.status().port}`);
  await new Promise((resolve, reject) => {
    client.once("open", resolve);
    client.once("error", reject);
  });
  t.after(async () => {
    client.terminate();
    await bridge.close();
  });
  const reply = new Promise((resolve) =>
    client.once("message", (raw) => resolve(JSON.parse(raw))),
  );
  client.send(JSON.stringify({ type: "ping" }));
  assert.equal((await reply).authenticated, false);
  assert.equal(bridge.status().clients, 0);
});
