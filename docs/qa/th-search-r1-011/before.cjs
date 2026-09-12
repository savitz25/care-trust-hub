const fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
(async () => {
  const b = await chromium.connectOverCDP(process.env.BROWSER_CDP || "http://127.0.0.1:61473"),
    c = await b.newContext({ viewport: { width: 1280, height: 900 } }),
    p = await c.newPage(),
    out = {
      at: new Date().toISOString(),
      baseline: "1d0e33deb30ac0e7ca07c7b9b4056553c0a8681d",
      cases: [],
    };
  try {
    for (const [i, q] of [
      "Who owns this nursing home?",
      "Has this nursing home been fined?",
      "Did this facility change owners?",
      "Who owns AUSTIN WELLNESS & REHABILITATION?",
      "CMS CCN 000000",
      "assisted living in Virginia",
      "assisted living in New York",
      "memory care in Florida",
      "care in Austin Texas",
    ].entries()) {
      let t = performance.now();
      await p.goto("https://www.seniortrusthub.com/ask?" + new URLSearchParams({ q }), {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await p.locator(".senior-ask").waitFor({ timeout: 20000 });
      const body = await p.locator("main").innerText();
      await p.screenshot({
        path: "docs/qa/th-search-r1-011/before-" + i + ".png",
        fullPage: false,
      });
      out.cases.push({
        q,
        ms: Math.round(performance.now() - t),
        text: body.slice(0, 10000),
        links: await p
          .locator("main a")
          .evaluateAll((as) =>
            as.map((a) => ({ label: a.textContent, href: a.getAttribute("href") })),
          ),
      });
    }
  } finally {
    fs.writeFileSync(
      "docs/qa/th-search-r1-011/baseline-browser.json",
      JSON.stringify(out, null, 2),
    );
    console.log(out.cases.map((x) => ({ q: x.q, ms: x.ms, text: x.text.slice(0, 250) })));
    await c.close();
    await b.close();
  }
})().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
