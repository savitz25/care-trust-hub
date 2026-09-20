// TH-SEARCH-R1-019E mutation checks. Each mutation re-introduces a defect the R1-019E fix removes;
// the gate MUST go red. Every file is restored byte-for-byte from memory (never git checkout).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const GATE = ["run", "check:th-search-r1-019e"];
const run = () => {
  const res = spawnSync("npm", GATE, { encoding: "utf8", shell: true });
  const clean = (res.stdout + res.stderr).replace(/\x1b\[[0-9;]*m/g, "");
  // Multiple vitest invocations are chained by `&&` in the npm script; sum every "Tests ... (N)"
  // summary line across all of them rather than assuming exactly one.
  let pass = 0;
  let fail = 0;
  for (const m of clean.matchAll(/Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed/g)) {
    fail += Number(m[1] ?? 0);
    pass += Number(m[2] ?? 0);
  }
  const failing = [...clean.matchAll(/FAIL\s+(\S+\.test\.tsx?)(?:\s*>\s*(.+))?$/gm)]
    .map((m) => [m[1], m[2]].filter(Boolean).join(" > "))
    .filter((v, i, a) => a.indexOf(v) === i);
  return { pass, fail, failing };
};
const sha = (file) => createHash("sha1").update(readFileSync(file)).digest("hex");
const CR = String.fromCharCode(13);

const PARSE = "apps/web/src/server/care/senior-ask-parse.ts";
const CANDIDATES = "apps/web/src/server/care/senior-name-candidates.ts";

const mutations = [
  {
    id: "M1_CATEGORY_FIRST_ROUTING_RESTORED",
    file: PARSE,
    why: "Restores the pre-fix behavior: detectClass()'s class/ambiguous signal always wins, so a structured provider name containing a care word (\"A Holly Patterson Extended Care Facility\", \"FFIII Houston SNF Tenant\") is diverted to a class-clarification/cohort path instead of the identity search, discarding the supplied name.",
    find: "  const providerClass =\n    rawProviderClass &&\n    looksLikeProviderName(q) &&\n    !isBareCategoryPhrase(q, location.geography)\n      ? undefined\n      : rawProviderClass;",
    replace: "  const providerClass = rawProviderClass;",
  },
  {
    id: "M2_STRUCTURED_NAME_STRIPPED_BY_OVERREACHING_PLACE_DETECTION",
    file: PARSE,
    why: 'Makes isBareCategoryPhrase() treat ANY query with a recognized place inside it as bare category regardless of other content, so "FFIII Houston SNF Tenant" (Houston recognized as a city) is misclassified as a category browse and the provider name is lost.',
    find: "  return words(q).every((w) => GENERIC_CARE_WORDS.has(w) || geoWords.has(w));",
    replace: "  return words(q).every((w) => GENERIC_CARE_WORDS.has(w) || geoWords.has(w)) || Boolean(geography);",
  },
  {
    id: "M3_SOURCE_FAILURE_TREATED_AS_MISS",
    file: CANDIDATES,
    why: "A genuine source/database failure (SOURCE_UNAVAILABLE from executeSeniorResearchPlan) is silently reported as a completed miss (COMPLETED_NO_CANDIDATES) instead of TECHNICAL_FAILURE, hiding the outage from the caller.",
    find: '  if (result.query.terminalState === "SOURCE_UNAVAILABLE") {',
    replace: "  if (false) {",
  },
  {
    id: "M4_MERGE_PROVIDER_CLASSES",
    file: CANDIDATES,
    why: 'Every candidate row is mapped to the SAME provider class ("nursing_home") regardless of its own real source-recorded class, merging Nursing Home/Home Health/Hospice into one denominator.',
    find: "    providerClass: entity.providerClass,",
    replace: '    providerClass: "nursing_home",',
  },
  {
    id: "M5_UNFILTERED_COHORT_ON_BARE_CATEGORY",
    file: CANDIDATES,
    why: 'Both UNSUPPORTED_OPERATION guards (before AND after execution -- this operation intentionally checks twice) are bypassed together, so a bare care-category phrase ("senior care Florida") falls through to execution and its class-clarification/cohort result is read back as if it were real name-search candidates.',
    finds: [
      '  if (plan.mode !== "entity" || plan.identityQuery === undefined) {',
      '  if (result.failClosed || result.query.mode !== "entity" || result.query.identityQuery === undefined) {',
    ],
    replaces: ["  if (false) {", "  if (false) {"],
  },
];
// NOTE: no mutation targets labeledCcn()/CCN-precedence -- that logic pre-dates R1-019E and is not
// touched by this ticket ("do not change unrelated Senior evidence/search architecture"). Its
// correctness against the REAL, unmutated code is exercised directly by check:th-search-r1-019e's
// own "7. exact CCN identifier precedence" group instead of a mutation of code this ticket didn't change.

const report = { generatedAt: new Date().toISOString(), cleanBefore: run(), mutations: [], cleanAfter: null };
if (report.cleanBefore.fail !== 0) throw new Error("gate is not clean before mutation: " + JSON.stringify(report.cleanBefore));
for (const m of mutations) {
  const original = readFileSync(m.file);
  const before = sha(m.file);
  let text = original.toString("utf8").split(CR).join("");
  const finds = m.finds ?? [m.find];
  const replaces = m.replaces ?? [m.replace];
  for (const f of finds) if (!text.includes(f)) throw new Error("anchor missing for " + m.id + ": " + f.slice(0, 40));
  let result;
  try {
    for (let i = 0; i < finds.length; i++) text = text.replace(finds[i], replaces[i]);
    writeFileSync(m.file, text);
    result = run();
  } finally {
    writeFileSync(m.file, original);
  }
  report.mutations.push({
    id: m.id,
    why: m.why,
    detected: result.fail > 0,
    failedTests: result.failing,
    restoredByteIdentical: sha(m.file) === before,
  });
}
report.cleanAfter = run();
writeFileSync("docs/qa/th-search-r1-019e/mutation-report.json", JSON.stringify(report, null, 1));
for (const m of report.mutations)
  console.log(
    (m.detected ? "DETECTED " : "MISSED   ") +
      m.id +
      " -> " +
      m.failedTests.length +
      " failing: " +
      m.failedTests.slice(0, 3).join(" | ") +
      " | restored byte-identical: " +
      m.restoredByteIdentical,
  );
console.log(`clean before: pass=${report.cleanBefore.pass} fail=${report.cleanBefore.fail} | clean after restore: pass=${report.cleanAfter.pass} fail=${report.cleanAfter.fail}`);
if (report.mutations.some((m) => !m.detected || !m.restoredByteIdentical) || report.cleanAfter.fail !== 0)
  process.exit(1);
