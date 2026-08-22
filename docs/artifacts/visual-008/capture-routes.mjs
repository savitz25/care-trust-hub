import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "routes");
mkdirSync(out, { recursive: true });
const origin = process.env.STH_ORIGIN || "http://127.0.0.1:3018";
const routes = [
  { id: "home", path: "/" },
  { id: "search", path: "/search" },
  { id: "compare", path: "/compare" },
  { id: "facility", path: "/facility/harbor-pines" },
  { id: "navigator", path: "/tools/care-needs-navigator" },
  { id: "planner", path: "/tools/senior-care-cost-planner" },
  { id: "assisted", path: "/assisted-living" },
  { id: "methodology", path: "/methodology" },
];

const browser = await chromium.launch({ headless: true });
const report = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const route of routes) {
    const res = await page.goto(origin + route.path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(400);
    const status = res?.status() || 0;
    const headerH = await page.evaluate(() => {
      const el = document.querySelector("header");
      return el ? Math.round(el.getBoundingClientRect().height) : null;
    });
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await page.screenshot({ path: join(out, `${route.id}.jpg`), type: "jpeg", quality: 60 });
    report.push({ ...route, status, headerH, overflowX });
  }
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync(join(out, "qa.json"), JSON.stringify({ origin, report }, null, 2));
console.log(JSON.stringify({ origin, report }, null, 2));
const bad = report.filter((r) => r.status >= 400 || r.overflowX || (r.headerH && r.headerH > 70));
if (bad.length) {
  console.error("ROUTE QA ISSUES", bad);
  process.exit(1);
}
