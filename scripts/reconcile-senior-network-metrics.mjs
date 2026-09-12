import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildSeniorHomepageEvidenceInventory,
  SENIOR_HOMEPAGE_STATE_CARDS,
} from "../packages/domain/src/senior-home-evidence-inventory.ts";
import { buildSeniorHomeIntel } from "../packages/domain/src/senior-home-intel.ts";

const tickets = {
  NJ: "005",
  CA: "001",
  TX: "001",
  WA: "001",
  AZ: "001",
  CO: "001",
  VA: "001",
  NY: "001",
  IL: "001",
};
export function requireCount(value, field, nullable = false) {
  if (value === null && nullable) return null;
  assert.ok(
    Number.isSafeInteger(value) && value >= 0,
    `Missing or invalid accepted count: ${field}`,
  );
  return value;
}
export function reconcileSenior(base, read = (path) => readFileSync(path, "utf8")) {
  const acceptedSources = [];
  const source = (path) => {
    const bytes = read(path).replace(/\r\n/g, "\n");
    acceptedSources.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
    return JSON.parse(bytes);
  };
  const censusPath = "artifacts/senior-metric-census-r2-03.json";
  const census = source(censusPath);
  const national = source("apps/web/src/data/senior-national-intelligence.json");
  const florida = source("apps/web/src/data/florida-intelligence.json");
  const publication = source("apps/web/src/data/florida-provider-publication.json");
  const snapshots = Object.fromEntries(
    Object.entries(tickets).map(([state, ticket]) => [
      state,
      source(`artifacts/${state.toLowerCase()}-sen-${ticket}-public-snapshot.json`),
    ]),
  );
  const stateMetrics = [];
  function add(
    state,
    field,
    grain,
    providerClass,
    clockField = field.split(".")[0],
    status = "STATE_SOURCE_LIVE",
    nullable = false,
  ) {
    const s = snapshots[state];
    const v = field.split(".").reduce((o, k) => o?.[k], s);
    const clock = clockField.split(".").reduce((o, k) => o?.[k], s);
    stateMetrics.push({
      key: `${state.toLowerCase()}.${field}`,
      state,
      value: requireCount(v, `${state}.${field}`, nullable),
      grain,
      providerClass,
      sourceArtifact: `artifacts/${state.toLowerCase()}-sen-${tickets[state]}-public-snapshot.json`,
      sourceField: field,
      sourceAsOf: clock?.sourceAsOf ?? clock?.sourceModifiedAt ?? null,
      snapshotAsOf: s.snapshotAsOf ?? null,
      retrievedAt: clock?.retrievedAt ?? s.retrievedAt ?? null,
      generatedAt: s.generatedAt ?? null,
      capabilityStatus: status,
      aggregation: "SEPARATE_CLASS_OR_EVIDENCE_POPULATION_DO_NOT_ADD_TO_NATIONAL",
    });
  }
  for (const state of ["CO", "VA", "NY", "IL"]) {
    const geo = base.geography.states.find((r) => r.state === state);
    assert.ok(geo, `Missing federal state partition ${state}`);
    for (const [field, setting] of [
      ["nursingHomes", "nursing_home"],
      ["homeHealth", "home_health"],
      ["hospice", "hospice"],
    ]) {
      add(
        state,
        `cmsOverlay.${field}`,
        "CMS current-directory CCN",
        setting,
        `cmsOverlay.clocks.${field}`,
        "FEDERAL_BASELINE",
      );
      assert.equal(
        snapshots[state].cmsOverlay[field],
        geo[field],
        `${state} ${field} accepted federal partition drift`,
      );
    }
  }
  add(
    "CO",
    "assistedLiving.count",
    "CDPHE current state license universe",
    "Assisted Living Residence",
    "assistedLiving",
    "SEARCH_ONLY",
    true,
  );
  add(
    "CO",
    "homeCare.hcaCount",
    "CDPHE current state agency universe",
    "Home Care Agency",
    "homeCare",
    "SEARCH_ONLY",
    true,
  );
  add("VA", "dssAlf.licensedFacilityCount", "DSS licensed facility ID", "Assisted Living");
  add("VA", "dssAdc.licensedFacilityCount", "DSS licensed facility ID", "Adult Day");
  add("VA", "dssAlfInspections.observationCount", "DSS inspection observation", "Assisted Living");
  add(
    "VA",
    "dssAlfInspections.complaintRelatedObservations",
    "Complaint-related inspection observation; not complaint universe",
    "Assisted Living",
  );
  add(
    "VA",
    "dssAlfInspections.violationFlagYes",
    "Violation-flagged inspection observation",
    "Assisted Living",
  );
  for (const [field, grain] of [
    ["distinctFacilityIds", "NY profile facility ID"],
    ["rowsWithCcn", "NY profile rows carrying CCN"],
    ["distinctCcn", "Distinct exact CCN in NY profiles"],
    ["surveyRows", "NY survey observation"],
    ["citationRows", "NY citation observation"],
    ["citationRowsIsComplaint1", "Complaint-related citation observation; not complaint universe"],
    ["enforcementRows", "NY enforcement/fine observation"],
  ])
    add("NY", `nursingHomeProfile.${field}`, grain, "Nursing Home");
  add("NY", "acf.adultHomeFacilities", "NY facility ID", "Adult Home");
  add("NY", "acf.enrichedHousingFacilities", "NY facility ID", "Enriched Housing");
  add(
    "NY",
    "acf.acfFacilities",
    "Subtotal of disjoint Adult Home and Enriched Housing facility IDs",
    "Adult Care",
  );
  assert.equal(
    snapshots.NY.acf.acfFacilities,
    snapshots.NY.acf.adultHomeFacilities + snapshots.NY.acf.enrichedHousingFacilities,
  );
  assert.equal(
    snapshots.NY.acf.ahEhpOverlapFacilityIds,
    0,
    "NY residential subtotal requires disjoint class IDs",
  );
  add(
    "NY",
    "doNotRefer.observationCount",
    "Do Not Refer observation; exact identity only",
    "Adult Care",
  );
  for (const [field, setting] of [
    ["lhcsaDistinctFacilityIds", "LHCSA"],
    ["chhaDistinctFacilityIds", "CHHA"],
    ["lthhcpDistinctFacilityIds", "LTHHCP"],
  ])
    add("NY", `homeCare.${field}`, "NY class-specific facility ID", setting);
  for (const [field, setting] of [
    ["idphHomeHealth", "Home Health Agency (state license)"],
    ["idphHomeNursing", "Home Nursing"],
    ["idphHomeServices", "Home Services"],
    ["idphHospice", "Hospice"],
    ["idphHospiceResidence", "Hospice Residence"],
  ])
    add("IL", `${field}.rows`, "IDPH state license/program row", setting);
  add(
    "IL",
    "supportiveLiving.operationalSites",
    "HFS operational site",
    "Supportive Living Program",
  );
  add(
    "IL",
    "supportiveLiving.units",
    "HFS residential unit; not site or provider",
    "Supportive Living Program",
  );
  add(
    "IL",
    "stateNursingHomes.currentRosterCount",
    "IDPH current state license universe",
    "Nursing Home",
    "stateNursingHomes",
    "SEARCH_ONLY",
    true,
  );
  add(
    "IL",
    "assistedLiving.currentRosterCount",
    "IDPH current state license universe",
    "Assisted Living",
    "assistedLiving",
    "SEARCH_ONLY",
    true,
  );
  const evidenceInventory = buildSeniorHomepageEvidenceInventory({
    networkMetrics: base,
    floridaIdentities: florida.providers.current,
    floridaRegulatoryObservations: florida.regulatory.observations,
    floridaSourceAsOf: florida.asOf.slice(0, 10),
  });
  const bindings = {
    "co-cms-nh": "co.cmsOverlay.nursingHomes",
    "co-cms-hha": "co.cmsOverlay.homeHealth",
    "co-cms-hospice": "co.cmsOverlay.hospice",
    "va-dss-alf": "va.dssAlf.licensedFacilityCount",
    "va-dss-adc": "va.dssAdc.licensedFacilityCount",
    "va-dss-alf-inspections": "va.dssAlfInspections.observationCount",
    "ny-acf": "ny.acf.acfFacilities",
    "il-cms-nh": "il.cmsOverlay.nursingHomes",
    "il-idph-hha": "il.idphHomeHealth.rows",
    "il-slp": "il.supportiveLiving.operationalSites",
  };
  for (const row of evidenceInventory) {
    requireCount(row.value, row.key);
    const metric = stateMetrics.find((m) => m.key === bindings[row.key]);
    if (metric)
      Object.assign(row, {
        value: metric.value,
        sourceAsOf: metric.sourceAsOf?.slice(0, 10) ?? null,
        sourceArtifact: metric.sourceArtifact,
        acceptedArtifact: metric.sourceArtifact,
        snapshotAsOf: metric.snapshotAsOf,
        retrievedAt: metric.retrievedAt,
        generatedAt: base.generatedAt,
        generatedOrRetrievedAt: metric.retrievedAt,
      });
  }
  const stateCards = structuredClone(SENIOR_HOMEPAGE_STATE_CARDS);
  for (const card of stateCards) {
    const snapshot = snapshots[card.state];
    card.sourceAsOf =
      card.state === "FL" ? florida.asOf.slice(0, 10) : (snapshot?.sourceAsOf ?? null);
    card.snapshotAsOf = snapshot?.snapshotAsOf ?? null;
    card.retrievedAt = snapshot?.retrievedAt ?? null;
  }
  const intel = buildSeniorHomeIntel({
    national,
    floridaIdentities: florida.providers.current,
    floridaRegulatoryObservations: florida.regulatory.observations,
    publishedAlfAfch: publication.n,
  });
  base.contractRevision = "ATH-METRICS-R2-03";
  base.homepage = { intel, evidenceInventory, stateCards };
  base.reconciliation = {
    acceptedSources,
    stateMetrics,
    stateCapabilities: base.geography.states.map(({ state }) => ({
      state,
      route: stateCards.find((c) => c.state === state)?.href ?? null,
      routeExists: stateCards.some((c) => c.state === state),
      stateSourceAcquired: stateCards.some((c) => c.state === state && state !== "CO"),
      specialistComplete: null,
      metricKeys: stateMetrics.filter((m) => m.state === state).map((m) => m.key),
    })),
    census: { path: censusPath, retrievedAt: census.retrievedAt, sourceAsOf: null },
    noCombinedProviderDenominator: true,
  };
  return base;
}
