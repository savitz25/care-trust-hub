import { MN_PUBLIC_SNAPSHOT } from "./mn-public-snapshot";

export { MN_PUBLIC_SNAPSHOT };

export const MN_INTEL_VERSION = "senior-mn-state-intel-v1" as const;
export const MN_PUBLIC_FINGERPRINT =
  "b453a290198d834945104aa81f2942bd1fb3bc0fda33fff8cb51fb4d18e9e223";
export const MN_PUBLIC_PATH = "/minnesota";

export type MnPublicSnapshot = typeof MN_PUBLIC_SNAPSHOT;

export const MN_LOCKED = {
  nursingHome: 335,
  assistedLiving: 1571,
  assistedLivingDementiaCare: 601,
  provisionalAssistedLiving: 346,
  provisionalAssistedLivingDementiaCare: 7,
  boardingCare: 14,
  comprehensiveHomeCare: 369,
  basicHomeCare: 44,
  homeHealthAgency: 142,
  hospiceProvider: 75,
  residentialHospice: 5,
  supervisedLiving: 95,
  cmsNursingHomes: 338,
  cmsHomeHealth: 138,
  cmsHospice: 81,
  cmsNursingHomesBridged: 329,
  cmsHomeHealthBridged: 135,
  cmsHospiceBridged: 59,
} as const;

export type MnCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export interface MnTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: MnCapabilityState;
  caveat: string;
}

type ClassBlock = {
  rows: number;
  distinctLicenses: number;
  source: string;
  retrievedAt: string | null;
};

export function mnTraceMetrics(snapshot: MnPublicSnapshot = MN_PUBLIC_SNAPSHOT): MnTraceMetric[] {
  const state = (
    id: string,
    label: string,
    cls: ClassBlock,
    sourceGrain: string,
    caveat: string,
  ): MnTraceMetric => ({
    id,
    label,
    display: cls.distinctLicenses.toLocaleString("en-US"),
    value: cls.distinctLicenses,
    source: cls.source,
    sourceDate: cls.retrievedAt
      ? `retrieved ${cls.retrievedAt.slice(0, 10)} (MDH updates the directory daily; the export prints no as-of date)`
      : null,
    sourceGrain,
    coverageState: "KNOWN",
    caveat,
  });
  const cms = snapshot.cmsOverlay;
  const cw = snapshot.crosswalk;
  return [
    state(
      "mdh-nh",
      "MDH Nursing Home licenses",
      snapshot.nursingHome,
      "Nursing Homes row in the MDH Health Care Provider Directory",
      `A state license is not a CMS CCN. ${cw.cmsNursingHomesBridged} of ${cms.nursingHomes} CMS nursing homes match by the exact printed Medicare number; the counts are not added.`,
    ),
    state(
      "mdh-alf",
      "Assisted Living Facility licenses",
      snapshot.assistedLiving,
      "ASSISTED LIVING FACILITY row in the MDH directory",
      "Not the dementia-care license and not the provisional licenses; each is counted on its own.",
    ),
    state(
      "mdh-alfdc",
      "Assisted Living Facility with Dementia Care licenses",
      snapshot.assistedLivingDementiaCare,
      "ASSISTED LIVING FACILITY DEMENTIA CARE row in the MDH directory",
      "A separate MDH license type. Dementia care is never inferred from a facility name or advertising.",
    ),
    state(
      "mdh-bch",
      "Boarding Care Home licenses",
      snapshot.boardingCare,
      "Board & Care Home row in the MDH directory",
      "A separate license from Nursing Homes. The numbers printed for federally classified Nursing Facility rows are not CCNs.",
    ),
    state(
      "mdh-comp-home-care",
      "Comprehensive Home Care licenses",
      snapshot.comprehensiveHomeCare,
      "COMPREHENSIVE HOME CARE row in the MDH directory",
      "Home care is not Home Health. Temporary, basic, and branch rows are counted separately.",
    ),
    state(
      "mdh-hha",
      "Home Health Agencies in the MDH directory",
      snapshot.homeHealthAgency,
      "HOME HEALTH AGENCY row in the MDH directory",
      `Minnesota licenses these as home care providers; the federal Home Health classification is printed. ${cw.cmsHomeHealthBridged} of ${cms.homeHealth} CMS Minnesota agencies match by exact printed CCN.`,
    ),
    state(
      "mdh-hospice",
      "Hospice Provider licenses",
      snapshot.hospiceProvider,
      "Hospice Provider License row in the MDH directory",
      `Branches and residential hospices are separate rows. ${cw.cmsHospiceBridged} of ${cms.hospice} CMS Minnesota hospices match by exact printed CCN.`,
    ),
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Minnesota",
      display: cms.nursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl ?? "CMS",
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Nursing Home CCN with state = MN",
      coverageState: "KNOWN",
      caveat: `CMS certification is not an MDH license. ${cw.cmsNursingHomesNotBridged} are not linked; unlinked is not the same as no overlap.`,
    },
  ];
}

export function assertMnIntelligence(
  value: MnPublicSnapshot = MN_PUBLIC_SNAPSHOT,
): MnPublicSnapshot {
  if (value.version !== MN_INTEL_VERSION)
    throw new Error(`Unexpected MN contract ${value.version}`);
  if (value.fingerprint !== MN_PUBLIC_FINGERPRINT) throw new Error("MN fingerprint drifted");
  if (value.publicationPath !== MN_PUBLIC_PATH) throw new Error("path must be /minnesota");
  const L = MN_LOCKED;
  const counts: [number, number, string][] = [
    [value.nursingHome.distinctLicenses, L.nursingHome, "nursing home"],
    [value.assistedLiving.distinctLicenses, L.assistedLiving, "assisted living"],
    [
      value.assistedLivingDementiaCare.distinctLicenses,
      L.assistedLivingDementiaCare,
      "dementia care",
    ],
    [
      value.provisionalAssistedLiving.distinctLicenses,
      L.provisionalAssistedLiving,
      "provisional AL",
    ],
    [
      value.provisionalAssistedLivingDementiaCare.distinctLicenses,
      L.provisionalAssistedLivingDementiaCare,
      "provisional AL-DC",
    ],
    [value.boardingCare.distinctLicenses, L.boardingCare, "boarding care"],
    [
      value.comprehensiveHomeCare.distinctLicenses,
      L.comprehensiveHomeCare,
      "comprehensive home care",
    ],
    [value.basicHomeCare.distinctLicenses, L.basicHomeCare, "basic home care"],
    [value.homeHealthAgency.distinctLicenses, L.homeHealthAgency, "home health"],
    [value.hospiceProvider.distinctLicenses, L.hospiceProvider, "hospice"],
    [value.residentialHospice.distinctLicenses, L.residentialHospice, "residential hospice"],
    [value.supervisedLiving.distinctLicenses, L.supervisedLiving, "supervised living"],
    [value.cmsOverlay.nursingHomes, L.cmsNursingHomes, "CMS NH"],
    [value.cmsOverlay.homeHealth, L.cmsHomeHealth, "CMS HHA"],
    [value.cmsOverlay.hospice, L.cmsHospice, "CMS hospice"],
    [value.crosswalk.cmsNursingHomesBridged, L.cmsNursingHomesBridged, "NH bridges"],
    [value.crosswalk.cmsHomeHealthBridged, L.cmsHomeHealthBridged, "HHA bridges"],
    [value.crosswalk.cmsHospiceBridged, L.cmsHospiceBridged, "hospice bridges"],
  ];
  for (const [got, want, label] of counts) if (got !== want) throw new Error(`${label} drifted`);
  if (value.assistedLivingDementiaCare.separateLicenseType !== true)
    throw new Error("dementia care is its own MDH license type");
  if (value.assistedLivingDementiaCare.inferredFromNameOrMarketing !== false)
    throw new Error("dementia care is never inferred");
  if (value.boardingCare.distinctFromNursingHome !== true)
    throw new Error("boarding care is not a nursing home");
  if (value.homeHealthAgency.mnLicenseIsHomeCare !== true)
    throw new Error("home health classification kept as printed");
  if (value.cmsOverlay.addedToNationalTotals !== false) throw new Error("do not re-add CMS totals");
  if (value.crosswalk.nameOnly !== "UNSAFE") throw new Error("name-only joins stay unsafe");
  if (value.findings.nameOnlyJoins !== 0 || value.findings.attachedByExactHfidInSameGroup !== true)
    throw new Error("findings attach by exact HFID only");
  if (value.findings.findingTextCopied !== false) throw new Error("finding text is not copied");
  if (
    value.complaints.complaintIsNotDeficiency !== true ||
    value.complaints.complaintIsNotSanction !== true
  )
    throw new Error("complaint grain");
  if (
    value.expansionLedger.GRAPH_WRITES !== 0 ||
    value.expansionLedger.NET_NEW_CANONICAL_FACILITIES !== 0
  )
    throw new Error("no graph writes or new canonical facilities");
  if (value.claimEligibilityBroadened) throw new Error("claim eligibility must stay false");
  if (value.no_city_pages !== true) throw new Error("no city pages");
  if (value.clocks.retrievedAt_is_not_sourceAsOf !== true)
    throw new Error("retrieval is not a source date");
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
  for (const id of [
    "combined-minnesota-senior-facilities",
    "combined-minnesota-senior-beds",
    "name-only-bridge",
  ]) {
    if (value.capabilities.find((row) => row.id === id)?.state !== "UNSUPPORTED")
      throw new Error(`${id} is unsupported`);
  }
  return value;
}
