import { TN_PUBLIC_SNAPSHOT } from "./tn-public-snapshot";

export { TN_PUBLIC_SNAPSHOT };

export const TN_INTEL_VERSION = "senior-tn-state-intel-v1" as const;
export const TN_PUBLIC_FINGERPRINT =
  "f95d81b37f042879e0259bf8d833e0e89122e8a44e55030aa281ca044b047ea9";
export const TN_PUBLIC_PATH = "/tennessee";

export type TnPublicSnapshot = typeof TN_PUBLIC_SNAPSHOT;

export const TN_LOCKED = {
  hfcNursingHomeLicenses: 326,
  hfcNursingHomeReportRows: 327,
  hfcNursingHomeBeds: 36730,
  hfcAclfs: 331,
  hfcAclfBeds: 23081,
  hfcRhas: 39,
  hfcRhaBeds: 795,
  homeHealthCountyRows: 2487,
  homeHealthAgenciesAsPrinted: 176,
  hospiceCountyRows: 732,
  hospiceAgenciesAsPrinted: 63,
  seniorActionRows: 201,
  cmsNursingHomes: 303,
  cmsHomeHealth: 128,
  cmsHospice: 61,
  exactCmsBridges: 0,
} as const;

export type TnCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export interface TnTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: TnCapabilityState;
  caveat: string;
}

export function tnTraceMetrics(snapshot: TnPublicSnapshot = TN_PUBLIC_SNAPSHOT): TnTraceMetric[] {
  const bed = (
    id: string,
    label: string,
    cls: TnPublicSnapshot["nursingHomes"] | TnPublicSnapshot["aclf"] | TnPublicSnapshot["rha"],
    sourceGrain: string,
    caveat: string,
  ): TnTraceMetric => ({
    id,
    label,
    display: cls.distinctLicenseNumbers.toLocaleString("en-US"),
    value: cls.distinctLicenseNumbers,
    source: cls.source,
    sourceDate: cls.sourceAsOf,
    sourceGrain,
    coverageState: "KNOWN",
    caveat,
  });
  const county = (
    id: string,
    label: string,
    cls: TnPublicSnapshot["homeHealth"] | TnPublicSnapshot["hospice"],
  ): TnTraceMetric => ({
    id,
    label,
    display: cls.distinctAgenciesAsPrinted.toLocaleString("en-US"),
    value: cls.distinctAgenciesAsPrinted,
    source: cls.source,
    sourceDate: cls.sourceAsOf,
    sourceGrain: "Distinct agency name and home county as printed on the county list",
    coverageState: "PARTIAL",
    caveat: `The list prints no license number, so agencies are counted by printed name. ${cls.countyServiceRows.toLocaleString("en-US")} agency-county rows are service authority, not agencies. The printed source date is ${cls.sourceAsOf}.`,
  });
  const cms = snapshot.cmsOverlay;
  return [
    bed(
      "hfc-nh",
      "HFC Nursing Home licenses",
      snapshot.nursingHomes,
      "License number on the HFC Nursing Home Full Bed Report",
      `A state license is not a CMS CCN. ${snapshot.nursingHomes.licensedBeds.toLocaleString("en-US")} licensed beds (beds are not residents).`,
    ),
    bed(
      "hfc-aclf",
      "HFC Assisted Care Living Facilities",
      snapshot.aclf,
      "License number on the HFC ACLF Full Bed Report",
      "An ACLF is not a Nursing Home and not a Residential Home for the Aged.",
    ),
    bed(
      "hfc-rha",
      "HFC Residential Homes for the Aged",
      snapshot.rha,
      "License number on the HFC Home for the Aged Full Bed Report",
      "An RHA is not an ACLF, not a Nursing Home, and not an Adult Care Home.",
    ),
    county("hfc-hha", "HFC-listed Home Health agencies", snapshot.homeHealth),
    county("hfc-hospice", "HFC-listed Hospice agencies", snapshot.hospice),
    {
      id: "hfc-actions",
      label: "HFC facility action rows (senior classes)",
      display: snapshot.facilityActions.seniorClassActionRows.toLocaleString("en-US"),
      value: snapshot.facilityActions.seniorClassActionRows,
      source: snapshot.facilityActions.source,
      sourceDate: snapshot.facilityActions.sourceAsOf,
      sourceGrain: "Licensee row in a monthly Facility Action and Abuse Report",
      coverageState: "PARTIAL",
      caveat:
        "Actions are not inspections or complaints. A row attaches to a state report row only by exact license class and number with an agreeing name.",
    },
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Tennessee",
      display: cms.nursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl,
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = TN",
      coverageState: "KNOWN",
      caveat:
        "CMS certification is not an HFC license. The two counts are not added and not bridged.",
    },
  ];
}

export function assertTnIntelligence(
  value: TnPublicSnapshot = TN_PUBLIC_SNAPSHOT,
): TnPublicSnapshot {
  if (value.version !== TN_INTEL_VERSION)
    throw new Error(`Unexpected TN contract ${value.version}`);
  if (value.fingerprint !== TN_PUBLIC_FINGERPRINT) throw new Error("TN fingerprint drifted");
  if (value.publicationPath !== TN_PUBLIC_PATH) throw new Error("path must be /tennessee");
  if (value.nursingHomes.distinctLicenseNumbers !== TN_LOCKED.hfcNursingHomeLicenses)
    throw new Error("HFC NH drifted");
  if (value.nursingHomes.reportRows !== TN_LOCKED.hfcNursingHomeReportRows)
    throw new Error("HFC NH rows drifted");
  if (value.nursingHomes.licensedBeds !== TN_LOCKED.hfcNursingHomeBeds)
    throw new Error("HFC NH beds drifted");
  if (value.aclf.distinctLicenseNumbers !== TN_LOCKED.hfcAclfs) throw new Error("ACLF drifted");
  if (value.aclf.licensedBeds !== TN_LOCKED.hfcAclfBeds) throw new Error("ACLF beds drifted");
  if (value.rha.distinctLicenseNumbers !== TN_LOCKED.hfcRhas) throw new Error("RHA drifted");
  if (value.rha.licensedBeds !== TN_LOCKED.hfcRhaBeds) throw new Error("RHA beds drifted");
  if (
    value.aclf.distinctFromNursingHome !== true ||
    value.aclf.distinctFromRha !== true ||
    value.rha.distinctFromAclf !== true ||
    value.rha.distinctFromNursingHome !== true ||
    value.rha.distinctFromAdultCareHome !== true
  ) {
    throw new Error("Nursing Home, ACLF, and RHA stay separate classes");
  }
  if (value.homeHealth.countyServiceRows !== TN_LOCKED.homeHealthCountyRows)
    throw new Error("HHA county rows drifted");
  if (value.homeHealth.distinctAgenciesAsPrinted !== TN_LOCKED.homeHealthAgenciesAsPrinted)
    throw new Error("HHA agencies drifted");
  if (value.hospice.countyServiceRows !== TN_LOCKED.hospiceCountyRows)
    throw new Error("Hospice county rows drifted");
  if (value.hospice.distinctAgenciesAsPrinted !== TN_LOCKED.hospiceAgenciesAsPrinted)
    throw new Error("Hospice agencies drifted");
  for (const cls of [value.homeHealth, value.hospice]) {
    if (cls.countyRowsAreNotAgencies !== true) throw new Error("county rows are not agencies");
    if (cls.distinctStateAgencyIds !== null) throw new Error("the county list has no agency ID");
  }
  if (value.homeHealth.exemptionListsAddedToMainList !== false)
    throw new Error("exemption lists are separate");
  if (value.facilityActions.seniorClassActionRows !== TN_LOCKED.seniorActionRows)
    throw new Error("HFC action rows drifted");
  if (value.facilityActions.abuseRegistryNamesPublished !== false)
    throw new Error("abuse registry names are not published");
  if (value.facilityActions.attachedToCmsProfile !== 0 || value.facilityActions.nameOnlyJoins !== 0)
    throw new Error("no CMS or name-only action joins");
  if (value.cmsOverlay.nursingHomes !== TN_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH drifted");
  if (value.cmsOverlay.homeHealth !== TN_LOCKED.cmsHomeHealth) throw new Error("CMS HHA drifted");
  if (value.cmsOverlay.hospice !== TN_LOCKED.cmsHospice) throw new Error("CMS Hospice drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false) throw new Error("do not re-add CMS totals");
  if (value.crosswalk.exactStateToCmsBridges !== TN_LOCKED.exactCmsBridges)
    throw new Error("no CCN in the HFC reports means zero exact bridges");
  if (value.crosswalk.ccnInHfcReports !== false) throw new Error("HFC reports carry no CCN");
  if (value.crosswalk.nameOnly !== "UNSAFE") throw new Error("name-only joins stay unsafe");
  if (value.complaints.providerLevelRows !== null)
    throw new Error("complaint rows were not acquired");
  if (value.complaints.capability !== "REQUEST_ONLY")
    throw new Error("complaints stay request-only");
  if (value.nursingHomeEnforcementReport.usedAsIdentitySource !== false)
    throw new Error("the enforcement report is context only");
  if (value.adultCareHome.rosterRows !== null) throw new Error("no Adult Care Home roster");
  if (value.expansionLedger.GRAPH_WRITES !== 0) throw new Error("graph writes must stay 0");
  if (value.expansionLedger.NET_NEW_CANONICAL_FACILITIES !== 0)
    throw new Error("no new canonical facilities");
  if (value.claimEligibilityBroadened) throw new Error("claim eligibility must stay false");
  if (value.no_city_pages !== true) throw new Error("no city pages");
  if (value.clocks.retrievedAt_is_not_sourceAsOf !== true)
    throw new Error("retrieval is not a source date");
  if (value.clocks.license_effective_date !== null || value.clocks.license_expiration_date !== null)
    throw new Error("the HFC reports publish no license dates");
  const allowed = new Set([
    "KNOWN",
    "UNKNOWN",
    "PARTIAL",
    "NOT_ACQUIRED",
    "REQUEST_ONLY",
    "UNSUPPORTED",
  ]);
  if (value.capabilities.some((row) => !allowed.has(row.state)))
    throw new Error("capability state outside the allowed set");
  for (const id of ["combined-tennessee-senior-facilities", "combined-tennessee-senior-beds"]) {
    if (value.capabilities.find((row) => row.id === id)?.state !== "UNSUPPORTED")
      throw new Error(`${id} is unsupported`);
  }
  return value;
}
