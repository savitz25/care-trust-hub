import { GA_PUBLIC_SNAPSHOT } from "./ga-public-snapshot";

export { GA_PUBLIC_SNAPSHOT };

export const GA_INTEL_VERSION = "senior-ga-state-intel-v1" as const;
export const GA_PUBLIC_FINGERPRINT =
  "1820ee3a2f723f411dc59654e5633144adaba6be7a79f9cc673b469ee4ec476e";
export const GA_PUBLIC_PATH = "/georgia";

export type GaPublicSnapshot = typeof GA_PUBLIC_SNAPSHOT;

export const GA_LOCKED = {
  cmsNursingHomes: 356,
  cmsHomeHealth: 105,
  cmsHospice: 261,
  netNewCanonical: 0,
  netNewStateIdentities: 0,
  parsedPdfs: 0,
} as const;

export type GaCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export interface GaTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: GaCapabilityState;
  caveat: string;
}

export function gaTraceMetrics(snapshot: GaPublicSnapshot = GA_PUBLIC_SNAPSHOT): GaTraceMetric[] {
  const cms = snapshot.cmsOverlay;
  return [
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Georgia",
      display: GA_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl,
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = GA",
      coverageState: "KNOWN",
      caveat:
        "CMS certification is not a Georgia DCH nursing-home license. 356 is not the department's 357 long-term-care statement.",
    },
    {
      id: "cms-hha",
      label: "CMS Home Health Agencies in Georgia",
      display: GA_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: cms.homeHealth,
      source: cms.clocks.homeHealth.officialUrl,
      sourceDate: cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Home Health CCN with state = GA",
      coverageState: "KNOWN",
      caveat: "CMS Home Health is not a Georgia Private Home Care Provider license.",
    },
    {
      id: "cms-hospice",
      label: "CMS Hospice providers in Georgia",
      display: GA_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: cms.hospice,
      source: cms.clocks.hospice.officialUrl,
      sourceDate: cms.clocks.hospice.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Hospice CCN with state = GA",
      coverageState: "KNOWN",
      caveat: "CMS Hospice is not a Georgia state hospice license.",
    },
    {
      id: "pch",
      label: "Georgia Personal Care Home licenses",
      display: "Not acquired",
      value: snapshot.personalCareHomes.rows,
      source: snapshot.regulatorMap.personalCareHomes,
      sourceDate: null,
      sourceGrain: "HFRD Personal Care Home license (Chapter 111-8-62)",
      coverageState: "NOT_ACQUIRED",
      caveat: "Personal Care Home is not an Assisted Living Community and not a CMS nursing home.",
    },
    {
      id: "alc",
      label: "Georgia Assisted Living Community licenses",
      display: "Not acquired",
      value: snapshot.assistedLivingCommunities.rows,
      source: snapshot.regulatorMap.personalCareHomes,
      sourceDate: null,
      sourceGrain:
        "HFRD Assisted Living Community license (Chapter 111-8-63, 25 or more residents)",
      coverageState: "NOT_ACQUIRED",
      caveat: "Assisted Living Community is not a Personal Care Home and not a CMS nursing home.",
    },
  ];
}

export function assertGaIntelligence(
  value: GaPublicSnapshot = GA_PUBLIC_SNAPSHOT,
): GaPublicSnapshot {
  if (value.version !== GA_INTEL_VERSION)
    throw new Error(`Unexpected GA contract ${value.version}`);
  if (value.fingerprint !== GA_PUBLIC_FINGERPRINT) throw new Error("GA fingerprint drifted");
  if (value.publicationPath !== GA_PUBLIC_PATH) throw new Error("path must be /georgia");
  if (value.cmsOverlay.nursingHomes !== GA_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH drifted");
  if (value.cmsOverlay.homeHealth !== GA_LOCKED.cmsHomeHealth) throw new Error("CMS HHA drifted");
  if (value.cmsOverlay.hospice !== GA_LOCKED.cmsHospice) throw new Error("CMS Hospice drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false) throw new Error("do not re-add CMS totals");
  if (value.cmsOverlay.censusConfirmation.nursingHomes !== GA_LOCKED.cmsNursingHomes) {
    throw new Error("census confirmation drifted");
  }
  if (value.personalCareHomes.rows !== null) throw new Error("PCH roster must stay unacquired");
  if (value.assistedLivingCommunities.rows !== null)
    throw new Error("ALC roster must stay unacquired");
  if (value.personalCareHomes.distinctFromAssistedLivingCommunity !== true) {
    throw new Error("PCH must stay distinct from ALC");
  }
  if (value.assistedLivingCommunities.minimumResidents !== 25) {
    throw new Error("ALC minimum must stay 25");
  }
  if (value.communityLivingArrangements.rows !== null)
    throw new Error("CLA roster must stay unacquired");
  if (value.adultDay.rows !== null) throw new Error("Adult Day roster must stay unacquired");
  if (value.privateHomeCare.rows !== null)
    throw new Error("Private Home Care roster must stay unacquired");
  if (value.stateNursingHomeLicenses.rows !== null) throw new Error("state NH licenses unacquired");
  if (value.gaMap2Care.capability !== "NOT_ACQUIRED")
    throw new Error("GaMap2Care bulk not acquired");
  if (value.gaMap2Care.blocksClosure !== false)
    throw new Error("missing GaMap2Care must not block closure");
  if (value.inspections.indexedReports !== null)
    throw new Error("inspection index was not acquired");
  if (value.inspections.parsedPdfCount !== 0) throw new Error("no PDFs were parsed");
  if (value.inspections.parsedPdfCountIsNotZeroInspections !== true) {
    throw new Error("zero parsed PDFs is not zero inspections");
  }
  if (value.complaints.capability !== "REQUEST_ONLY")
    throw new Error("complaints stay request-only");
  if (value.complaints.doNotInferFromInspections !== true)
    throw new Error("do not infer complaints");
  if (value.crosswalk.exactStateToCmsBridges !== null) throw new Error("no join was attempted");
  if (value.crosswalk.attempted !== false) throw new Error("join must stay unattempted");
  if (value.crosswalk.nameOnly !== "UNSAFE") throw new Error("name-only joins stay unsafe");
  if (value.programContext.usedAsTrustHubCount !== false)
    throw new Error("2,910 is not a hub count");
  if (value.programContext.value !== null) throw new Error("program statement has no metric value");
  if (value.ltcStatement.usedAsTrustHubCount !== false) throw new Error("357 is not a hub count");
  if (value.ltcStatement.notCmsNursingHomeCount !== true)
    throw new Error("357 is not the CMS count");
  if (value.hfrdWideStatement.usedAsTrustHubCount !== false)
    throw new Error("HFRD-wide statement is not a senior census");
  if (value.expansionLedger.GRAPH_WRITES !== 0) throw new Error("graph writes must stay 0");
  if (value.expansionLedger.NET_NEW_CANONICAL_FACILITIES !== 0)
    throw new Error("no new facilities");
  if (value.claimEligibilityBroadened) throw new Error("claim eligibility must stay false");
  if (value.no_atlanta_page !== true) throw new Error("no Atlanta page");
  if (value.clocks.retrievedAt_is_not_inspection_date !== true) {
    throw new Error("retrieval is not an inspection date");
  }
  if (value.clocks.cms_date_is_not_georgia_license_date !== true) {
    throw new Error("CMS date is not a Georgia license date");
  }
  if (value.clocks.hfrd_inspection_date !== null)
    throw new Error("no HFRD inspection date was acquired");
  const allowed = new Set([
    "KNOWN",
    "UNKNOWN",
    "PARTIAL",
    "NOT_ACQUIRED",
    "REQUEST_ONLY",
    "UNSUPPORTED",
  ]);
  if (value.capabilities.some((row) => !allowed.has(row.state))) {
    throw new Error("capability state outside the allowed set");
  }
  return value;
}
