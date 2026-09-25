import { NV_PUBLIC_SNAPSHOT } from "./nv-public-snapshot";

export { NV_PUBLIC_SNAPSHOT };

export const NV_INTEL_VERSION = "senior-nv-state-intel-v1" as const;
export const NV_PUBLIC_FINGERPRINT =
  "43e036b7d3db32c9c76393a79b51163f5d8de5014d90899213639715dd49b640";
export const NV_PUBLIC_PATH = "/nevada";

export type NvPublicSnapshot = typeof NV_PUBLIC_SNAPSHOT;

export const NV_LOCKED = {
  snf: 58,
  sfd: 8,
  rfg: 438,
  rfgAssistedLiving: 74,
  rfgAlzheimer: 223,
  hirc: 145,
  adc: 27,
  hha: 306,
  hbr: 9,
  hpc: 242,
  hfs: 4,
  cmsNursingHomes: 66,
  cmsHomeHealth: 228,
  cmsHospice: 183,
  exactCmsBridges: 418,
  cmsNursingHomesBridged: 60,
  stateSanctionRows: 40,
} as const;

export type NvCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export interface NvTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: NvCapabilityState;
  caveat: string;
}

type ClassBlock = {
  distinctCredentialNumbers: number;
  source: string;
  retrievedAt: string | null;
  bedsAsPrinted: number;
};

export function nvTraceMetrics(snapshot: NvPublicSnapshot = NV_PUBLIC_SNAPSHOT): NvTraceMetric[] {
  const state = (
    id: string,
    label: string,
    cls: ClassBlock,
    sourceGrain: string,
    caveat: string,
  ): NvTraceMetric => ({
    id,
    label,
    display: cls.distinctCredentialNumbers.toLocaleString("en-US"),
    value: cls.distinctCredentialNumbers,
    source: cls.source,
    sourceDate: cls.retrievedAt
      ? `retrieved ${cls.retrievedAt.slice(0, 10)} (the search prints no as-of date)`
      : null,
    sourceGrain,
    coverageState: "KNOWN",
    caveat,
  });
  const cms = snapshot.cmsOverlay;
  const rfg = snapshot.rfg;
  return [
    state(
      "hcqc-snf",
      "HCQC Skilled Nursing licenses",
      snapshot.skilledNursing,
      "Active SNF credential number in the HCQC facility search",
      `A state license is not a CMS CCN. ${snapshot.skilledNursing.bedsAsPrinted.toLocaleString("en-US")} beds as printed (beds are not residents). ${snapshot.skilledNursingDistinctPart.distinctCredentialNumbers} hospital distinct-part SNFs are counted separately.`,
    ),
    state(
      "hcqc-rfg",
      "HCQC Residential Facilities for Groups",
      rfg,
      "Active AGC credential number in the HCQC facility search",
      "An RFG is the base class. It is assisted living only with the Assisted Living endorsement.",
    ),
    {
      id: "hcqc-rfg-al",
      label: "RFGs with the Assisted Living endorsement",
      display: rfg.assistedLivingEndorsed.toLocaleString("en-US"),
      value: rfg.assistedLivingEndorsed,
      source: rfg.source,
      sourceDate: rfg.retrievedAt ? `retrieved ${rfg.retrievedAt.slice(0, 10)}` : null,
      sourceGrain: "RFG whose HCQC detail page prints the ASSISTED LIVING SERVICES endorsement",
      coverageState: "KNOWN",
      caveat: "An endorsed subset of RFGs, not every RFG. Endorsements are shown as printed.",
    },
    {
      id: "hcqc-rfg-alz",
      label: "RFGs with the Alzheimer's disease endorsement",
      display: rfg.alzheimerEndorsed.toLocaleString("en-US"),
      value: rfg.alzheimerEndorsed,
      source: rfg.source,
      sourceDate: rfg.retrievedAt ? `retrieved ${rfg.retrievedAt.slice(0, 10)}` : null,
      sourceGrain: "RFG whose HCQC detail page prints the ALZHEIMER DISEASE endorsement",
      coverageState: "KNOWN",
      caveat:
        "Advertised memory care is state-endorsed only where the license shows this endorsement.",
    },
    state(
      "hcqc-hirc",
      "HCQC Homes for Individual Residential Care",
      snapshot.hirc,
      "Active HIC credential number in the HCQC facility search",
      "A separate class from RFGs; not assisted living.",
    ),
    state(
      "hcqc-hha",
      "HCQC Home Health agencies",
      snapshot.homeHealth,
      "Active HHA credential number in the HCQC facility search",
      `Branch offices (${snapshot.homeHealthBranch.distinctCredentialNumbers}) are not agencies. A state license is not CMS certification; not added to the ${cms.homeHealth} CMS agencies.`,
    ),
    state(
      "hcqc-hpc",
      "HCQC Hospice programs of care",
      snapshot.hospiceProgram,
      "Active HPC credential number in the HCQC facility search",
      `Facilities for hospice care (${snapshot.hospiceFacility.distinctCredentialNumbers}) are a different license. Not added to the ${cms.hospice} CMS hospices.`,
    ),
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Nevada",
      display: cms.nursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl ?? "CMS",
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Nursing Home CCN with state = NV",
      coverageState: "KNOWN",
      caveat: `CMS certification is not an HCQC license. ${snapshot.crosswalk.cmsNursingHomesBridged} match a state SNF row by exact printed CCN; the counts are not added.`,
    },
  ];
}

export function assertNvIntelligence(
  value: NvPublicSnapshot = NV_PUBLIC_SNAPSHOT,
): NvPublicSnapshot {
  if (value.version !== NV_INTEL_VERSION)
    throw new Error(`Unexpected NV contract ${value.version}`);
  if (value.fingerprint !== NV_PUBLIC_FINGERPRINT) throw new Error("NV fingerprint drifted");
  if (value.publicationPath !== NV_PUBLIC_PATH) throw new Error("path must be /nevada");
  if (value.regulatorMap.current.authority !== "Nevada Health Authority")
    throw new Error("current regulator is the Nevada Health Authority");
  if (value.skilledNursing.distinctCredentialNumbers !== NV_LOCKED.snf)
    throw new Error("SNF drifted");
  if (value.skilledNursingDistinctPart.distinctCredentialNumbers !== NV_LOCKED.sfd)
    throw new Error("SFD drifted");
  if (value.rfg.distinctCredentialNumbers !== NV_LOCKED.rfg) throw new Error("RFG drifted");
  if (value.rfg.assistedLivingEndorsed !== NV_LOCKED.rfgAssistedLiving)
    throw new Error("RFG AL endorsement drifted");
  if (value.rfg.alzheimerEndorsed !== NV_LOCKED.rfgAlzheimer)
    throw new Error("RFG Alzheimer endorsement drifted");
  if (
    value.rfg.everyRfgIsAssistedLiving !== false ||
    value.rfg.assistedLivingIsAnEndorsedSubset !== true
  )
    throw new Error("RFG is not assisted living by default");
  if (value.rfg.assistedLivingEndorsed >= value.rfg.distinctCredentialNumbers)
    throw new Error("assisted living must be a strict subset of RFGs");
  if (value.hirc.distinctCredentialNumbers !== NV_LOCKED.hirc) throw new Error("HIRC drifted");
  if (value.adultDay.distinctCredentialNumbers !== NV_LOCKED.adc) throw new Error("ADC drifted");
  if (value.homeHealth.distinctCredentialNumbers !== NV_LOCKED.hha) throw new Error("HHA drifted");
  if (value.homeHealthBranch.distinctCredentialNumbers !== NV_LOCKED.hbr)
    throw new Error("HBR drifted");
  if (value.hospiceProgram.distinctCredentialNumbers !== NV_LOCKED.hpc)
    throw new Error("HPC drifted");
  if (value.hospiceFacility.distinctCredentialNumbers !== NV_LOCKED.hfs)
    throw new Error("HFS drifted");
  if (value.cmsOverlay.nursingHomes !== NV_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH drifted");
  if (value.cmsOverlay.homeHealth !== NV_LOCKED.cmsHomeHealth) throw new Error("CMS HHA drifted");
  if (value.cmsOverlay.hospice !== NV_LOCKED.cmsHospice) throw new Error("CMS Hospice drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false) throw new Error("do not re-add CMS totals");
  if (value.crosswalk.exactStateToCmsBridges !== NV_LOCKED.exactCmsBridges)
    throw new Error("exact CCN bridges drifted");
  if (value.crosswalk.cmsNursingHomesBridged !== NV_LOCKED.cmsNursingHomesBridged)
    throw new Error("NH bridges drifted");
  if (value.crosswalk.nameOnly !== "UNSAFE") throw new Error("name-only joins stay unsafe");
  if (value.stateSanctions.rows !== NV_LOCKED.stateSanctionRows)
    throw new Error("sanctions drifted");
  if (value.stateSanctions.nameOnlyJoins !== 0) throw new Error("no name-only sanction joins");
  if (value.inspections.findingsCopied !== false)
    throw new Error("inspection findings are not copied");
  if (value.complaints.providerLevelRows !== null || value.complaints.records !== "REQUEST_ONLY")
    throw new Error("complaint records stay request-only");
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
    "combined-nevada-senior-facilities",
    "combined-nevada-senior-beds",
    "name-only-bridge",
  ]) {
    if (value.capabilities.find((row) => row.id === id)?.state !== "UNSUPPORTED")
      throw new Error(`${id} is unsupported`);
  }
  return value;
}
