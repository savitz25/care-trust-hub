/* Explicit, bounded live QA. Not part of CI. Requires an authorized agent-browser CDP session. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const origin = process.env.R7_ORIGIN || "http://localhost:3107";
const label = process.env.R7_LABEL || "local";
const dir = "docs/qa/th-search-r1-007";
const report = {
  at: new Date().toISOString(),
  origin,
  workingHead: cp.execSync("git rev-parse HEAD").toString().trim(),
  label,
  cases: [],
  headers: [],
  errors: [],
  failures: [],
};
(async () => {
  const browser = await chromium.connectOverCDP(process.env.R7_CDP || "http://127.0.0.1:62791");
  const page = await browser.contexts()[0].newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  const url = (q, extra = {}) => origin + "/ask?" + new URLSearchParams({ q, ...extra });
  async function settle() {
    await page.locator(".senior-ask").waitFor();
    await page.locator(".senior-ask__interpretation").waitFor();
  }
  async function check(q, extra = {}, home = false) {
    const started = Date.now();
    if (home) {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      const input = page.getByRole("searchbox", { name: "Question, provider name, or CMS CCN" });
      await input.fill(q);
      await input.press("Enter");
      await page.waitForURL((u) => u.pathname === "/ask");
    } else await page.goto(url(q, extra), { waitUntil: "domcontentloaded" });
    await settle();
    const ms = Date.now() - started;
    const response = await page.request.get(
      origin + "/api/ask?" + new URLSearchParams({ q, ...extra }),
    );
    const api = await response.json();
    const text = await page.locator(".senior-ask").innerText();
    const cards = await page.locator(".senior-ask__card").allTextContents();
    assert(!/NaN\/5|undefined\/5/.test(text));
    assert.equal(cards.length, api.results.length);
    for (const row of api.results)
      assert(
        cards.some((c) => c.includes(row.providerName) && c.includes(row.ccn)),
        `UI/API identity ${row.ccn}`,
      );
    if (
      api.query.geography?.type === "city" &&
      api.query.geography.state &&
      !api.failClosed &&
      !api.query.identifier
    )
      for (const row of api.results) {
        assert.equal(row.recordedLocation.city?.trim().toUpperCase(), api.query.geography.value);
        assert.equal(row.recordedLocation.state, api.query.geography.state);
      }
    if (api.count)
      assert.equal(
        (await page.locator(".senior-ask__count").innerText()).replaceAll(",", ""),
        String(api.count.n),
      );
    assert(ms < 15000, "bounded completion");
    assert((await page.locator("[data-nextjs-dialog]").count()) === 0);
    report.cases.push({
      q,
      extra,
      home,
      width: page.viewportSize().width,
      ms,
      query: api.query,
      terminal: api.terminalState,
      rows: api.results.map((r) => ({ ccn: r.ccn, location: r.recordedLocation })),
      count: api.count,
      source: api.provenance,
    });
    return api;
  }
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const a = await check("Nursing homes in Austin Texas", {}, true);
      assert(a.results.length > 0);
      assert.equal(a.query.geography.state, "TX");
      await page.locator("summary").filter({ hasText: "Trace this query" }).click();
      assert((await page.locator(".senior-ask__trace").innerText()).includes("AUSTIN, TX"));
      await page.screenshot({ path: `${dir}/${label}-austin-${width}.png`, fullPage: false });
      const h = await check("Home health agencies in Houston Texas");
      assert(h.results.length > 0);
      assert((await page.locator(".cms-stars small").count()) > 0);
      await check("Nursing homes in Tampa Florida");
      const clarify = await check("Home health agencies in Houston");
      assert.equal(clarify.terminalState, "NEEDS_CLARIFICATION");
      await page.getByLabel("State for HOUSTON").selectOption("TX");
      await page.getByRole("button", { name: "Search this city and state" }).click();
      await page.waitForURL((u) => u.searchParams.get("state") === "TX");
      await settle();
      assert((await page.locator(".senior-ask__card").count()) > 0);
      await page.reload({ waitUntil: "domcontentloaded" });
      await settle();
      assert((await page.locator(".senior-ask__card").count()) > 0);
      await check("Nursing homes in Austin Texas", { state: "FL" });
      assert.equal(await page.locator(".senior-ask__card").count(), 0);
      await check("Nursing homes within 10 miles of Austin Texas");
      assert.equal(await page.locator(".senior-ask__card").count(), 0);
      await check("Nursing homes in Zzyzxsynthetic Texas");
      assert.equal(await page.locator(".senior-ask__card").count(), 0);
      assert(
        (await page.locator(".senior-ask").innerText()).includes(
          "No matching published provider record",
        ),
      );
      await check("Nursing homes in Austin Texas");
      await page
        .getByRole("link", { name: "Search recorded locations across Texas instead" })
        .click();
      await page.waitForURL((u) => u.searchParams.get("broaden") === "state");
      await settle();
      assert(
        (await page.locator(".senior-ask").innerText()).includes("You selected a search across"),
      );
      await page.goBack({ waitUntil: "domcontentloaded" });
      await settle();
      assert((await page.locator(".senior-ask__interpretation").innerText()).includes("AUSTIN"));
      await page.goForward({ waitUntil: "domcontentloaded" });
      await settle();
      assert(new URL(page.url()).searchParams.get("broaden") === "state");
    }
    for (const q of [
      "How many nursing homes in Austin Texas?",
      "How many home health agencies in Houston Texas?",
      "How many nursing homes in Tampa Florida?",
      "Find CMS CCN 455799",
      "Find CMS CCN ZZZZZZ",
      "Compare nursing homes in Broward and Palm Beach",
    ])
      await check(q);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.fonts.ready);
      const boxes = await page
        .locator(".th-header")
        .evaluate((e) =>
          [
            ...e.querySelectorAll(
              ".th-logo-lockup,.th-nav-link,.th-header-actions > *, .th-header-mobile-actions > *",
            ),
          ]
            .map((x) => ({ label: x.textContent, rect: x.getBoundingClientRect().toJSON() }))
            .filter((x) => x.rect.width && x.rect.height),
        );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].rect,
            b = boxes[j].rect;
          assert(
            !(a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y),
            `overlap ${width} ${boxes[i].label}/${boxes[j].label}`,
          );
        }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert(!overflow, `overflow ${width}`);
      if (width < 1200) {
        const trigger = page.getByRole("button", { name: "Open menu" });
        await trigger.focus();
        await trigger.press("Enter");
        const dialog = page.getByRole("dialog", { name: "SeniorTrustHub menu" });
        await dialog.waitFor();
        assert(await dialog.evaluate((d) => d.contains(document.activeElement)));
        await page.keyboard.press("Shift+Tab");
        assert(await dialog.evaluate((d) => d.contains(document.activeElement)));
        const states = dialog.getByRole("button", { name: "By state" });
        await states.press("Space");
        assert.equal(
          await dialog
            .getByRole("navigation", { name: "Published state research" })
            .getByRole("link")
            .count(),
          9,
        );
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        assert(await trigger.evaluate((e) => e === document.activeElement));
      } else {
        const states = page.getByRole("button", { name: "By state" });
        await states.focus();
        await states.press("Enter");
        const panel = page.getByRole("navigation", { name: "Published state research" });
        assert.equal(await panel.getByRole("link").count(), 9);
        const r = await panel.boundingBox();
        assert(r.y + r.height <= 900);
        await page.keyboard.press("Escape");
        assert(await states.evaluate((e) => e === document.activeElement));
        const hub = page.getByRole("button", { name: "Switch Hub" });
        await hub.press("Space");
        assert((await hub.getAttribute("aria-expanded")) === "true");
        await page.keyboard.press("Escape");
      }
      report.headers.push({ width, boxes, overflow, keyboard: true });
      await page.screenshot({ path: `${dir}/${label}-header-${width}.png` });
    }
    // Chromium CSS zoom is not browser zoom; this check records viewport reflow equivalent separately.
    await page.setViewportSize({ width: 640, height: 450 });
    report.zoom = {
      method:
        "1280x900 at 200% equivalent CSS viewport (640x450); browser chrome zoom still requires explicit check",
      compact: await page.getByRole("button", { name: "Open menu" }).isVisible(),
    };
    for (const path of [
      "/ask",
      "/new-york",
      "/home-health",
      "/hospice",
      "/compare",
      "/shortlist",
    ]) {
      const r = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
      assert(r.status() < 400, `${path} ${r.status()}`);
      assert(await page.locator(".th-logo-lockup").isVisible());
    }
  } catch (e) {
    report.failures.push(e.message);
    await page.screenshot({ path: `${dir}/${label}-failure.png` });
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(`${dir}/${label}-browser.json`, JSON.stringify(report, null, 2));
    console.log({
      cases: report.cases.length,
      headers: report.headers.length,
      errors: report.errors,
      failures: report.failures,
    });
    await page.close();
    await browser.close();
  }
})();
