const { parentPort, workerData: data } = require("node:worker_threads");
const fs = require("node:fs");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { request, validateRange, httpError } = require("./http");
const controller = new AbortController();
const pending = new Map();
let counter = 0;
parentPort.on("message", (message) => {
  if (message.type === "grant") {
    pending.get(message.requestId)?.();
    pending.delete(message.requestId);
  }
  if (message.type === "cancel") {
    controller.abort();
    for (const resolve of pending.values()) resolve();
    pending.clear();
  }
});
async function run() {
  const start = data.start + data.existing;
  const headers = { ...data.headers, Range: `bytes=${start}-${data.end}` };
  if (data.etag || data.lastModified)
    headers["If-Range"] = data.etag || data.lastModified;
  const { response } = await request(data.url, {
    headers,
    timeout: data.timeout,
    signal: controller.signal,
    requestOptions: data.requestOptions,
  });
  if (response.statusCode >= 400) {
    response.destroy();
    throw httpError(response.statusCode);
  }
  validateRange(response, start, data.end, data.totalSize);
  if (
    response.headers["content-encoding"] &&
    response.headers["content-encoding"] !== "identity"
  ) {
    response.destroy();
    throw new Error("Encoded range responses are not safe to assemble.");
  }
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      const requestId = ++counter;
      new Promise((resolve) => {
        pending.set(requestId, resolve);
        parentPort.postMessage({
          type: "throttle",
          bytes: chunk.length,
          requestId,
        });
      })
        .then(() => {
          controller.signal.throwIfAborted();
          received += chunk.length;
          if (received > data.end - start + 1)
            throw new Error("Segment exceeds its requested byte range.");
          parentPort.postMessage({ type: "progress", bytes: chunk.length });
          callback(null, chunk);
        })
        .catch(callback);
    },
  });
  await pipeline(
    response,
    meter,
    fs.createWriteStream(data.file, { flags: data.existing ? "a" : "w" }),
    { signal: controller.signal },
  );
  if (received !== data.end - start + 1)
    throw new Error("Segment ended before all requested bytes arrived.");
  parentPort.postMessage({ type: "done" });
}
run()
  .catch((error) =>
    parentPort.postMessage({
      type: "error",
      error: error.message,
      retryable: !!error.retryable,
    }),
  )
  .finally(() => parentPort.close());
