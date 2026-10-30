const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const { fixtureServer, checksum, waitFor } = require("../tests/helpers");
const { mediaFixture } = require("../tests/media-fixture");
const { launchOptions } = require("./browser-launch");
const base = process.env.GETANNY_PREVIEW_URL || "http://127.0.0.1:5173";
(async () => {
  const cleanup = [];
  const t = {
    after: (fn) => cleanup.push(fn),
    skip: (reason) => {
      throw new Error(reason);
    },
  };
  const fixture = await fixtureServer(t, { size: 8 * 1024 * 1024, delay: 40 });
  const media = await mediaFixture(t);
  const output = path.resolve(".arena/ui-test");
  await fs.mkdir(output, { recursive: true });
  await fs.rm(path.join(output, "report.json"), { force: true });
  const browser = await chromium.launch(await launchOptions());
  const page = await browser.newPage({
    viewport: { width: 1320, height: 860 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const invoke = async (channel, ...args) => {
    const response = await page.request.post(base + "/__getanny/invoke", {
      headers: { "X-GetANNY-Preview": "1" },
      data: { channel, args },
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.value;
  };
  const nav = (name) =>
    page
      .locator(".sidebar")
      .getByRole("button", { name: new RegExp(`^${name}`) });
  try {
    await invoke("settings:set", { key: "firstRunCompleted", value: false });
    await invoke("settings:set", { key: "autoStartDownloads", value: true });
    await invoke("settings:set", { key: "maxConcurrentDownloads", value: 3 });
    await invoke("settings:set", { key: "theme", value: "graphite" });
    await page.goto(base);
    await expect(
      page.getByRole("heading", { name: "Browser integration", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(output, "onboarding-1320.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "I’ll set this up later" }).click();
    await nav("All downloads").click();
    async function add(url, filename) {
      await page
        .getByRole("button", { name: "New download", exact: true })
        .click();
      await page.getByLabel("Download link", { exact: true }).fill(url);
      await page.getByLabel("File name", { exact: true }).fill(filename);
      await page
        .getByRole("button", { name: "Start download", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    const filename = `HTTP range verification ${Date.now()}.bin`;
    await add(fixture.url + "/file.bin", filename);
    const row = page.getByRole("listitem").filter({
      has: page.getByRole("button", { name: filename, exact: true }),
    });
    await expect(row).toBeVisible();
    await expect(row.getByText("Downloading", { exact: true })).toBeVisible();
    await row
      .getByRole("button", { name: `Pause ${filename}`, exact: true })
      .click();
    await nav("Paused").click();
    await expect(row.getByText("Paused", { exact: true })).toBeVisible();
    await row
      .getByRole("button", { name: `Resume ${filename}`, exact: true })
      .click();
    await nav("All downloads").click();
    await expect(row.getByText("Completed", { exact: true })).toBeVisible({
      timeout: 20000,
    });
    const items = await invoke("download:get-all"),
      item = items.find((item) => item.filename === filename);
    if (
      checksum(await fs.readFile(item.filePath)) !==
      checksum(fixture.state.data)
    )
      throw new Error("UI download bytes differ");
    const failed = `HTTP failure verification ${Date.now()}.bin`;
    await add(fixture.url + "/missing", failed);
    await nav("Failed").click();
    await expect(
      page.getByRole("listitem").filter({
        has: page.getByRole("button", { name: failed, exact: true }),
      }),
    ).toContainText("HTTP 404");
    const emptyName = `Verified empty file ${Date.now()}.bin`;
    await add(fixture.url + "/empty", emptyName);
    await nav("All downloads").click();
    const emptyRow = page.getByRole("listitem").filter({
      has: page.getByRole("button", { name: emptyName, exact: true }),
    });
    await expect(emptyRow.getByText("Completed", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(emptyRow.locator(".transfer-numbers")).toContainText(
      "0 B / 0 B",
    );
    await expect(emptyRow.locator('[role="progressbar"]')).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    const emptyItem = (await invoke("download:get-all")).find(
      (item) => item.filename === emptyName,
    );
    if ((await fs.stat(emptyItem.filePath)).size !== 0)
      throw new Error("Empty-file completion did not produce zero bytes");
    await nav("Media studio").click();
    await page
      .getByLabel("VIDEO OR AUDIO PAGE")
      .fill(media.server.url + "/watch.html");
    await page
      .getByRole("button", { name: "Analyze link", exact: true })
      .click();
    await expect(page.getByRole("radiogroup")).toBeVisible({ timeout: 25000 });
    await page
      .getByRole("button", { name: "Dismiss notification" })
      .evaluateAll((elements) =>
        elements.forEach((element) => element.click()),
      );
    await page.screenshot({
      path: path.join(output, "media-1320.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Download video", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "All downloads", exact: true }),
    ).toBeVisible();
    await waitFor(
      async () =>
        (await invoke("download:get-all")).some(
          (item) =>
            item.kind === "media" &&
            item.url === media.server.url + "/watch.html" &&
            item.status === "completed",
        ),
      25000,
      "real media job completion",
    );
    await nav("Settings").click();
    await page
      .getByLabel("Maximum simultaneous downloads", { exact: true })
      .fill("2");
    await page
      .getByLabel("Maximum simultaneous downloads", { exact: true })
      .press("Enter");
    await expect(
      page.getByText("Changes saved", { exact: true }),
    ).toBeVisible();
    if ((await invoke("settings:get-all")).maxConcurrentDownloads !== 2)
      throw new Error("Setting did not persist");
    await page
      .getByRole("button", { name: "Application", exact: true })
      .click();
    await page
      .getByLabel("Color theme", { exact: true })
      .selectOption("midnight");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      "midnight",
    );
    await page.screenshot({
      path: path.join(output, "settings-1320.png"),
      fullPage: true,
    });
    // Verify actual CSS tokens, not a screenshot-based accessibility claim.
    // Small muted labels must remain readable even on selected/raised surfaces.
    for (const [theme, colorScheme] of [
      ["midnight", "dark"],
      ["system", "light"],
      ["graphite", "dark"],
    ]) {
      await page.emulateMedia({ colorScheme });
      await page.getByLabel("Color theme", { exact: true }).selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const failures = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = (token) => {
          let hex = style.getPropertyValue(token).trim().replace("#", "");
          if (hex.length === 3)
            hex = [...hex].map((char) => char + char).join("");
          const rgb = [0, 2, 4]
            .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
            .map((value) =>
              value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4,
            );
          return rgb.reduce(
            (sum, value, index) =>
              sum + value * [0.2126, 0.7152, 0.0722][index],
            0,
          );
        };
        const failures = [];
        for (const text of ["--muted", "--secondary", "--text"])
          for (const surface of [
            "--bg",
            "--sidebar",
            "--panel",
            "--raised",
            "--input",
            "--accent-soft",
          ]) {
            const a = luminance(text),
              b = luminance(surface),
              ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            if (!Number.isFinite(ratio) || ratio < 4.5)
              failures.push({ text, surface, ratio });
          }
        return failures;
      });
      if (failures.length)
        throw new Error(
          `${theme} text-token contrast: ${JSON.stringify(failures)}`,
        );
      if (theme === "system")
        await page.screenshot({
          path: path.join(output, "settings-system-light-1320.png"),
          fullPage: true,
        });
    }
    await nav("All downloads").click();
    const activeName = `Live transfer verification ${Date.now()}.bin`;
    await add(fixture.url + "/file.bin", activeName);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(output, "downloads-1320.png"),
      fullPage: true,
    });
    for (const width of [1024, 760, 480]) {
      await page.setViewportSize({ width, height: 800 });
      for (const name of [
        "All downloads",
        "Media studio",
        "Browser integration",
        "Settings",
      ]) {
        await nav(name).click();
        await page.waitForTimeout(60);
        const overflow = await page
          .locator(".main-content")
          .evaluate((element) => ({
            width: element.clientWidth,
            scroll: element.scrollWidth,
          }));
        if (overflow.scroll > overflow.width + 1)
          throw new Error(
            `${name} overflows at ${width}: ${JSON.stringify(overflow)}`,
          );
        await page.screenshot({
          path: path.join(
            output,
            `${name.replaceAll(" ", "-").toLowerCase()}-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
    await page.setViewportSize({ width: 1320, height: 860 });
    await nav("All downloads").click();
    // Keyboard dialog trap, Escape, and no accidental submission by Browse/Cancel.
    await page
      .getByRole("button", { name: "New download", exact: true })
      .click();
    await page
      .getByLabel("Download link", { exact: true })
      .fill(fixture.url + "/file.bin");
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .focus();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Start download", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Close dialog", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "New download", exact: true }),
    ).toBeFocused();
    if (errors.length) throw new Error(errors.join("\n"));
    const report = {
      passed: true,
      date: new Date().toISOString(),
      checks: [
        "Browser onboarding renders with honest unknown states",
        "New-download IPC/SSE list updates",
        "HTTP UI pause/resume and hash verification",
        "HTTP 404 failure view",
        "Actual empty-file completion shows verified zero bytes, not unknown size",
        "Real yt-dlp format analysis and video download",
        "Validated settings affect backend and theme",
        "Graphite/Midnight/system-light text tokens meet 4.5:1 on normal, raised and selected surfaces",
        "Responsive pages at 1320,1024,760,480 pixels",
        "Keyboard Escape and focusable dialogs",
        "No uncaught renderer errors",
      ],
      screenshots: (await fs.readdir(output)).filter((file) =>
        file.endsWith(".png"),
      ),
    };
    await fs.writeFile(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    for (const fn of cleanup.reverse()) await fn();
  }
})().catch(async (error) => {
  await fs
    .writeFile(
      path.resolve(".arena/ui-test/report.json"),
      JSON.stringify(
        { passed: false, error: error.stack, date: new Date().toISOString() },
        null,
        2,
      ),
    )
    .catch(() => {});
  console.error(error);
  process.exitCode = 1;
});
