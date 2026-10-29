const http = require("node:http");
const https = require("node:https");
const { validateUrl } = require("./utils");
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function httpError(status, detail = "") {
  const error = new Error(`HTTP ${status}${detail ? `: ${detail}` : ""}`);
  error.statusCode = status;
  error.retryable = status === 408 || status === 429 || status >= 500;
  return error;
}
async function request(
  url,
  {
    method = "GET",
    headers = {},
    timeout = 30000,
    signal,
    requestOptions = {},
  } = {},
) {
  let current = validateUrl(url);
  let forwarded = { ...headers };
  for (let redirects = 0; redirects <= 10; redirects++) {
    signal?.throwIfAborted();
    const parsed = new URL(current);
    const response = await new Promise((resolve, reject) => {
      const transport = parsed.protocol === "https:" ? https : http;
      const req = transport.request(
        parsed,
        {
          ...requestOptions,
          method,
          signal,
          headers: {
            "User-Agent": "GetANNY/2.0",
            "Accept-Encoding": "identity",
            ...forwarded,
          },
        },
        resolve,
      );
      req.setTimeout(timeout, () => {
        const error = new Error(
          `The server did not respond for ${Math.round(timeout / 1000)} seconds.`,
        );
        error.retryable = true;
        req.destroy(error);
      });
      req.once("error", (error) => {
        if (
          ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ECONNREFUSED"].includes(
            error.code,
          )
        )
          error.retryable = true;
        reject(error);
      });
      req.end();
    });
    if (REDIRECTS.has(response.statusCode) && response.headers.location) {
      const next = validateUrl(
        new URL(response.headers.location, current).href,
      );
      response.destroy();
      if (new URL(next).origin !== parsed.origin) {
        forwarded = Object.fromEntries(
          Object.entries(forwarded).filter(
            ([key]) =>
              !["authorization", "cookie", "proxy-authorization"].includes(
                key.toLowerCase(),
              ),
          ),
        );
      }
      current = next;
      continue;
    }
    return { response, url: current, headers: forwarded };
  }
  throw new Error("The server redirected this download too many times.");
}
function parseRange(value) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value || "");
  if (!match) return null;
  const [start, end, total] = match.slice(1).map(Number);
  if (
    ![start, end, total].every(Number.isSafeInteger) ||
    start > end ||
    end >= total
  )
    return null;
  return { start, end, total };
}
function validateRange(response, start, end, total) {
  const range = parseRange(response.headers["content-range"]);
  if (
    response.statusCode !== 206 ||
    !range ||
    range.start !== start ||
    range.end !== end ||
    range.total !== total
  ) {
    response.destroy();
    throw new Error(
      "The server returned an incorrect byte range. The partial file was not marked complete.",
    );
  }
  const length = response.headers["content-length"];
  if (length !== undefined && Number(length) !== end - start + 1) {
    response.destroy();
    throw new Error(
      "The range response length does not match the requested bytes.",
    );
  }
}
module.exports = { request, httpError, parseRange, validateRange };
