const path = require("node:path");
async function launchOptions() {
  if (process.platform !== "linux" || process.env.PLAYWRIGHT_USE_INSTALLED)
    return { headless: true };
  const bundled = await import("@sparticuz/chromium");
  // The sandbox lacks NSS. These are the browser package's runtime libraries,
  // not modifications to the host system or an untrusted download mirror.
  await bundled.inflate(
    path.resolve(
      __dirname,
      "../node_modules/@sparticuz/chromium/bin/al2023.tar.br",
    ),
  );
  bundled.setupLambdaEnvironment("/tmp/al2023/lib");
  return {
    executablePath: await bundled.default.executablePath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  };
}
module.exports = { launchOptions };
