const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const fs = require("fs");
const assert = require("assert/strict");
(async () => {
  const origin = process.env.R7_ORIGIN || "https://www.seniortrusthub.com";
  const label = process.env.R7_LABEL || "production";
  const b = await chromium.connectOverCDP("http://127.0.0.1:55960");
  const context = b.contexts()[0];
  const p = await context.newPage();
  try {
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(origin);
    const worker = context.serviceWorkers().find((w) => w.url().startsWith("chrome-extension://"));
    assert(worker, "Owned zoom extension must be available");
    const zoom = await worker.evaluate(async (origin) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.filter((t) => t.url?.startsWith(origin)).at(-1);
      await chrome.tabs.setZoom(tab.id, 2);
      return { factor: await chrome.tabs.getZoom(tab.id), url: tab.url };
    }, origin);
    assert.equal(zoom.factor, 2);
    await p.waitForFunction(() => innerWidth < 800);
    const dimensions = await p.evaluate(() => ({
      innerWidth,
      innerHeight,
      devicePixelRatio,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(dimensions.overflow, false);
    const trigger = p.getByRole("button", { name: "Open menu" });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = p.getByRole("dialog", { name: "SeniorTrustHub menu" });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "By state" }).press("Space");
    assert.equal(
      await dialog
        .getByRole("navigation", { name: "Published state research" })
        .getByRole("link")
        .count(),
      9,
    );
    await p.screenshot({ path: `docs/qa/th-search-r1-007/${label}-actual-200-percent.png` });
    await p.keyboard.press("Escape");
    await p.keyboard.press("Escape");
    assert(await trigger.evaluate((e) => e === document.activeElement));
    const report = {
      at: new Date().toISOString(),
      deployedSha: process.env.R7_DEPLOYED_SHA || null,
      method:
        "chrome.tabs.setZoom/getZoom in an isolated owned profile; no global/user settings changed",
      zoom,
      dimensions,
      keyboard: true,
    };
    fs.writeFileSync(
      `docs/qa/th-search-r1-007/${label}-actual-zoom.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await p.close();
    await b.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
