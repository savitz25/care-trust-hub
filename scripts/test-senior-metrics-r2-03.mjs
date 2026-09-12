import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { requireCount, reconcileSenior } from "./reconcile-senior-network-metrics.mjs";
const read = (path) => readFileSync(path, "utf8");
const m = JSON.parse(read("apps/web/src/data/senior-network-metrics-v1.json"));
const rows = Object.fromEntries(m.reconciliation.stateMetrics.map((r) => [r.key, r]));
test("all accepted four-state populations export with separate care/evidence grains", () => {
  for (const [key, value] of Object.entries({
    "co.cmsOverlay.nursingHomes": 210,
    "co.cmsOverlay.homeHealth": 222,
    "co.cmsOverlay.hospice": 88,
    "va.dssAlf.licensedFacilityCount": 573,
    "va.dssAdc.licensedFacilityCount": 82,
    "va.dssAlfInspections.observationCount": 7032,
    "va.dssAlfInspections.complaintRelatedObservations": 2488,
    "va.dssAlfInspections.violationFlagYes": 4066,
    "ny.nursingHomeProfile.distinctFacilityIds": 597,
    "ny.nursingHomeProfile.rowsWithCcn": 595,
    "ny.nursingHomeProfile.distinctCcn": 594,
    "ny.nursingHomeProfile.surveyRows": 6036,
    "ny.nursingHomeProfile.citationRows": 19032,
    "ny.nursingHomeProfile.citationRowsIsComplaint1": 4244,
    "ny.nursingHomeProfile.enforcementRows": 2036,
    "ny.acf.adultHomeFacilities": 381,
    "ny.acf.enrichedHousingFacilities": 146,
    "ny.acf.acfFacilities": 527,
    "ny.doNotRefer.observationCount": 117,
    "ny.homeCare.lhcsaDistinctFacilityIds": 1258,
    "ny.homeCare.chhaDistinctFacilityIds": 97,
    "ny.homeCare.lthhcpDistinctFacilityIds": 30,
    "ny.cmsOverlay.homeHealth": 100,
    "ny.cmsOverlay.hospice": 39,
    "il.cmsOverlay.nursingHomes": 666,
    "il.cmsOverlay.homeHealth": 530,
    "il.cmsOverlay.hospice": 149,
    "il.idphHomeHealth.rows": 595,
    "il.idphHomeNursing.rows": 258,
    "il.idphHomeServices.rows": 1029,
    "il.idphHospice.rows": 178,
    "il.idphHospiceResidence.rows": 10,
    "il.supportiveLiving.operationalSites": 169,
    "il.supportiveLiving.units": 13939,
  }))
    assert.equal(rows[key]?.value, value, key);
  assert.equal(m.providerUniverses.nursingHome.current, 14690);
  assert.equal(m.providerUniverses.homeHealth.current, 12460);
  assert.equal(m.providerUniverses.hospice.current, 6669);
  assert.equal(m.combinedProviderDenominator.publishAsHeadline, false);
  assert.match(
    rows["va.dssAlfInspections.complaintRelatedObservations"].grain,
    /not complaint universe/,
  );
  assert.match(rows["il.supportiveLiving.units"].grain, /not site or provider/);
});
test("state evidence and units cannot inflate federal providers", () => {
  const result = reconcileSenior(structuredClone(m), (path) => {
    if (!path.endsWith("il-sen-001-public-snapshot.json")) return read(path);
    const d = JSON.parse(read(path));
    d.supportiveLiving.units += 10000;
    d.idphHomeHealth.rows += 100;
    return JSON.stringify(d);
  });
  assert.deepEqual(result.providerUniverses, m.providerUniverses);
  assert.equal(
    result.reconciliation.stateMetrics.find((r) => r.key === "il.supportiveLiving.units").value,
    23939,
  );
  assert.equal(result.homepage.evidenceInventory.find((r) => r.key === "il-idph-hha").value, 695);
});
test("unknown is explicit null, required missing source fields fail, and valid zero survives", () => {
  assert.equal(requireCount(0, "valid"), 0);
  assert.equal(requireCount(null, "search", true), null);
  assert.throws(() => requireCount(undefined, "missing", true), /Missing/);
  assert.throws(() => requireCount(null, "required"), /Missing/);
  for (const key of [
    "co.assistedLiving.count",
    "co.homeCare.hcaCount",
    "il.stateNursingHomes.currentRosterCount",
    "il.assistedLiving.currentRosterCount",
  ]) {
    assert.equal(rows[key].value, null);
    assert.equal(rows[key].capabilityStatus, "SEARCH_ONLY");
  }
  assert.equal(
    m.reconciliation.stateCapabilities.find((r) => r.state === "CO").stateSourceAcquired,
    false,
  );
  assert.throws(
    () =>
      reconcileSenior(structuredClone(m), (path) => {
        if (!path.endsWith("va-sen-001-public-snapshot.json")) return read(path);
        const d = JSON.parse(read(path));
        delete d.dssAlfInspections.observationCount;
        return JSON.stringify(d);
      }),
    /Missing or invalid accepted count/,
  );
});
test("NY identities and federal/state universes reconcile without a fake sum", () => {
  assert.equal(rows["ny.cmsOverlay.nursingHomes"].value, 593);
  assert.equal(rows["ny.nursingHomeProfile.distinctFacilityIds"].value, 597);
  assert.equal(rows["ny.nursingHomeProfile.rowsWithCcn"].value, 595);
  assert.equal(rows["ny.nursingHomeProfile.distinctCcn"].value, 594);
  assert.equal(
    rows["ny.acf.acfFacilities"].value,
    rows["ny.acf.adultHomeFacilities"].value + rows["ny.acf.enrichedHousingFacilities"].value,
  );
  assert.throws(
    () =>
      reconcileSenior(structuredClone(m), (path) => {
        if (!path.endsWith("ny-sen-001-public-snapshot.json")) return read(path);
        const d = JSON.parse(read(path));
        d.acf.ahEhpOverlapFacilityIds = 1;
        return JSON.stringify(d);
      }),
    /requires disjoint/,
  );
});
test("source, snapshot, retrieval and generation clocks remain distinct", () => {
  assert.equal(rows["va.dssAlf.licensedFacilityCount"].sourceAsOf, null);
  assert.equal(rows["va.dssAlf.licensedFacilityCount"].snapshotAsOf, "2026-09-10");
  assert.equal(rows["il.idphHomeHealth.rows"].sourceAsOf, "2026-04-28");
  assert.equal(rows["il.idphHomeHealth.rows"].retrievedAt, "2026-09-12T15:47:12Z");
  assert.match(rows["co.cmsOverlay.homeHealth"].sourceAsOf, /2026-05-27/);
  const home = m.homepage.evidenceInventory.find((r) => r.key === "co-cms-hha");
  assert.equal(home.sourceAsOf, "2026-05-27");
  assert.match(home.retrievedAt, /2026-08-26/);
});
test("homepage server projections read generated metrics; changing JSX totals are gone", () => {
  for (const path of [
    "apps/web/src/server/care/senior-home-intel.ts",
    "apps/web/src/server/care/senior-home-evidence-inventory.ts",
  ]) {
    assert.match(read(path), /getSeniorNetworkMetrics/);
    assert.doesNotMatch(read(path), /florida-intelligence.json|_LOCKED|buildSeniorHome/);
  }
  const component = read("apps/web/src/components/senior-home-intelligence.tsx");
  assert.doesNotMatch(component, /<strong>(140|172|232|6,179|557)<\/strong>/);
  assert.equal(
    m.homepage.evidenceInventory.find((r) => r.key === "il-slp").value,
    rows["il.supportiveLiving.operationalSites"].value,
  );
  assert.equal(
    m.homepage.evidenceInventory.find((r) => r.key === "state-pages").value,
    m.homepage.stateCards.length,
  );
});

test("homepage state clocks preserve agency dates without substituting acquisition dates", () => {
  const cards = Object.fromEntries(m.homepage.stateCards.map((r) => [r.state, r]));
  const source = (state, label) => cards[state].sourceClocks.find((r) => r.label === label);
  assert.equal(source("NJ", "NJ long-term care").sourceAsOf, "2026-08-31");
  assert.equal(source("CA", "CDPH ELMS").sourceAsOf, "2026-08-17");
  assert.equal(source("CA", "CDSS RCFE").sourceAsOf, "2025-05-25");
  assert.equal(source("AZ", "ADHS GIS extract").sourceAsOf, "2025-02-03");
  assert.equal(source("VA", "DSS assisted living").sourceAsOf, null);
  assert.equal(source("VA", "DSS assisted living").snapshotAsOf, "2026-09-10");
  assert.equal(source("NY", "NY nursing-home profiles").sourceAsOf, "2026-08-19");
  assert.equal(source("IL", "IDPH Home Health").sourceAsOf, "2026-04-28");
  assert.equal(source("IL", "HFS Supportive Living").sourceAsOf, "2026-02-06");
  assert.equal(cards.IL.sourceAsOf, null);
  const inventory = Object.fromEntries(m.homepage.evidenceInventory.map((r) => [r.key, r]));
  assert.equal(inventory["ca-elms"].sourceAsOf, "2026-08-17");
  assert.equal(inventory["wa-afh"].sourceAsOf, null);
  assert.equal(inventory["wa-afh"].snapshotAsOf, "2026-09-04");
});
