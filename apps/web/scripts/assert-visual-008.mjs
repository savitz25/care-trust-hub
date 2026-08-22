/**
 * VISUAL-008 Senior network shell — source contract.
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

const tokens = read("src/lib/design/trusthub-visual-standard.ts");
const mark = read("src/components/senior-network-mark.tsx");
const svg = read("public/brand/senior-trust-hub-mark.svg");
const compact = read("public/brand/senior-trust-hub-logo-compact.svg");
const css = read("src/app/globals.css");
const header = read("src/components/site-header.tsx");
const logo = read("src/components/brand-logo.tsx");
const switcher = read("src/components/switch-hub-menu.tsx");
const registry = read("src/lib/network/registry.ts");
const layout = read("src/app/layout.tsx");
const icon = read("src/app/icon.svg");
const share = read("src/og/senior-share-card.tsx");
const hub = read("src/config/share-hub.ts");
const home = read("src/app/page.tsx");

assert(tokens.includes("2026.08.21-visual-v1"), "chassis version");
assert(tokens.includes('senior: "#681860"'), "Senior plum accent");
assert(mark.includes('viewBox="0 0 36 36"'), "mark viewBox 0 0 36 36");
assert(mark.includes('strokeWidth="2.4"'), "canonical stroke 2.4");
assert(mark.includes('r="2.5"'), "canonical outer dots");
assert(mark.includes('r="2.1"'), "canonical center");
assert(mark.includes("#681860"), "plum brackets");
assert(svg.includes('stroke-width="2.4"'), "public mark stroke 2.4");
assert(!svg.includes('stroke-width="8"'), "public mark not 8px heavy");
assert(compact.includes('stroke-width="2.4"'), "compact canonical stroke");
assert(!compact.includes("Research senior care"), "compact omits slogan");
assert(css.includes("--th-header-desktop: 69px"), "69px desktop header");
assert(css.includes("--th-header-tablet: 65px"), "65px tablet");
assert(css.includes("--th-header-mobile: 57px"), "57px mobile");
assert(css.includes("--th-logo-desktop: 36px"), "36px logo");
assert(css.includes("--th-control: 44px"), "44px controls");
assert(css.includes("--th-shell-max: 1200px"), "1200 shell");
assert(!/^\s*\.th-header[\s\S]{0,500}backdrop-filter/m.test(css), "no backdrop-filter on th-header");
assert(!header.includes("AskNetworkBar"), "no AskNetworkBar");
assert(header.includes("th-header"), "reference header class");
assert(header.includes('variant="embedded"'), "Switch Hub in drawer");
assert(logo.includes("SeniorNetworkMark"), "tight SVG mark");
assert(logo.includes("SENIOR"), "SENIOR wordmark");
assert(logo.includes("TRUST HUB"), "TRUST HUB wordmark");
assert(switcher.includes("switcherEntries()"), "registry order");
assert(switcher.includes("ASK TRUST HUB NETWORK"), "network panel title");
assert(switcher.includes("aria-current"), "aria-current");
assert(registry.includes('CURRENT_NETWORK_HUB_ID: NetworkHubId = "senior"'), "current hub is senior");
assert(layout.includes("data-th-chassis"), "chassis stamp");
assert(layout.includes('id="main-content"'), "skip target");
assert(layout.includes("Inter"), "Inter chrome font");
assert(css.includes("var(--font-serif)"), "Georgia/serif editorial exception");
assert(home.includes("home-title") || home.includes("h1"), "homepage H1 preserved");
assert(hub.includes("https://www.seniortrusthub.com"), "canonical host");
assert(icon.includes('stroke-width="2.4"'), "favicon SVG canonical");
assert(share.includes('viewBox="0 0 36 36"'), "SHARE-003 canonical mark");
assert(share.includes('strokeWidth="2.4"'), "SHARE-003 canonical stroke");

const order = [
  'id: "ask"',
  'id: "move"',
  'id: "lender"',
  'id: "insurance"',
  'id: "contractor"',
  'id: "senior"',
  'id: "investor"',
];
let last = -1;
for (const id of order) {
  const i = registry.indexOf(id);
  assert(i > last, `registry order ${id}`);
  last = i;
}

if (failures.length) {
  console.error("VISUAL-008 assertions failed:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("VISUAL-008 Senior network-shell assertions passed.");
