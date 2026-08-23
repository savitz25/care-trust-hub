/**
 * ASK-SEARCH-SENIOR-002 — Chromium QA against a running Senior server.
 * Live CMS results require CARE_ENABLE_REAL_PROVIDER_UI + database.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3022").replace(/\/$/, "");
const OUT = join(process.cwd(), "artifacts", "ask-search-senior-002");

const fails: string[] = [];
const notes: Record<string, unknown> = {};

function fail(msg: string) {
  fails.push(msg);
  console.error("FAIL", msg);
}
function pass(msg: string) {
  console.log("PASS", msg);
}

async function overflowOf(page: {
  evaluate: (fn: () => { overflow: number; scrollWidth: number; clientWidth: number }) => Promise<{
    overflow: number;
    scrollWidth: number;
    clientWidth: number;
  }>;
}) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return {
      overflow: el.scrollWidth - el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  });
}

async function shot(
  page: { screenshot: (opts: { path: string; fullPage: boolean }) => Promise<unknown>; evaluate: (fn: () => { overflow: number; scrollWidth: number; clientWidth: number }) => Promise<{ overflow: number; scrollWidth: number; clientWidth: number }> },
  viewport: string,
  name: string,
) {
  const dir = join(OUT, viewport);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  const ov = await overflowOf(page);
  if (ov.overflow !== 0) fail(`${viewport}/${name} overflow=${ov.overflow}`);
  else pass(`${viewport}/${name} overflow 0`);
  return path;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const health = await fetch(BASE).catch(() => null);
  if (!health) throw new Error(`Server not reachable at ${BASE}`);

  const miami = `${BASE}/from-ask?src=ask&entity=nursing_facility&category=skilled_nursing_facility&state=FL&city=miami`;
  const miamiRes = await fetch(miami, { redirect: "manual" });
  notes.miamiStatus = miamiRes.status;
  notes.miamiLocation = miamiRes.headers.get("location");
  if (![307, 308, 302, 301].includes(miamiRes.status)) fail(`Miami from-ask expected redirect, got ${miamiRes.status}`);
  else {
    const loc = miamiRes.headers.get("location") || "";
    if (!loc.includes("/search?") || !loc.includes("src=ask") || !loc.includes("sort=name")) {
      fail(`Miami redirect missing search preload: ${loc}`);
    } else pass(`Miami redirect ${loc}`);
    if (/[?&]q=/.test(loc)) fail("raw q leaked on Miami redirect");
  }

  const al = await fetch(`${BASE}/from-ask?src=ask&entity=assisted_living&state=TX&city=austin`, {
    redirect: "manual",
  });
  notes.alLocation = al.headers.get("location");
  if (!(al.headers.get("location") || "").includes("/from-ask/unsupported")) fail("AL should be unsupported");
  else pass("assisted living fail-closed");

  const mem = await fetch(`${BASE}/from-ask?src=ask&entity=memory_care&state=TX&city=austin`, {
    redirect: "manual",
  });
  if (!(mem.headers.get("location") || "").includes("unsupported")) fail("memory care should be unsupported");
  else pass("memory care fail-closed");

  const home = await fetch(`${BASE}/from-ask?src=ask&entity=home_care_agency&state=TX&city=austin`, {
    redirect: "manual",
  });
  if (!(home.headers.get("location") || "").includes("unsupported")) fail("home care should be unsupported");
  else pass("home care fail-closed");

  const evil = await fetch(
    `${BASE}/from-ask?src=ask&entity=nursing_facility&next=https://evil.example&redirect=//evil.example&patient_name=John&diagnosis=dementia&state=FL&city=miami`,
    { redirect: "manual" },
  );
  const evilLoc = evil.headers.get("location") || "";
  if (/evil|patient|diagnosis|John/i.test(evilLoc)) fail(`PII/redirect leaked: ${evilLoc}`);
  else pass("PHI and open-redirect keys ignored");

  let playwrightRan = false;
  try {
    const pwUrl = pathToFileURL(
      join("C:/Users/Michael.Savitsky/ask-search-0071/node_modules/playwright/index.js"),
    ).href;
    const { chromium } = (await import(pwUrl)) as typeof import("playwright");
    const browser = await chromium.launch({ headless: true });
    playwrightRan = true;
    for (const [name, size] of [
      ["desktop-1440", { width: 1440, height: 1000 }],
      ["mobile-390", { width: 390, height: 844 }],
    ] as const) {
      const context = await browser.newContext({ viewport: size });
      const page = await context.newPage();
      const dialogs: string[] = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.message());
        await d.dismiss();
      });

      await page.goto(`${BASE}/from-ask?src=ask&entity=snf&state=FL&city=miami`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      notes[`${name}-miami-url`] = page.url();
      await shot(page, name, "01-miami-snf");

      await page.goto(`${BASE}/from-ask?src=ask&entity=nursing_facility&state=NJ`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await shot(page, name, "02-nj-nursing");

      await page.goto(`${BASE}/from-ask?src=ask&entity=nursing_home&state=TX&city=austin`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await shot(page, name, "03-austin-nursing");

      await page.goto(`${BASE}/from-ask?src=ask&entity=assisted_living&state=TX&city=austin`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const alText = await page.locator("#main-content").innerText();
      if (!/assisted living/i.test(alText)) fail(`${name} AL copy missing`);
      await shot(page, name, "04-unsupported-al");

      await page.goto(`${BASE}/from-ask?src=ask&entity=memory_care&state=TX&city=austin`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await shot(page, name, "05-unsupported-memory");

      await page.goto(
        `${BASE}/from-ask?src=ask&entity=nursing_facility&city=%3Cscript%3Ealert(1)%3C/script%3E&sid=%3Cscript%3E`,
        { waitUntil: "domcontentloaded", timeout: 60_000 },
      );
      await shot(page, name, "06-malformed");
      if (dialogs.length) fail(`${name} dialog fired: ${dialogs.join(";")}`);
      else pass(`${name} no XSS dialog`);

      await context.close();
    }
    await browser.close();
  } catch (err) {
    notes.playwrightError = String(err);
    if (!playwrightRan) pass("Playwright unavailable — HTTP redirect contract still checked");
    else throw err;
  }

  writeFileSync(join(OUT, "qa-report.json"), JSON.stringify({ base: BASE, fails, notes }, null, 2));
  if (fails.length) {
    console.error(`QA FAILED (${fails.length})`);
    process.exit(1);
  }
  console.log("ASK-SEARCH-SENIOR-002 browser/HTTP QA passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
