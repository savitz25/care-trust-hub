const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const fs = require("fs");
(async () => {
  const b = await chromium.connectOverCDP(process.env.BROWSER_CDP || "http://127.0.0.1:61473"),
    c = await b.newContext(),
    p = await c.newPage();
  const r = {
    checkedAt: new Date().toISOString(),
    agency: "Centers for Medicare & Medicaid Services",
    jurisdiction: "US",
    purpose: "Official Care Compare provider search",
    url: "https://www.medicare.gov/care-compare/",
    deepLinkParameters: false,
    limitation: "A destination check is not a live provider or license verification.",
  };
  try {
    const resp = await p.goto(r.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    r.status = resp.status();
    r.finalUrl = p.url();
    r.title = await p.title();
    r.text = (await p.locator("body").innerText()).slice(0, 1800);
    await p.screenshot({ path: "docs/qa/th-search-r1-011/official-cms.png" });
  } catch (e) {
    r.error = String(e);
  } finally {
    fs.writeFileSync(
      "docs/qa/th-search-r1-011/official-link-check.json",
      JSON.stringify(r, null, 2),
    );
    console.log(r);
    await c.close();
    await b.close();
  }
})();
