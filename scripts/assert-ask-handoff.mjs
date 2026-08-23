/**
 * ASK-SEARCH-SENIOR-002 — source contract for Ask receiving.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const failures = [];
const assert = (cond, msg) => {
  if (!cond) failures.push(msg);
};

const fromAsk = read("apps/web/src/app/from-ask/page.tsx");
const unsupported = read("apps/web/src/app/from-ask/unsupported/page.tsx");
const domain = read("packages/domain/src/ask-handoff.ts");
const search = read("apps/web/src/app/search/real-search.tsx");
const repo = read("apps/web/src/server/care/repository.ts");
const facility = read("apps/web/src/app/facility/cms/[ccn]/[slug]/page.tsx");
const robots = read("apps/web/src/app/robots.ts");
const sitemap = read("apps/web/src/app/sitemap.xml/route.ts");
const banner = read("apps/web/src/components/ask-handoff-banner.tsx");

assert(fromAsk.includes("parseSeniorAskSearchContext"), "from-ask parses Ask context");
assert(fromAsk.includes("robots: { index: false, follow: false }"), "from-ask noindex");
assert(fromAsk.includes("redirect(dest.href)"), "from-ask redirects into existing search");
assert(unsupported.includes("assisted living"), "unsupported AL copy");
assert(unsupported.includes("Memory care"), "unsupported memory-care copy");
assert(unsupported.includes("Home care"), "unsupported home-care copy");
assert(domain.includes("nursing_facility"), "nursing entity");
assert(domain.includes("assisted_living"), "AL fail-closed");
assert(domain.includes("ASK_HANDOFF_SORT = 'name'"), "name sort");
// CRLF-safe: Windows worktrees may store \r\n
assert(
  /askHandoffUsesCommercialRanking\(\):\s*boolean\s*\{\s*return false;?\s*\}/.test(domain),
  "no commercial ranking"
);
assert(!domain.includes("cms-overall-desc"), "domain never uses Five-Star sort");
assert(search.includes("criteriaFromAskContext"), "search reuses Ask criteria");
assert(search.includes("askHandoffBanner") || search.includes("AskHandoffBanner"), "Ask preload banner");
assert(search.includes('sort=name') || search.includes('value="name"'), "Ask sort name");
assert(repo.includes("cityExact"), "exact physical city");
assert(repo.includes("askHandoff"), "Ask ranking lock in repository");
assert(repo.includes("county_name"), "live county column available");
assert(facility.includes("AskBackToResults"), "Back to Results on CMS profile");
assert(facility.includes("canonicalUrl(href)"), "canonical stays clean facility URL");
assert(robots.includes("/from-ask"), "robots disallows /from-ask");
assert(!sitemap.includes("from-ask"), "sitemap omits from-ask");
assert(banner.includes('FORBIDDEN'), "analytics uses an allow/deny list");
assert(banner.includes("ask_handoff_received"), "Ask receive event");
assert(!banner.includes("patient_name"), "analytics banner has no patient name");
assert(!fromAsk.includes("fetch(") || fromAsk.includes("redirect"), "no Ask runtime fetch on receiver");

for (const key of ["query", "q", "email", "phone", "diagnosis", "next", "redirect"]) {
  assert(domain.includes(`'${key}'`), `forbidden key listed: ${key}`);
}

if (failures.length) {
  console.error(`ASK-SEARCH-SENIOR-002 source contract FAILED (${failures.length})`);
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("ASK-SEARCH-SENIOR-002 source contract passed.");
