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
  OR: "001",
  PA: "001",
  NC: "001",
  OH: "001",
  GA: "001",
  MA: "001",
  TN: "001",
  NV: "001",
  MN: "001",
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
  for (const state of [
    "CO",
    "VA",
    "NY",
    "IL",
    "OR",
    "PA",
    "NC",
    "OH",
    "GA",
    "MA",
    "TN",
    "NV",
    "MN",
  ]) {
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
  add(
    "OR",
    "odhsProviders.OPEN_NF",
    "ODHS Provider ID Status=Open Type=NF",
    "Nursing Facility (state license)",
  );
  add(
    "OR",
    "odhsProviders.OPEN_ALF",
    "ODHS Provider ID Status=Open Type=ALF",
    "Assisted Living Facility",
  );
  add(
    "OR",
    "odhsProviders.OPEN_RCF",
    "ODHS Provider ID Status=Open Type=RCF",
    "Residential Care Facility",
  );
  add("OR", "odhsProviders.OPEN_AFH", "ODHS Provider ID Status=Open Type=AFH", "Adult Foster Home");
  add("OR", "odhsInspections.INSPECTION_ROWS", "ODHS inspection Event ID", "ODHS LTC");
  add(
    "OR",
    "odhsViolations.VIOLATION_ROWS",
    "ODHS substantiated violation report number",
    "ODHS LTC",
  );
  add(
    "OR",
    "odhsRegulatoryActions.REGULATORY_ACTION_ROWS",
    "ODHS public license-condition row; not all regulatory actions",
    "ODHS LTC",
  );
  add(
    "OR",
    "odhsRegulatoryActions.UNIQUE_REGULATORY_MATTERS",
    "ODHS Sanction identifier",
    "ODHS LTC",
  );
  add(
    "OR",
    "ohaHomeHealth.rows",
    "OHA Home Health license number",
    "Home Health Agency (state license)",
  );
  add("OR", "ohaHospice.rows", "OHA Hospice license number", "Hospice (state license)");
  add(
    "PA",
    "nursingHomes.PA_NURSING_HOME_ROWS",
    "PA-DOH-NCF facility ID",
    "Nursing home (state license)",
  );
  add(
    "PA",
    "homeHealth.PA_HOME_HEALTH_ROWS",
    "PA-DOH-DHH Home Health facility ID",
    "Home Health Agency (state license)",
  );
  add(
    "PA",
    "homeCare.PA_HOME_CARE_ROWS",
    "PA-DOH-DHH Home Care facility ID",
    "Home Care Agency (state license)",
  );
  add("PA", "hospice.PA_HOSPICE_ROWS", "PA-DOH-DHH Hospice facility ID", "Hospice (state license)");
  add(
    "NC",
    "adultCareHomes.NC_ADULT_CARE_HOME_ROWS",
    "NC-DHSR-ACH HAL license",
    "Adult Care Home (state license)",
  );
  add(
    "NC",
    "familyCareHomes.NC_FAMILY_CARE_HOME_ROWS",
    "NC-DHSR-FCH FCL license",
    "Family Care Home (state license)",
  );
  add(
    "NC",
    "nursingHomes.NC_NURSING_HOME_ROWS",
    "NC-DHSR-NH license",
    "Nursing home (state license)",
  );
  add(
    "NC",
    "homeHealth.NC_HOME_HEALTH_ROWS",
    "NC-DHSR-HH license in Home Health listing",
    "Home Health Agency (state license)",
  );
  add("NC", "hospice.NC_HOSPICE_ROWS", "NC-DHSR-HOS license", "Hospice (state license)");
  add(
    "OH",
    "nursingHomes.OH_NURSING_FACILITY_ROWS",
    "ODH OneSource f_licenseno OH#####",
    "Nursing home (state license)",
  );
  add(
    "OH",
    "rcf.OH_RCF_ROWS",
    "ODH OneSource f_licenseno OHL##### L1 RESIDENTIAL CARE",
    "Residential Care Facility (state license)",
  );
  for (const [field, grain, providerClass] of [
    [
      "personalCareHomes.rows",
      "HFRD Personal Care Home license",
      "Personal Care Home (state license)",
    ],
    [
      "assistedLivingCommunities.rows",
      "HFRD Assisted Living Community license",
      "Assisted Living Community (state license)",
    ],
    [
      "communityLivingArrangements.rows",
      "HFRD Community Living Arrangement",
      "Community Living Arrangement (state license)",
    ],
    ["adultDay.rows", "HFRD Adult Day Center", "Adult Day Center (state license)"],
    [
      "privateHomeCare.rows",
      "HFRD Private Home Care Provider license",
      "Private Home Care Provider (state license)",
    ],
    ["stateNursingHomeLicenses.rows", "HFRD nursing-home license", "Nursing home (state license)"],
    [
      "stateHomeHealthLicenses.rows",
      "HFRD Home Health license",
      "Home Health Agency (state license)",
    ],
    ["stateHospiceLicenses.rows", "HFRD Hospice license", "Hospice (state license)"],
    ["inspections.indexedReports", "HFRD inspection report index", "Inspection report"],
    ["enforcement.rows", "HFRD enforcement order", "Enforcement order"],
  ]) {
    add("GA", field, grain, providerClass, field.split(".")[0], "NOT_ACQUIRED", true);
  }
  add(
    "GA",
    "crosswalk.exactStateToCmsBridges",
    "exact state license to CMS CCN",
    "Identity bridge",
    "crosswalk",
    "UNKNOWN",
    true,
  );
  add(
    "GA",
    "complaints.providerLevelRows",
    "provider-level complaint record",
    "Complaint",
    "complaints",
    "REQUEST_ONLY",
    true,
  );
  add(
    "MA",
    "nursingHomes.rows",
    "DPH facility ID, type Nursing Home",
    "Nursing home (state license)",
  );
  add("MA", "restHomes.rows", "DPH facility ID, type Rest Home", "Rest Home (state license)");
  add(
    "MA",
    "homeHealth.rows",
    "DPH facility ID, type Certified Home Health Agency",
    "Home Health Agency (state license)",
  );
  add("MA", "hospice.rows", "DPH facility ID, type Hospice", "Hospice (state license)");
  add(
    "MA",
    "adultDayHealth.rows",
    "DPH facility ID, type Adult Day Health",
    "Adult Day Health (state license)",
  );
  add(
    "MA",
    "assistedLiving.rows",
    "Residence row on the AGE certified ALR list",
    "Assisted Living Residence (state certification)",
  );
  add(
    "MA",
    "surveyTool.indexedFacilityResults",
    "DPH Survey Performance Tool facility result",
    "Survey performance",
    "surveyTool",
    "NOT_ACQUIRED",
    true,
  );
  add(
    "MA",
    "complaints.providerLevelRows",
    "provider-level complaint record",
    "Complaint",
    "complaints",
    "REQUEST_ONLY",
    true,
  );
  add(
    "TN",
    "nursingHomes.distinctLicenseNumbers",
    "License number on the HFC Nursing Home Full Bed Report",
    "Nursing home (state license)",
  );
  add(
    "TN",
    "nursingHomes.licensedBeds",
    "Licensed beds on the HFC Nursing Home Full Bed Report (capacity, not residents)",
    "Nursing home beds",
    "nursingHomes",
  );
  add(
    "TN",
    "aclf.distinctLicenseNumbers",
    "License number on the HFC ACLF Full Bed Report",
    "Assisted Care Living Facility (state license)",
  );
  add(
    "TN",
    "aclf.licensedBeds",
    "Licensed beds on the HFC ACLF Full Bed Report (capacity, not residents)",
    "Assisted Care Living Facility beds",
    "aclf",
  );
  add(
    "TN",
    "rha.distinctLicenseNumbers",
    "License number on the HFC Home for the Aged Full Bed Report",
    "Residential Home for the Aged (state license)",
  );
  add(
    "TN",
    "rha.licensedBeds",
    "Licensed beds on the HFC Home for the Aged Full Bed Report (capacity, not residents)",
    "Residential Home for the Aged beds",
    "rha",
  );
  add(
    "TN",
    "homeHealth.distinctAgenciesAsPrinted",
    "Agency name and home county as printed on the HFC county list (no license number)",
    "Home Health Agency (state license)",
    "homeHealth",
    "PARTIAL",
  );
  add(
    "TN",
    "homeHealth.countyServiceRows",
    "Agency x licensed county row (service authority, not agencies)",
    "Home Health county service",
    "homeHealth",
    "PARTIAL",
  );
  add(
    "TN",
    "hospice.distinctAgenciesAsPrinted",
    "Agency name and home county as printed on the HFC county list (no license number)",
    "Hospice (state license)",
    "hospice",
    "PARTIAL",
  );
  add(
    "TN",
    "hospice.countyServiceRows",
    "Agency x licensed county row (service authority, not agencies)",
    "Hospice county service",
    "hospice",
    "PARTIAL",
  );
  add(
    "TN",
    "facilityActions.seniorClassActionRows",
    "Licensee row in a monthly HFC Facility Action and Abuse Report (senior classes)",
    "State facility action",
    "facilityActions",
    "PARTIAL",
  );
  for (const [field, grain, providerClass, status] of [
    [
      "skilledNursing.distinctCredentialNumbers",
      "Active SNF credential number in the HCQC facility search",
      "Skilled nursing facility (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "skilledNursingDistinctPart.distinctCredentialNumbers",
      "Active SFD credential number in the HCQC facility search",
      "Skilled nursing distinct part of hospital (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "rfg.distinctCredentialNumbers",
      "Active AGC credential number in the HCQC facility search",
      "Residential Facility for Groups (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "rfg.assistedLivingEndorsed",
      "RFG with the ASSISTED LIVING SERVICES endorsement printed",
      "Assisted living (endorsed RFG)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "rfg.alzheimerEndorsed",
      "RFG with the ALZHEIMER DISEASE endorsement printed",
      "Alzheimer's-endorsed RFG",
      "STATE_SOURCE_LIVE",
    ],
    [
      "rfg.bedsAsPrinted",
      "Beds printed on active RFG licenses (capacity, not residents)",
      "Residential Facility for Groups beds",
      "STATE_SOURCE_LIVE",
    ],
    [
      "hirc.distinctCredentialNumbers",
      "Active HIC credential number in the HCQC facility search",
      "Home for Individual Residential Care (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "adultDay.distinctCredentialNumbers",
      "Active ADC credential number in the HCQC facility search",
      "Adult Day Care (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "homeHealth.distinctCredentialNumbers",
      "Active HHA credential number in the HCQC facility search",
      "Home Health Agency (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "hospiceProgram.distinctCredentialNumbers",
      "Active HPC credential number in the HCQC facility search",
      "Hospice program of care (state license)",
      "STATE_SOURCE_LIVE",
    ],
    [
      "hospiceFacility.distinctCredentialNumbers",
      "Active HFS credential number in the HCQC facility search",
      "Facility for hospice care (state license)",
      "STATE_SOURCE_LIVE",
    ],
  ])
    add("NV", field, grain, providerClass, field.split(".")[0], status);
  add(
    "NV",
    "inspections.indexRows",
    "HCQC inspection index row on an active facility page",
    "State inspection",
    "inspections",
    "PARTIAL",
  );
  add(
    "NV",
    "stateSanctions.rows",
    "HCQC State Sanctions row on an active facility page",
    "State sanction",
    "stateSanctions",
    "PARTIAL",
  );
  add(
    "NV",
    "complaints.providerLevelRows",
    "provider-level complaint record",
    "Complaint",
    "complaints",
    "REQUEST_ONLY",
    true,
  );
  for (const [field, grain, providerClass] of [
    [
      "nursingHome.distinctLicenses",
      "Nursing Homes license in the MDH daily directory",
      "Nursing home (state license)",
    ],
    [
      "assistedLiving.distinctLicenses",
      "ASSISTED LIVING FACILITY license in the MDH directory",
      "Assisted Living Facility (state license)",
    ],
    [
      "assistedLivingDementiaCare.distinctLicenses",
      "ASSISTED LIVING FACILITY DEMENTIA CARE license in the MDH directory",
      "Assisted Living Facility with Dementia Care (state license)",
    ],
    [
      "provisionalAssistedLiving.distinctLicenses",
      "PROVISIONAL ASSISTED LIVING FACILITY license in the MDH directory",
      "Provisional Assisted Living Facility (state license)",
    ],
    [
      "provisionalAssistedLivingDementiaCare.distinctLicenses",
      "PROVISIONAL ASSISTED LIVING W DEMENTIA C license in the MDH directory",
      "Provisional Assisted Living Facility with Dementia Care (state license)",
    ],
    [
      "boardingCare.distinctLicenses",
      "Board & Care Home license in the MDH directory",
      "Boarding Care Home (state license)",
    ],
    [
      "comprehensiveHomeCare.distinctLicenses",
      "COMPREHENSIVE HOME CARE license in the MDH directory",
      "Comprehensive Home Care (state license)",
    ],
    [
      "basicHomeCare.distinctLicenses",
      "BASIC HOME CARE license in the MDH directory",
      "Basic Home Care (state license)",
    ],
    [
      "homeHealthAgency.distinctLicenses",
      "HOME HEALTH AGENCY row in the MDH directory",
      "Home Health Agency (MDH directory)",
    ],
    [
      "hospiceProvider.distinctLicenses",
      "Hospice Provider License row in the MDH directory",
      "Hospice provider (state license)",
    ],
    [
      "residentialHospice.distinctLicenses",
      "Residential Hospice License row in the MDH directory",
      "Residential hospice (state license)",
    ],
  ])
    add("MN", field, grain, providerClass, field.split(".")[0], "STATE_SOURCE_LIVE");
  add(
    "MN",
    "findings.evaluationRowsAttached",
    "MDH evaluation result row attached by exact HFID",
    "State evaluation",
    "findings",
    "PARTIAL",
  );
  add(
    "MN",
    "findings.investigationRowsAttached",
    "OHFC investigation result row attached by exact HFID",
    "State investigation",
    "findings",
    "PARTIAL",
  );
  add(
    "TN",
    "complaints.providerLevelRows",
    "provider-level complaint record",
    "Complaint",
    "complaints",
    "REQUEST_ONLY",
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
    "or-odhs-nf": "or.odhsProviders.OPEN_NF",
    "pa-doh-nh": "pa.nursingHomes.PA_NURSING_HOME_ROWS",
    "nc-dhsr-ach": "nc.adultCareHomes.NC_ADULT_CARE_HOME_ROWS",
    "oh-odh-nh": "oh.nursingHomes.OH_NURSING_FACILITY_ROWS",
    "ga-cms-nh": "ga.cmsOverlay.nursingHomes",
    "ga-cms-hha": "ga.cmsOverlay.homeHealth",
    "ga-cms-hospice": "ga.cmsOverlay.hospice",
    "ma-dph-nh": "ma.nursingHomes.rows",
    "ma-dph-rest": "ma.restHomes.rows",
    "ma-age-alr": "ma.assistedLiving.rows",
    "nv-hcqc-snf": "nv.skilledNursing.distinctCredentialNumbers",
    "nv-hcqc-rfg": "nv.rfg.distinctCredentialNumbers",
    "nv-hcqc-rfg-al": "nv.rfg.assistedLivingEndorsed",
    "mn-mdh-nh": "mn.nursingHome.distinctLicenses",
    "mn-mdh-alf": "mn.assistedLiving.distinctLicenses",
    "mn-mdh-alfdc": "mn.assistedLivingDementiaCare.distinctLicenses",
    "tn-hfc-nh": "tn.nursingHomes.distinctLicenseNumbers",
    "tn-hfc-aclf": "tn.aclf.distinctLicenseNumbers",
    "tn-hfc-rha": "tn.rha.distinctLicenseNumbers",
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
  // Official source clocks are separate from the date we accepted/retrieved a snapshot.
  const clockPaths = {
    NJ: [
      ["NJ long-term care", "ltcAsOf"],
      ["NJ acute care", "acuteAsOf"],
    ],
    CA: [
      ["CDPH ELMS", "elms"],
      ["CDSS RCFE", "rcfe"],
      ["CDSS HCO", "hco"],
      ["CDSS ARF", "arf"],
      ["HCAI", "hcai"],
    ],
    TX: [
      ["HHSC nursing facilities", "hhscNursingFacilities"],
      ["HHSC assisted living", "hhscAssistedLiving"],
      ["HHSC HCSSA", "hhscHcssa"],
      ["HHSC nursing closures", "enforcement.nfClosures"],
      ["HHSC assisted-living closures", "enforcement.alfClosures"],
      ["HHSC HCSSA closures", "enforcement.hcssaClosures"],
    ],
    WA: [["DSHS acquired GIS snapshot", "dshsGis"]],
    AZ: [["ADHS GIS extract", "adhsGis"]],
    CO: [["CDPHE verification context", "cdphe"]],
    VA: [
      ["DSS assisted living", "dssAlf"],
      ["DSS adult day care", "dssAdc"],
    ],
    NY: [
      ["NY nursing-home profiles", "nursingHomeProfile"],
      ["NY adult-care facilities", "acf"],
      ["NY Do Not Refer", "doNotRefer"],
      ["NY home care", "homeCare"],
    ],
    IL: [
      ["IDPH Home Health", "idphHomeHealth"],
      ["IDPH Hospice", "idphHospice"],
      ["IDPH Home Nursing", "idphHomeNursing"],
      ["IDPH Home Services", "idphHomeServices"],
      ["IDPH Hospice Residence", "idphHospiceResidence"],
      ["HFS Supportive Living", "supportiveLiving"],
    ],
    OR: [
      ["ODHS LTC providers", "odhsProviders"],
      ["ODHS inspections", "odhsInspections"],
      ["ODHS violations", "odhsViolations"],
      ["ODHS license-condition actions", "odhsRegulatoryActions"],
      ["OHA Home Health", "ohaHomeHealth"],
      ["OHA Hospice", "ohaHospice"],
    ],
    PA: [
      ["DOH nursing homes", "nursingHomes"],
      ["DOH Home Health", "homeHealth"],
      ["DOH Home Care", "homeCare"],
      ["DOH Hospice", "hospice"],
      ["PCH monthly report", "pchMonthlyReport"],
      ["LIFE/PACE", "lifePace"],
    ],
    NC: [
      ["DHSR Adult Care Homes", "adultCareHomes"],
      ["DHSR Family Care Homes", "familyCareHomes"],
      ["DHSR Nursing Homes", "nursingHomes"],
      ["DHSR Home Health", "homeHealth"],
      ["DHSR Hospice", "hospice"],
      ["DHSR Home Care All mixed file", "homeCareAllMixed"],
      ["NC DHSR Star Rating listing", "starRatings"],
      ["Adult Care penalties", "adultCarePenalties"],
      ["Adult Day directory", "adultDay"],
      ["PACE", "pace"],
      ["CCRC", "ccrc"],
    ],
    OH: [
      ["ODH nursing facilities", "nursingHomes"],
      ["ODH Residential Care Facilities", "rcf"],
      ["Long-Term Care Quality Navigator", "navigator"],
      ["ODH inspections", "inspections"],
    ],
    GA: [
      ["DCH Personal Care Home program statement", "programContext"],
      ["GaMap2Care finder", "gaMap2Care"],
      ["HFRD inspection search", "inspections"],
      ["HFRD complaints", "complaints"],
    ],
    MA: [
      ["DPH facility workbook", "dphWorkbook"],
      ["AGE certified ALR list", "assistedLiving"],
      ["DPH Survey Performance Tool", "surveyTool"],
      ["DPH complaints", "complaints"],
    ],
    TN: [
      ["HFC Nursing Home bed report", "nursingHomes"],
      ["HFC ACLF bed report", "aclf"],
      ["HFC RHA bed report", "rha"],
      ["HFC Home Health county list", "homeHealth"],
      ["HFC Hospice county list", "hospice"],
      ["HFC facility actions", "facilityActions"],
      ["HFC complaints", "complaints"],
    ],
    NV: [
      ["HCQC Skilled Nursing search", "skilledNursing"],
      ["HCQC Residential Facility for Groups search", "rfg"],
      ["HCQC Home for Individual Residential Care search", "hirc"],
      ["HCQC Home Health search", "homeHealth"],
      ["HCQC Hospice program search", "hospiceProgram"],
      ["HCQC state sanctions", "stateSanctions"],
      ["HCQC complaints", "complaints"],
    ],
    MN: [
      ["MDH Nursing Homes directory", "nursingHome"],
      ["MDH Assisted Living directory", "assistedLiving"],
      ["MDH Assisted Living with Dementia Care directory", "assistedLivingDementiaCare"],
      ["MDH Home Health directory", "homeHealthAgency"],
      ["MDH Hospice directory", "hospiceProvider"],
      ["MDH evaluation and investigation results", "findings"],
      ["OHFC complaints", "complaints"],
    ],
  };
  const stateCards = structuredClone(SENIOR_HOMEPAGE_STATE_CARDS);
  for (const card of stateCards) {
    if (card.state === "FL") continue; // Florida's accepted source clock is already explicit.
    const snapshot = snapshots[card.state];
    card.snapshotAsOf = snapshot.snapshotAsOf ?? snapshot.asOf ?? null;
    card.retrievedAt = snapshot.retrievedAt ?? null;
    card.sourceClocks = clockPaths[card.state].map(([label, path]) => {
      const source = path.split(".").reduce((o, k) => o?.[k], snapshot);
      return {
        label,
        sourceAsOf:
          typeof source === "string"
            ? source
            : (source?.sourceAsOf ?? source?.source_as_of ?? source?.run_date ?? null),
        snapshotAsOf: card.snapshotAsOf,
        retrievedAt: source?.retrievedAt ?? source?.retrieved_at ?? card.retrievedAt,
      };
    });
    for (const [label, clock] of Object.entries(snapshot.cmsOverlay?.clocks ?? {})) {
      card.sourceClocks.push({
        label: `CMS ${label}`,
        sourceAsOf: clock.sourceModifiedAt ?? null,
        snapshotAsOf: card.snapshotAsOf,
        retrievedAt: clock.retrievedAt ?? null,
      });
    }
    const dates = [
      ...new Set(card.sourceClocks.map((clock) => clock.sourceAsOf?.slice(0, 10) ?? null)),
    ];
    card.sourceAsOf = dates.length === 1 ? dates[0] : null;
  }
  // Older inventory rows also use their accepted agency clocks, never curated dates.
  const inventoryClockPaths = {
    "nj-ltc-identities": "ltcAsOf",
    "nj-enforcement-indexed": null,
    "nj-enforcement-documents": null,
    "ca-elms": "elms",
    "ca-rcfe": "rcfe",
    "ca-snf-crosswalk": null,
    "tx-nf": "hhscNursingFacilities",
    "tx-alf": "hhscAssistedLiving",
    "tx-hcssa": "hhscHcssa",
    "tx-nf-crosswalk": "hhscNursingFacilities",
    "wa-residential": null,
    "wa-afh": null,
    "wa-nh-crosswalk": null,
    "az-gis-all": "adhsGis",
    "az-al-home": "adhsGis",
    "az-nh-crosswalk": "adhsGis",
    "az-hha-crosswalk": "adhsGis",
    "az-hospice-crosswalk": "adhsGis",
    "or-odhs-nf": null,
  };
  for (const row of evidenceInventory) {
    if (!Object.hasOwn(inventoryClockPaths, row.key)) continue;
    const snapshot = snapshots[row.key.slice(0, 2).toUpperCase()];
    const source = snapshot[inventoryClockPaths[row.key]];
    row.sourceAsOf =
      typeof source === "string"
        ? source
        : (source?.sourceAsOf ?? source?.source_as_of ?? source?.run_date ?? null);
    row.snapshotAsOf = snapshot.snapshotAsOf ?? snapshot.asOf ?? null;
    row.retrievedAt = source?.retrievedAt ?? source?.retrieved_at ?? snapshot.retrievedAt ?? null;
    row.generatedAt = base.generatedAt;
    row.generatedOrRetrievedAt = row.retrievedAt;
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
      stateSourceAcquired: stateCards.some(
        (c) => c.state === state && state !== "CO" && state !== "GA",
      ),
      specialistComplete: null,
      metricKeys: stateMetrics.filter((m) => m.state === state).map((m) => m.key),
    })),
    census: { path: censusPath, retrievedAt: census.retrievedAt, sourceAsOf: null },
    noCombinedProviderDenominator: true,
  };
  return base;
}
