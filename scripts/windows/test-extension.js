// Runs the REAL unpacked Chromium extension in a real browser against the
// INSTALLED Electron app and its registered native executable. No fake API.
const { chromium, expect } = require("@playwright/test");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fixtureServer, waitFor, checksum } = require("../../tests/helpers");
const { mediaFixture } = require("../../tests/media-fixture");
const { CHROMIUM_ID } = require("../../src/main/browser-integration/catalog");
const exec = promisify(execFile);
(async () => {
  const [executable, root, browserId = "chromium", browserExecutable] =
    process.argv.slice(2);
  if (!executable || !root)
    throw new Error(
      "Usage: node test-extension.js installed.exe report-folder",
    );
  await fs.mkdir(root, { recursive: true });
  const work = path.join(
    process.env.RUNNER_TEMP || require("node:os").tmpdir(),
    `getanny-browser-${process.pid}`,
  );
  await fs.mkdir(work, { recursive: true });
  const userData = path.join(work, "extension-app-data"),
    cleanups = [];
  const t = {
    after: (fn) => cleanups.push(fn),
    skip: (reason) => {
      throw new Error(reason);
    },
  };
  const fixture = await fixtureServer(t, { size: 1024 * 1024, delay: 5 }),
    media = await mediaFixture(t);
  const app = spawn(
    executable,
    ["--test-user-data", userData, "--remote-debugging-port=9223"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "";
  app.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  app.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  let electron, browser;
  try {
    await waitFor(
      async () => {
        try {
          return (await fetch("http://127.0.0.1:9223/json/version")).ok;
        } catch {
          return false;
        }
      },
      30000,
      "installed Electron remote debugging",
    );
    electron = await chromium.connectOverCDP("http://127.0.0.1:9223");
    let page;
    await waitFor(
      () => {
        page = electron
          .contexts()[0]
          ?.pages()
          .find((page) => page.url().startsWith("file://"));
        return !!page;
      },
      30000,
      "installed renderer page",
    );
    await page.waitForSelector(".sidebar");
    const invoke = (channel, ...args) =>
      page.evaluate(
        ([channel, args]) => window.getanny.invoke(channel, ...args),
        [channel, args],
      );
    await invoke("settings:set", { key: "firstRunCompleted", value: true });
    await invoke("settings:set", {
      key: "confirmBrowserDownloads",
      value: false,
    });
    await invoke("settings:set", {
      key: "defaultDownloadPath",
      value: path.join(work, "browser-downloads"),
    });
    const prepared = await invoke("browser:prepare", browserId);
    browser = await chromium.launchPersistentContext(
      path.join(work, "chromium-profile"),
      {
        ...(browserExecutable
          ? { executablePath: browserExecutable }
          : { channel: "chromium" }),
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
        args: [
          `--disable-extensions-except=${prepared.path}`,
          `--load-extension=${prepared.path}`,
        ],
      },
    );
    const worker =
      browser.serviceWorkers()[0] ||
      (await browser.waitForEvent("serviceworker", { timeout: 30000 }));
    const assertId = new URL(worker.url()).host;
    if (assertId !== CHROMIUM_ID)
      throw new Error(`Unexpected extension ID ${assertId}`);
    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${CHROMIUM_ID}/popup.html`);
    await expect(popup.locator("#status")).toHaveText(
      /Connected · Native host/,
      { timeout: 30000 },
    );
    const status = await invoke("browser:status");
    if (
      !status.websocket.sessions.some(
        (session) =>
          session.browserId === browserId && session.transport === "native",
      )
    )
      throw new Error(`No verified native ${browserId} session`);
    await popup.locator("#url").fill(fixture.url + "/file.bin");
    await popup.locator("#send").click();
    await expect(popup.locator("#message")).toHaveText(
      "Download queued in GetANNY.",
      { timeout: 20000 },
    );
    await waitFor(
      async () =>
        (await invoke("download:get-all")).some(
          (item) =>
            item.url === fixture.url + "/file.bin" &&
            item.status === "completed",
        ),
      20000,
      "browser-origin file download",
    );
    const item = (await invoke("download:get-all")).find(
      (item) => item.url === fixture.url + "/file.bin",
    );
    if (
      checksum(await fs.readFile(item.filePath)) !==
      checksum(fixture.state.data)
    )
      throw new Error("Browser download hash mismatch");
    const site = await browser.newPage();
    await site.goto(media.server.url + "/watch.html");
    await waitFor(
      () =>
        worker.evaluate(() =>
          Array.from(detected.values()).some((items) =>
            items.some(
              (item) =>
                item.url.includes("/fixture.mp4") ||
                item.url.includes("/video.mp4"),
            ),
          ),
        ),
      15000,
      "content-script media detection",
    );
    await popup.locator("#url").fill(media.server.url + "/watch.html");
    await popup.locator("#kind").selectOption("media");
    await popup.locator("#send").click();
    await expect(popup.locator("#message")).toContainText(
      "Media page opened in GetANNY",
    );
    await expect(
      page.getByRole("heading", { name: "Media studio", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("radiogroup")).toBeVisible({ timeout: 30000 });
    await page
      .getByRole("button", { name: "Download video", exact: true })
      .click();
    await waitFor(
      async () =>
        (await invoke("download:get-all")).some(
          (item) =>
            item.kind === "media" &&
            item.url === media.server.url + "/watch.html" &&
            item.status === "completed",
        ),
      30000,
      "browser-origin media download",
    );
    await page.screenshot({
      path: path.join(root, "installed-extension-download.png"),
    });
    await popup.screenshot({ path: path.join(root, "chromium-popup.png") });
    await fs.writeFile(
      path.join(root, "browser-report.json"),
      JSON.stringify(
        {
          passed: true,
          browser:
            browserId === "chromium"
              ? "Playwright Chromium (not Google Chrome)"
              : browserId,
          browserExecutable: browserExecutable || "Playwright bundled Chromium",
          browserVersion: await browser.browser().version(),
          extensionId: CHROMIUM_ID,
          transport:
            "Native Messaging → C# executable → Electron Node → authenticated WebSocket → installed Electron → SQLite/download engine",
          checks: [
            "Extension loads with stable ID",
            "Native handshake shown in popup and desktop",
            "Popup-origin HTTP download hash verified",
            "Content script detects actual HTML5 media",
            "Popup-origin media request analyzes and downloads through desktop UI",
          ],
          scope:
            "One real browser binary with a new isolated test profile. This is not proof of permanent/store installation or other browser brands.",
          date: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    await browser.close();
    browser = null;
    await invoke("app:quit");
    await waitFor(() => app.exitCode !== null, 15000, "app quit");
  } catch (error) {
    await fs.writeFile(
      path.join(root, "browser-report.json"),
      JSON.stringify({ passed: false, error: error.stack, logs }, null, 2),
    );
    throw error;
  } finally {
    await browser?.close().catch(() => {});
    await electron?.close().catch(() => {});
    if (app.exitCode === null)
      await exec("taskkill.exe", ["/pid", String(app.pid), "/T", "/F"]).catch(
        () => {},
      );
    await exec(executable, [
      "--unregister-browser-hosts",
      "--test-user-data",
      userData,
      "--quiet",
    ]).catch(() => {});
    for (const cleanup of cleanups.reverse()) await cleanup();
    await fs.rm(work, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
