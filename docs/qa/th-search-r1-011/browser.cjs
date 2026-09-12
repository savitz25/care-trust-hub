const fs = require("fs"),
  { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const base = process.argv[2] || "http://localhost:3211",
  tag = process.argv[3] || "local",
  sha = process.argv[4] || "uncommitted candidate",
  dir = "docs/qa/th-search-r1-011";
const oracle = JSON.parse(fs.readFileSync(dir + "/source-oracle.json", "utf8"));
const cases = [
  ["Who owns this nursing home?", "clarify"],
  ["Has this nursing home been fined?", "clarify"],
  ["Did this facility change owners?", "clarify"],
  ["Who owns AUSTIN WELLNESS & REHABILITATION?", "ownership"],
  ["Who owns Sunrise?", "candidates"],
  ["CMS CCN 455799", "positive"],
  ["CMS CCN 000000", "miss"],
  ["assisted living in Virginia", "/virginia"],
  ["assisted living in New York", "/new-york"],
  ["memory care in Florida", "/florida"],
  ["nursing homes in Austin Texas", "Austin"],
  ["home health agencies in Houston Texas", "Houston"],
  ["Has CMS CCN 455799 been fined?", "penalty"],
  ["Did CMS CCN 455799 change owners?", "chow"],
];
function check(ok, msg) {
  if (!ok) throw Error(msg);
}
(async () => {
  const b = await chromium.connectOverCDP(process.env.BROWSER_CDP || "http://127.0.0.1:61473"),
    out = {
      at: new Date().toISOString(),
      base,
      sha,
      cases: [],
      flows: [],
      failures: [],
      errors: [],
    };
  let c;
  try {
    for (const width of [390, 1280]) {
      c = await b.newContext({ viewport: { width, height: 900 } });
      const p = await c.newPage();
      p.on("pageerror", (e) => out.errors.push(String(e)));
      for (const [i, [q, expected]] of cases.entries()) {
        try {
          let t = Date.now();
          if (i === 0) {
            await p.goto(base, { waitUntil: "domcontentloaded" });
            const input = p.locator("input[name=q]").first();
            await input.fill(q);
            await input.press("Enter");
            await p.waitForURL("**/ask?**");
          } else
            await p.goto(base + "/ask?" + new URLSearchParams({ q }), {
              waitUntil: "domcontentloaded",
              timeout: 25000,
            });
          await p.locator(".senior-ask").waitFor({ timeout: 15000 });
          const ms = Date.now() - t,
            text = await p.locator(".senior-ask").innerText(),
            cards = await p.locator(".senior-ask__card").allTextContents(),
            api = await (
              await c.request.get(base + "/api/ask?" + new URLSearchParams({ q }))
            ).json();
          check(ms < 25000, "completion budget");
          check(!/NaN\/5|undefined\/5/.test(text), "invalid rating");
          check(
            await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            "overflow",
          );
          check(api.results.length === cards.length, "browser/API row parity");
          for (const e of api.results)
            check(
              cards.some((x) => x.includes(e.ccn) && x.includes(e.providerName)),
              "identity parity",
            );
          if (expected === "clarify") {
            check(
              text.includes("Which facility do you mean?") && cards.length === 0,
              "identity guard",
            );
            check(api.terminalState === "NEEDS_CLARIFICATION", "API clarification");
          } else if (expected === "miss") {
            check(
              text.includes("000000") &&
                text.includes("No matching published provider record") &&
                cards.length === 0,
              "CCN miss",
            );
            check(
              (await p.locator('a[href="https://www.medicare.gov/care-compare/"]').count()) === 1,
              "official action",
            );
          } else if (expected === "positive") {
            check(api.results[0]?.ccn === "455799" && cards.length === 1, "positive CCN");
          } else if (expected === "candidates") {
            check(
              api.candidateSelection &&
                cards.length > 1 &&
                cards.length <= 10 &&
                !api.facilityAnswer,
              "ambiguity",
            );
          } else if (expected.startsWith("/")) {
            const link = p.locator('.senior-ask a[href="' + expected + '"]').first();
            check((await link.count()) === 1, "recovery link");
            await link.click();
            await p.waitForURL(base + expected);
            await p.locator("main h1").waitFor();
            out.flows.push({
              width,
              q,
              recovery: expected,
              title: await p.locator("main h1").innerText(),
            });
            await p.goBack({ waitUntil: "domcontentloaded" });
          } else if (["Austin", "Houston"].includes(expected)) {
            check(cards.length > 0, "location positive");
            check(
              api.results.every(
                (e) =>
                  e.recordedLocation?.city?.toUpperCase() === expected.toUpperCase() &&
                  e.recordedLocation?.state === "TX",
              ),
              "compound scope",
            );
          } else {
            check(api.facilityAnswer?.status === "AVAILABLE", "source evidence enabled");
            check(api.results.length === 1 && api.results[0].ccn === "455799", "evidence identity");
            check(
              expected === "ownership"
                ? api.facilityAnswer.rows[0]?.label === "CMS ownership category"
                : api.facilityAnswer.task === expected,
              "evidence task",
            );
            if (expected === "penalty")
              check(
                api.facilityAnswer.rows.length ===
                  oracle.sources.find((s) => s.key === "nursing-home-penalties")
                    .observationsFor455799,
                "independent pinned source penalty count",
              );
            if (expected === "ownership")
              check(
                api.facilityAnswer.rows.length ===
                  1 +
                    oracle.sources
                      .filter((s) =>
                        ["nursing-home-ownership", "skilled-nursing-facility-enrollments"].includes(
                          s.key,
                        ),
                      )
                      .reduce((sum, s) => sum + s.observationsFor455799, 0),
                "independent category plus 10 relationship observations",
              );
          }
          const trace = p.locator(".senior-ask__trace summary");
          await trace.click();
          check(
            (await p.locator(".senior-ask__trace").getAttribute("open")) !== null,
            "Trace opens",
          );
          if ([0, 3, 4, 6, 10].includes(i))
            await p.screenshot({
              path: dir + "/" + tag + "-" + width + "-" + i + ".png",
              fullPage: false,
            });
          out.cases.push({
            q,
            width,
            ms,
            terminal: api.terminalState,
            ids: api.results.map((e) => ({
              ccn: e.ccn,
              name: e.providerName,
              class: e.providerClass,
              location: e.recordedLocation,
            })),
            query: api.query,
            evidence: api.facilityAnswer
              ? {
                  task: api.facilityAnswer.task,
                  status: api.facilityAnswer.status,
                  rows: api.facilityAnswer.rows.length,
                  sources: api.facilityAnswer.sources,
                  summary: api.facilityAnswer.summary,
                }
              : null,
            text: text.slice(0, 500),
          });
        } catch (e) {
          out.failures.push({ q, width, error: String(e) });
        }
      }
      // Real provider-entry and candidate selection; original evidence question stays in URL.
      try {
        await p.goto(base + "/ask?q=" + encodeURIComponent("Who owns this nursing home?"), {
          waitUntil: "domcontentloaded",
        });
        await p.locator("#facility-name").fill("Sunrise");
        await p.locator("#facility-name").press("Enter");
        await p.getByRole("heading", { name: "Choose the provider", exact: true }).waitFor();
        const selected = p
            .getByRole("link", { name: "Select this provider for the original evidence question" })
            .first(),
          href = await selected.getAttribute("href");
        await selected.click();
        await p.locator('[aria-label="Facility evidence answer"]').waitFor();
        check(
          new URL(p.url()).searchParams.get("q") === "Who owns this nursing home?",
          "original task lost",
        );
        check((await p.locator(".senior-ask__card").count()) === 1, "selection final provider");
        await p.reload({ waitUntil: "domcontentloaded" });
        check((await p.locator(".senior-ask__card").count()) === 1, "refresh selection");
        await p.goBack({ waitUntil: "domcontentloaded" });
        await p.getByRole("heading", { name: "Choose the provider", exact: true }).waitFor();
        check((await p.locator(".senior-ask__card").count()) > 1, "back candidates");
        await p.goForward({ waitUntil: "domcontentloaded" });
        await p.locator('[aria-label="Facility evidence answer"]').waitFor();
        await p.locator("#ask-q-edit").fill("CMS CCN 000000");
        await p.locator("#ask-q-edit").press("Enter");
        await p
          .getByRole("heading", { name: "No matching published provider record", exact: true })
          .waitFor();
        check((await p.locator(".senior-ask__card").count()) === 0, "stale evidence");
        out.flows.push({
          width,
          flow: "name entry, selection, refresh, back/forward, edit to miss",
          href,
          passed: true,
        });
      } catch (e) {
        out.failures.push({ width, flow: "selection", error: String(e) });
      }
      try {
        await p.goto(base + "/ask?q=" + encodeURIComponent("care in Austin Texas"), {
          waitUntil: "domcontentloaded",
        });
        await p.getByRole("link", { name: "Nursing homes", exact: true }).last().click();
        await p.locator(".senior-ask__card").first().waitFor();
        check(
          (await p.locator(".senior-ask__card").allTextContents()).every(
            (t) => /AUSTIN|Austin/.test(t) && t.includes("TX"),
          ),
          "class choice locality",
        );
        out.flows.push({ width, flow: "care class choice Austin TX", passed: true });
      } catch (e) {
        out.failures.push({ width, flow: "class choice", error: String(e) });
      }
      await c.close();
      c = null;
    }
    for (const width of [320, 768]) {
      c = await b.newContext({ viewport: { width, height: 900 } });
      const p = await c.newPage();
      for (const q of [cases[0][0], cases[3][0], cases[6][0]]) {
        await p.goto(base + "/ask?" + new URLSearchParams({ q }), {
          waitUntil: "domcontentloaded",
        });
        await p.locator(".senior-ask").waitFor();
        const overflow = await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        if (overflow) out.failures.push({ width, q, error: "overflow" });
        await p.screenshot({
          path: dir + "/" + tag + "-" + width + "-" + cases.findIndex((x) => x[0] === q) + ".png",
        });
        out.flows.push({ width, q, overflow });
      }
      await c.close();
      c = null;
    }
  } finally {
    fs.writeFileSync(dir + "/" + tag + "-browser.json", JSON.stringify(out, null, 2));
    console.log({
      cases: out.cases.length,
      flows: out.flows.length,
      failures: out.failures,
      errors: out.errors,
    });
    if (c) await c.close();
    await b.close();
  }
  if (out.failures.length || out.errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
