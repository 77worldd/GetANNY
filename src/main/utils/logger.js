const fs = require("node:fs");
const path = require("node:path");
class Logger {
  constructor(scope = "app") {
    this.scope = scope;
  }
  write(level, args) {
    const line = `[${new Date().toISOString()}] [${level}] [${this.scope}] ${args.map((x) => (x instanceof Error ? x.stack : typeof x === "string" ? x : JSON.stringify(x))).join(" ")}\n`;
    (level === "ERROR"
      ? console.error
      : level === "WARN"
        ? console.warn
        : console.log)(line.trimEnd());
    try {
      const base = process.env.GETANNY_LOG_DIR || require("node:os").tmpdir();
      fs.appendFileSync(path.join(base, "getanny.log"), line);
    } catch {}
  }
  info(...a) {
    this.write("INFO", a);
  }
  warn(...a) {
    this.write("WARN", a);
  }
  error(...a) {
    this.write("ERROR", a);
  }
  debug(...a) {
    if (process.env.GETANNY_DEBUG) this.write("DEBUG", a);
  }
}
module.exports = { Logger };
