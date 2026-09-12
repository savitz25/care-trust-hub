const fs = require("fs"),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const base = process.argv[2] || "http://localhost:3211",
  tag = process.argv[3] || "local",
  sha = process.argv[4] || "02aa6f46d044e3532e32564805cb91f3ec99442c",
  dir = "docs/qa/th-search-r1-011";
function ck(x, m) {
  if (!x) throw Error(m);
}
(async () => {
  const b = await chromium.connectOverCDP(process.env.BROWSER_CDP || "http://127.0.0.1:61473"),
    out = { at: new Date().toISOString(), base, sha, checks: [], failures: [] };
  for (const width of [320, 1280]) {
    const c = await b.newContext({ viewport: { width, height: 900 } }),
      p = await c.newPage();
    try {
      await p.goto(base + "/ask?q=" + encodeURIComponent("Has this nursing home been fined?"), {
        waitUntil: "domcontentloaded",
      });
      await p.locator("#facility-ccn").fill("455799");
      await p.locator("#facility-ccn").press("Enter");
      await p.locator('[aria-label="Facility evidence answer"]').waitFor();
      ck((await p.locator(".senior-ask__card").innerText()).includes("455799"), "CCN entry");
      await p.locator('[aria-label="Facility evidence answer"]').scrollIntoViewIfNeeded();
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: dir + "/" + tag + "-answer-" + width + ".png" });
      ck(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "answer overflow",
      );
      out.checks.push({
        width,
        flow: "CCN entry retains penalty question",
        url: p.url(),
        answer: await p.locator('[aria-label="Facility evidence answer"] h2').innerText(),
      });
      await p.goto(base + "/facility/cms/455799/austin-wellness-and-rehabilitation", {
        waitUntil: "domcontentloaded",
      });
      const link = p.getByRole("link", { name: "Who owns CMS CCN 455799?", exact: true });
      await link.waitFor();
      const href = await link.getAttribute("href");
      await link.click();
      await p.locator('[aria-label="Facility evidence answer"]').waitFor();
      ck((await p.locator(".senior-ask__card").count()) === 1, "profile identity count");
      ck((await p.locator(".senior-ask__card").innerText()).includes("455799"), "profile identity");
      out.checks.push({ width, flow: "server canonical profile continuation", href });
      await p.goto(base + "/ask?q=CMS%20CCN%20000000", { waitUntil: "domcontentloaded" });
      await p
        .getByRole("heading", { name: "No matching published provider record", exact: true })
        .scrollIntoViewIfNeeded();
      await p.screenshot({ path: dir + "/" + tag + "-miss-" + width + ".png" });
      const official = p.getByRole("link", { name: "Open official CMS Care Compare" });
      ck(
        (await official.getAttribute("href")) === "https://www.medicare.gov/care-compare/",
        "official destination",
      );
      await official.focus();
      ck(await official.evaluate((a) => a === document.activeElement), "keyboard focus");
      out.checks.push({ width, flow: "miss official action focus and exact destination" });
    } catch (e) {
      out.failures.push({ width, error: String(e) });
    } finally {
      await c.close();
    }
  }
  fs.writeFileSync(dir + "/" + tag + "-supplement.json", JSON.stringify(out, null, 2));
  console.log(out);
  await b.close();
  if (out.failures.length) process.exitCode = 1;
})().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
