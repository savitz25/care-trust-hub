// TH-SEARCH-R1-019E frozen diagnostic holdout. Selection is FIXED-POSITION (indices 0, 4, 9, 14
// within each deterministic cohort listing page below), decided BEFORE any matching is evaluated,
// against the real local dev server (real published SeniorTrustHub data, read-only GET requests).
// Never redrawn to improve results.
const BASE = "http://localhost:3555";
const FIXED_POSITIONS = [0, 4, 9, 14];

// Scope+class combinations chosen for class/state diversity, not for expected outcome.
const SCOPES = [
  { providerClass: "nursing_home", geographyType: "state", geographyValue: "FL", page: 1 },
  { providerClass: "nursing_home", geographyType: "state", geographyValue: "TX", page: 3 },
  { providerClass: "home_health", geographyType: "state", geographyValue: "NY", page: 1 },
  { providerClass: "hospice", geographyType: "state", geographyValue: "CA", page: 2 },
  { providerClass: "nursing_home", geographyType: "state", geographyValue: "OH", page: 2 },
];

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bInc\b/g, "Inc");
}
function punctuationNormalized(s) {
  return s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

async function listingRows(scope) {
  const qs = new URLSearchParams(scope).toString();
  const res = await fetch(`${BASE}/api/specialist-execution/v2?${qs}`);
  const body = await res.json();
  return (body.rows ?? []).map((r) => ({
    name: r.name,
    ccn: r.cmsCcn,
    providerClass: r.providerClass,
  }));
}

async function structuredSearch(name) {
  const res = await fetch(
    `${BASE}/api/specialist-execution/name-candidates/v1?name=${encodeURIComponent(name)}`,
  );
  const body = await res.json();
  return { status: res.status, body };
}

async function nativeSearch(name) {
  const res = await fetch(`${BASE}/ask?q=${encodeURIComponent(name)}`);
  const html = await res.text();
  return { status: res.status, foundCcn: html.includes.bind(html) };
}

const sample = [];
for (const scope of SCOPES) {
  const rows = await listingRows(scope);
  for (const pos of FIXED_POSITIONS) {
    const row = rows[pos];
    if (row)
      sample.push({
        scope: `${scope.providerClass}/${scope.geographyValue}/page${scope.page}`,
        position: pos,
        ...row,
      });
  }
}
// Frozen sample recorded BEFORE any matching below is evaluated.
console.log(`Frozen sample: ${sample.length} rows`);

const results = [];
for (const row of sample) {
  const variants = {
    displayed: row.name,
    lowercase: row.name.toLowerCase(),
    punctuationNormalized: punctuationNormalized(row.name),
  };
  const rowResult = { ...row, variants: {} };
  for (const [variantName, text] of Object.entries(variants)) {
    const structured = await structuredSearch(text);
    const candidates = structured.body.candidates ?? [];
    const found = candidates.some((c) => c.ccn === row.ccn);
    const native = await nativeSearch(text);
    const nativeFound = native.foundCcn(row.ccn);
    rowResult.variants[variantName] = {
      query: text,
      resultState: structured.body.resultState,
      httpStatus: structured.status,
      candidateCount: candidates.length,
      targetFound: found,
      irrelevantCandidates: found
        ? candidates.filter((c) => c.ccn !== row.ccn).length
        : candidates.length,
      nativeAlsoFound: nativeFound,
      nativeStructuredAgree: found === nativeFound,
    };
  }
  results.push(rowResult);
}

const denominators = {
  totalRows: results.length,
  totalVariantChecks: results.length * 3,
  targetFoundCount: results.reduce(
    (n, r) => n + Object.values(r.variants).filter((v) => v.targetFound).length,
    0,
  ),
  sourceErrorCount: results.reduce(
    (n, r) =>
      n + Object.values(r.variants).filter((v) => v.resultState === "TECHNICAL_FAILURE").length,
    0,
  ),
  unsupportedCount: results.reduce(
    (n, r) =>
      n + Object.values(r.variants).filter((v) => v.resultState === "UNSUPPORTED_OPERATION").length,
    0,
  ),
  nativeStructuredAgreementCount: results.reduce(
    (n, r) => n + Object.values(r.variants).filter((v) => v.nativeStructuredAgree).length,
    0,
  ),
  classesRepresented: [...new Set(results.map((r) => r.providerClass))],
};

const report = {
  ranAt: new Date().toISOString(),
  method:
    "Fixed positions [0,4,9,14] within 5 deterministic cohort listing pages (nursing_home FL p1, nursing_home TX p3, home_health NY p1, hospice CA p2, nursing_home OH p2), selected before matching was evaluated. Never redrawn.",
  base: BASE,
  sample: results,
  denominators,
  note: "Small sample (20 rows x 3 variants = 60 checks). No statistical claim (p95, recall %, etc.) is made from it.",
};
import { writeFileSync } from "node:fs";
writeFileSync(
  "docs/qa/th-search-r1-019e/holdout-frozen-results.json",
  JSON.stringify(report, null, 1),
);
console.log(JSON.stringify(denominators, null, 1));
