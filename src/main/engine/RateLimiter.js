const { setTimeout: delay } = require("node:timers/promises");

// One limiter is shared by all connections of a transfer, not one independent
// allowance per chunk. Backpressure propagates all the way to the HTTP socket.
class RateLimiter {
  constructor(bytesPerSecond = 0) {
    this.setLimit(bytesPerSecond);
  }
  setLimit(value) {
    this.limit = Math.max(0, Number(value) || 0);
    this.next = performance.now();
  }
  async consume(bytes, signal) {
    if (!this.limit) return;
    const now = performance.now();
    this.next = Math.max(now, this.next) + (bytes * 1000) / this.limit;
    await delay(Math.max(0, this.next - now), undefined, { signal });
  }
}
module.exports = { RateLimiter };
