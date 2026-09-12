const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const fs = require("fs"),
  assert = require("assert/strict");
const origin = process.env.R7_ORIGIN || "http://localhost:3107",
  label = process.env.R7_LABEL || "local",
  dir = "docs/qa/th-search-r1-007";
(async () => {
  const b = await chromium.connectOverCDP("http://127.0.0.1:62791"),
    p = await b.contexts()[0].newPage();
  p.setDefaultTimeout(15000);
  const report = { at: new Date().toISOString(), origin, checks: [], failures: [] };
  try {
    for (const width of [1280, 390, 320]) {
      await p.setViewportSize({ width, height: 900 });
      await p.goto(origin + "/ask?" + new URLSearchParams({ q: "Nursing homes in Austin Texas" }));
      await p.locator(".senior-ask__card").first().waitFor();
      assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      const profile = await p
        .getByRole("link", { name: "Research this provider" })
        .first()
        .getAttribute("href");
      const edit = p
        .locator("form")
        .filter({ has: p.getByRole("button", { name: "Update question" }) });
      await edit.locator("input[name=q]").fill("Nursing homes in Zzyzxsynthetic Texas");
      await edit.locator("input[name=q]").press("Enter");
      await p.waitForURL((u) => u.searchParams.get("q")?.includes("Zzyzxsynthetic"));
      await p.locator(".senior-ask").waitFor();
      assert.equal(await p.locator(".senior-ask__card").count(), 0);
      await p.goBack();
      await p.locator(".senior-ask__card").first().waitFor();
      await p.reload();
      await p.locator(".senior-ask__card").first().waitFor();
      const advanced = p
        .locator("details")
        .filter({ has: p.locator("summary").filter({ hasText: "Advanced filters" }) });
      await advanced.locator("summary").click();
      await advanced.locator("select[name=state]").selectOption("FL");
      await p.getByRole("button", { name: "Research", exact: true }).click();
      await p.waitForURL((u) => u.searchParams.get("state") === "FL");
      await p.locator(".senior-ask").waitFor();
      assert.equal(await p.locator(".senior-ask__card").count(), 0);
      await p
        .locator("details")
        .filter({ has: p.locator("summary").filter({ hasText: "Advanced filters" }) })
        .locator("summary")
        .click();
      await p.locator("select[name=state]").first().selectOption("TX");
      await p.getByRole("button", { name: "Research", exact: true }).click();
      await p.waitForURL((u) => u.searchParams.get("state") === "TX");
      await p.locator(".senior-ask__card").first().waitFor();
      const r = await p.goto(origin + profile);
      assert(r.status() < 400);
      assert(await p.locator(".th-logo-lockup").isVisible());
      assert(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      report.checks.push({
        width,
        editMissClearsCards: true,
        backReload: true,
        typedStateConflictAndRestore: true,
        profile,
        status: r.status(),
        overflow: false,
      });
    }
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(origin);
    await p.getByRole("button", { name: "By state" }).click();
    await p.locator(".th-header .th-state-links").evaluate((ul) => {
      for (let i = 0; i < 60; i++) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#fixture-" + i;
        a.className = "th-drawer-link";
        a.textContent = "Synthetic future published state " + i;
        li.append(a);
        ul.append(li);
      }
    });
    const panel = p.locator(".th-header .th-state-panel");
    const dims = await panel.evaluate((e) => ({
      height: e.clientHeight,
      scrollHeight: e.scrollHeight,
      bottom: e.getBoundingClientRect().bottom,
    }));
    assert(dims.scrollHeight > dims.height);
    assert(dims.bottom < 900);
    await p.locator(".th-header .th-state-links a").last().focus();
    assert(
      await p
        .locator(".th-header .th-state-links a")
        .last()
        .evaluate((e) => {
          const p = e.closest(".th-state-panel");
          return e.getBoundingClientRect().bottom <= p.getBoundingClientRect().bottom + 1;
        }),
    );
    report.checks.push({ futureList: 60, panel: dims, lastKeyboardReachable: true });
    const oracle = JSON.parse(fs.readFileSync(dir + "/source-oracle.json"));
    const base = origin + "/api/ask?" + new URLSearchParams({ q: "Nursing homes in Austin Texas" });
    const first = await (await p.request.get(base)).json(),
      second = await (await p.request.get(base + "&page=2")).json();
    const expectedAustin = oracle.rows.find(
      (row) => row.city === "AUSTIN" && row.state_code === "TX",
    ).count;
    assert(first.pagination.hasMore);
    assert(!second.pagination.hasMore);
    assert.equal(
      new Set([...first.results, ...second.results].map((row) => row.ccn)).size,
      expectedAustin,
    );
    report.checks.push({
      pagination: {
        first: first.results.length,
        second: second.results.length,
        distinct: expectedAustin,
        firstHasMore: true,
        secondHasMore: false,
      },
    });
    for (const [providerClass, city, state] of [
      ["nursing_home", "AUSTIN", "TX"],
      ["home_health", "HOUSTON", "TX"],
    ]) {
      const response = await p.request.post(origin + "/api/specialist-execution/v2", {
        data: { providerClass, geography: { type: "city", value: city, state } },
      });
      const result = await response.json();
      assert.equal(response.status(), 200);
      assert.equal(result.status, "ok");
      const expected = oracle.rows.find((row) => row.kind === providerClass && row.city === city);
      assert.equal(result.total, expected.count);
      for (const row of result.rows) {
        assert.equal(row.recordedLocationFields.city.trim().toUpperCase(), city);
        assert.equal(row.recordedLocationFields.state, state);
      }
      report.checks.push({
        structured: {
          providerClass,
          city,
          state,
          total: result.total,
          source: result.provenance.sourceFingerprint,
        },
      });
    }
    for (const row of oracle.rows) {
      const cls = row.kind === "home_health" ? "home health agencies" : "nursing homes";
      const q = `How many ${cls} in ${row.city} ${row.state_code}?`;
      const r = await (
        await p.request.get(origin + "/api/ask?" + new URLSearchParams({ q }))
      ).json();
      assert.equal(r.count.n, row.count);
      assert.equal(r.provenance.sourceFingerprint, row.content_sha256);
      report.checks.push({
        q,
        expected: row.count,
        actual: r.count.n,
        fingerprint: r.provenance.sourceFingerprint,
      });
    }
  } catch (e) {
    report.failures.push(e.stack);
    await p.screenshot({ path: dir + "/" + label + "-supplement-failure.png" });
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(dir + "/" + label + "-supplement.json", JSON.stringify(report, null, 2));
    console.log({ checks: report.checks.length, failures: report.failures });
    await p.close();
    await b.close();
  }
})();
