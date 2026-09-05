import { AZ_LOCKED, AZ_PUBLIC_FINGERPRINT, AZ_PUBLIC_PATH } from "./az-intelligence";
import { CA_LOCKED, CA_PUBLIC_FINGERPRINT, CA_PUBLIC_PATH } from "./ca-intelligence";
import { NJ_LOCKED, NJ_PUBLIC_FINGERPRINT, NJ_PUBLIC_PATH } from "./nj-intelligence";
import type { SeniorNetworkMetricsV1 } from "./senior-network-metrics";
import { TX_LOCKED, TX_PUBLIC_FINGERPRINT, TX_PUBLIC_PATH } from "./tx-intelligence";
import { WA_LOCKED, WA_PUBLIC_FINGERPRINT, WA_PUBLIC_PATH } from "./wa-intelligence";

export const SENIOR_HOME_EVIDENCE_INVENTORY_VERSION = "sen-home-evidence-inventory-v1";

export type SeniorEvidenceFamily =
  | "IDENTITY_LICENSURE"
  | "FEDERAL_DIRECTORY"
  | "INSPECTION_DEFICIENCY"
  | "ENFORCEMENT_REGULATORY"
  | "STAFFING_OPERATIONS"
  | "QUALITY_EXPERIENCE"
  | "OWNERSHIP_CHANGE"
  | "STATE_CARE_ECOSYSTEM"
  | "PUBLIC_RESEARCH_SURFACES";

export interface SeniorHomepageEvidenceMeasure {
  key: string;
  family: SeniorEvidenceFamily;
  label: string;
  value: number;
  grain: string;
  providerClass: string;
  geography: string;
  sourceSystem: string;
  acceptedArtifact: string;
  sourceAsOf: string | null;
  generatedOrRetrievedAt: string | null;
  definition: string;
  counts: string;
  doesNotCount: string;
  publicationEligibility: "PUBLIC";
  researchDestination: string;
}

export interface SeniorHomepageStateCard {
  state: "FL" | "NJ" | "CA" | "TX" | "WA" | "AZ";
  name: string;
  href: string;
  regulators: string;
  stateClasses: string;
  cmsOverlay: string;
  identityDepth: string;
  regulatoryDepth: string;
  sourceAsOf: string;
}

export const SENIOR_HOMEPAGE_CLASS_SURFACES = [
  "/search?search=1&class=nursing_home",
  "/home-health",
  "/hospice",
  "/assisted-living",
] as const;

function publicNationalMetrics(metrics: SeniorNetworkMetricsV1): SeniorHomepageEvidenceMeasure[] {
  return metrics.metrics
    .filter((metric) => metric.publicationStatus === "PUBLIC" && metric.value !== null)
    .filter((metric) =>
      [
        "current_nursing_homes",
        "current_home_health_agencies",
        "current_hospice_providers",
        "mds_observations",
        "fire_citations",
        "inspection_events",
        "health_deficiencies",
        "enforcement_records",
        "pbj_quarter_summaries",
        "chow_events",
        "hh_quality_observations",
        "hh_hhcahps_observations",
        "hospice_quality_observations",
        "hospice_cahps_observations",
      ].includes(metric.key),
    )
    .map((metric) => ({
      key: `cms-${metric.key}`,
      family: metric.key.startsWith("current_")
        ? "FEDERAL_DIRECTORY"
        : metric.key === "pbj_quarter_summaries"
          ? "STAFFING_OPERATIONS"
          : metric.key === "chow_events"
            ? "OWNERSHIP_CHANGE"
            : metric.key.includes("quality") || metric.key.includes("cahps")
              ? "QUALITY_EXPERIENCE"
              : metric.key === "enforcement_records"
                ? "ENFORCEMENT_REGULATORY"
                : metric.key === "mds_observations"
                  ? "QUALITY_EXPERIENCE"
                  : "INSPECTION_DEFICIENCY",
      label: metric.label,
      value: metric.value as number,
      grain: metric.grain.replaceAll("_", " "),
      providerClass: metric.providerClass.replaceAll("_", " "),
      geography: "United States / CMS directory geography",
      sourceSystem: metric.contributingSourceSystems.join(", "),
      acceptedArtifact: "senior-network-metrics-v1.json",
      sourceAsOf: metric.sourceAsOf,
      generatedOrRetrievedAt: metric.generatedAt,
      definition: metric.description,
      counts: metric.coverage.display,
      doesNotCount: metric.trace.limitations.join(" "),
      publicationEligibility: "PUBLIC" as const,
      researchDestination:
        metric.providerClass === "home_health"
          ? "/home-health"
          : metric.providerClass === "hospice"
            ? "/hospice"
            : "/search?search=1&class=nursing_home",
    }));
}

export function buildSeniorHomepageEvidenceInventory(input: {
  networkMetrics: SeniorNetworkMetricsV1;
  floridaIdentities: number;
  floridaRegulatoryObservations: number;
  floridaSourceAsOf: string;
}): SeniorHomepageEvidenceMeasure[] {
  const state: SeniorHomepageEvidenceMeasure[] = [
    m(
      "fl-ahca-identities",
      "IDENTITY_LICENSURE",
      "Florida AHCA current identities",
      input.floridaIdentities,
      "current AHCA provider identity",
      "Florida state provider classes",
      "Florida",
      "Florida AHCA",
      "florida-intelligence.json",
      input.floridaSourceAsOf,
      "Current identities in the accepted AHCA state snapshot.",
      "Historical providers or a unique corporate-organization count.",
      "/florida",
    ),
    m(
      "fl-regulatory-observations",
      "ENFORCEMENT_REGULATORY",
      "Florida regulatory observations",
      input.floridaRegulatoryObservations,
      "state regulatory observation",
      "Florida state provider classes",
      "Florida",
      "Florida AHCA",
      "florida-intelligence.json",
      input.floridaSourceAsOf,
      "Accepted attributable state regulatory observations.",
      "A count of unsafe providers, criminal convictions, or current conditions.",
      "/florida",
    ),
    m(
      "nj-ltc-identities",
      "IDENTITY_LICENSURE",
      "New Jersey long-term-care identities",
      NJ_LOCKED.ltcRows,
      "NJDOH All_LTC source row",
      "NJDOH long-term care classes",
      "New Jersey",
      "NJDOH",
      NJ_PUBLIC_FINGERPRINT,
      "2026-09-02",
      "State long-term-care facility identity rows.",
      "All_Acute rows, CMS providers, or unique organizations.",
      NJ_PUBLIC_PATH,
    ),
    m(
      "nj-enforcement-indexed",
      "ENFORCEMENT_REGULATORY",
      "NJDOH enforcement occurrences indexed",
      NJ_LOCKED.enforcementIndexed,
      "indexed enforcement occurrence / URL",
      "NJDOH regulated facilities",
      "New Jersey",
      "NJDOH enforcement corpus",
      NJ_PUBLIC_FINGERPRINT,
      "2026-09-02",
      "Official index occurrences retained in the accepted corpus.",
      "Unique actions, downloaded PDFs, or profile-attributable findings.",
      NJ_PUBLIC_PATH,
    ),
    m(
      "nj-enforcement-documents",
      "ENFORCEMENT_REGULATORY",
      "NJDOH enforcement documents downloaded",
      NJ_LOCKED.enforcementDownloaded,
      "downloaded document occurrence",
      "NJDOH regulated facilities",
      "New Jersey",
      "NJDOH enforcement corpus",
      NJ_PUBLIC_FINGERPRINT,
      "2026-09-02",
      "1,144 downloaded document occurrences. The accepted corpus separately reports 1,131 unique content hashes.",
      "Unique legal actions, violations, or safe provider attachments; downloaded occurrences and deduplicated content hashes are different grains.",
      NJ_PUBLIC_PATH,
    ),
    m(
      "ca-elms",
      "IDENTITY_LICENSURE",
      "California CDPH ELMS locations",
      CA_LOCKED.elmsRows,
      "licensed/certified facility location (FACID)",
      "CDPH facility types",
      "California",
      "CDPH ELMS",
      CA_PUBLIC_FINGERPRINT,
      "2026-09-02",
      "Accepted ELMS healthcare-facility location rows.",
      "RCFE rows, CMS providers, or unique corporate organizations.",
      CA_PUBLIC_PATH,
    ),
    m(
      "ca-rcfe",
      "STATE_CARE_ECOSYSTEM",
      "California licensed RCFE rows",
      CA_LOCKED.rcfeLicensed,
      "licensed RCFE / CCRC facility row",
      "Residential Care Facilities for the Elderly",
      "California",
      "CDSS CCLD",
      CA_PUBLIC_FINGERPRINT,
      "2025-05-25",
      "Rows marked LICENSED in the dated accepted RCFE file.",
      "Nursing homes, CMS certification, or a September 2026 live total.",
      CA_PUBLIC_PATH,
    ),
    m(
      "ca-snf-crosswalk",
      "IDENTITY_LICENSURE",
      "California exact SNF CCN crosswalks",
      CA_LOCKED.snfExact,
      "exact state facility-to-CMS CCN relationship",
      "Nursing Home",
      "California",
      "CDPH ELMS + CMS",
      CA_PUBLIC_FINGERPRINT,
      "2026-09-02",
      "Accepted exact CCN identity relationships.",
      "Endorsements, fuzzy matches, or unique organizations.",
      CA_PUBLIC_PATH,
    ),
    m(
      "tx-nf",
      "IDENTITY_LICENSURE",
      "Texas HHSC nursing-facility rows",
      TX_LOCKED.hhscNf,
      "HHSC nursing-facility directory row",
      "Nursing Facility",
      "Texas",
      "Texas HHSC",
      TX_PUBLIC_FINGERPRINT,
      TX_LOCKED.hhscAsOf,
      "State nursing-facility licensing rows.",
      "CMS Nursing Homes or a combined provider universe.",
      TX_PUBLIC_PATH,
    ),
    m(
      "tx-alf",
      "STATE_CARE_ECOSYSTEM",
      "Texas HHSC assisted-living rows",
      TX_LOCKED.hhscAlf,
      "HHSC assisted-living directory row",
      "Assisted Living Facility",
      "Texas",
      "Texas HHSC",
      TX_PUBLIC_FINGERPRINT,
      TX_LOCKED.hhscAsOf,
      "Source-native Texas ALF rows.",
      "Nursing facilities or CMS Nursing Homes.",
      TX_PUBLIC_PATH,
    ),
    m(
      "tx-hcssa",
      "STATE_CARE_ECOSYSTEM",
      "Texas HHSC HCSSA rows",
      TX_LOCKED.hhscHcssa,
      "HHSC HCSSA directory row",
      "Home and Community Support Services Agency",
      "Texas",
      "Texas HHSC / TULIP",
      TX_PUBLIC_FINGERPRINT,
      TX_LOCKED.hhscAsOf,
      "State HCSSA directory rows with source-native service fields.",
      "CMS Home Health agencies, service areas, or unique organizations.",
      TX_PUBLIC_PATH,
    ),
    m(
      "tx-nf-crosswalk",
      "IDENTITY_LICENSURE",
      "Texas exact NF-to-CMS matches",
      TX_LOCKED.hhscNfExactCms,
      "exact CCN relationship",
      "Nursing Facility / Nursing Home",
      "Texas",
      "Texas HHSC + CMS",
      TX_PUBLIC_FINGERPRINT,
      TX_LOCKED.hhscAsOf,
      "Accepted exact state NF-to-CMS Nursing Home links.",
      "Endorsements; unmatched does not mean unlicensed or uncertified.",
      TX_PUBLIC_PATH,
    ),
    m(
      "wa-residential",
      "STATE_CARE_ECOSYSTEM",
      "Washington current residential GIS rows",
      WA_LOCKED.gisCurrent,
      "current DSHS residential GIS location",
      "AFH, ALF, ESF and adjacent source classes",
      "Washington",
      "Washington DSHS RCS",
      WA_PUBLIC_FINGERPRINT,
      WA_LOCKED.gisAsOf,
      "Current GIS rows under the artifact's archive-date rule.",
      "CMS providers or proof of license good standing.",
      WA_PUBLIC_PATH,
    ),
    m(
      "wa-afh",
      "STATE_CARE_ECOSYSTEM",
      "Washington Adult Family Homes",
      WA_LOCKED.afh,
      "AFH license location",
      "Adult Family Home",
      "Washington",
      "Washington DSHS RCS",
      WA_PUBLIC_FINGERPRINT,
      WA_LOCKED.gisAsOf,
      "Source-native AFH locations.",
      "Assisted Living Facilities, Nursing Homes, or CMS providers.",
      WA_PUBLIC_PATH,
    ),
    m(
      "wa-nh-crosswalk",
      "IDENTITY_LICENSURE",
      "Washington exact state NH-to-CMS matches",
      WA_LOCKED.stateNhExactCms,
      "exact state nursing-home-to-CMS CCN relationship",
      "Nursing Home",
      "Washington",
      "Washington DSHS + CMS",
      WA_PUBLIC_FINGERPRINT,
      WA_LOCKED.gisAsOf,
      "Accepted exact CCN identity relationships.",
      "State-only residential settings or endorsements.",
      WA_PUBLIC_PATH,
    ),
    m(
      "az-gis-all",
      "IDENTITY_LICENSURE",
      "Arizona ADHS all licensed-facility GIS features",
      AZ_LOCKED.gisRows,
      "ADHS GIS licensed-facility feature",
      "All ADHS licensed facility classes",
      "Arizona",
      "Arizona ADHS GIS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_LOCKED.gisRun,
      "All licensed-facility features in the accepted GIS extract.",
      "Senior facilities; the file includes non-senior classes.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-al-home",
      "STATE_CARE_ECOSYSTEM",
      "Arizona Assisted Living Homes",
      AZ_LOCKED.alHome,
      "licensed Assisted Living Home location",
      "Assisted Living Home",
      "Arizona",
      "Arizona ADHS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_LOCKED.gisRun,
      "Source-native Assisted Living Home locations.",
      "Assisted Living Centers, Adult Foster Care, or Nursing Homes.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-nh-crosswalk",
      "IDENTITY_LICENSURE",
      "Arizona exact state NH-to-CMS matches",
      AZ_LOCKED.nhExact,
      "exact state license-to-CMS CCN relationship",
      "Nursing Home",
      "Arizona",
      "Arizona ADHS + CMS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_LOCKED.gisRun,
      "Accepted exact Nursing Home identity relationships.",
      "Endorsements; unmatched does not mean unlicensed or uncertified.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-hha-crosswalk",
      "IDENTITY_LICENSURE",
      "Arizona exact Home Health crosswalks",
      AZ_LOCKED.hhaExact,
      "exact state license-to-CMS CCN relationship",
      "Home Health",
      "Arizona",
      "Arizona ADHS + CMS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_LOCKED.gisRun,
      "Accepted exact Home Health identity relationships.",
      "All state Home Health rows or endorsements.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-hospice-crosswalk",
      "IDENTITY_LICENSURE",
      "Arizona exact Hospice crosswalks",
      AZ_LOCKED.hospiceExact,
      "exact state license-to-CMS CCN relationship",
      "Hospice",
      "Arizona",
      "Arizona ADHS + CMS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_LOCKED.gisRun,
      "Accepted exact Hospice identity relationships.",
      "All state Hospice rows or endorsements.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "state-pages",
      "PUBLIC_RESEARCH_SURFACES",
      "Completed state intelligence pages",
      SENIOR_HOMEPAGE_STATE_CARDS.length,
      "published state intelligence route",
      "Multiple source-native classes",
      "FL, NJ, CA, TX, WA, AZ",
      "SeniorTrustHub accepted state artifacts",
      "six accepted state snapshots",
      "2026-09-04",
      "Live state research destinations backed by accepted artifacts.",
      "A national template, ranking, or claim of identical state coverage.",
      "#state-intelligence",
    ),
    m(
      "class-pages",
      "PUBLIC_RESEARCH_SURFACES",
      "Provider-class research surfaces",
      SENIOR_HOMEPAGE_CLASS_SURFACES.length,
      "published class route or class-filtered search surface",
      "Nursing Home, Home Health, Hospice, Assisted Living",
      "United States / class-dependent",
      "SeniorTrustHub",
      "production route manifest",
      null,
      "Separate public class research surfaces: Nursing Home search plus Home Health, Hospice, and state-regulated Assisted Living routes.",
      "Four equivalent national regulatory universes; Assisted Living is state-regulated.",
      "#provider-classes",
    ),
  ];
  const result = [...publicNationalMetrics(input.networkMetrics), ...state];
  assertSeniorHomepageEvidenceInventory(result);
  return result;
}

function m(
  key: string,
  family: SeniorEvidenceFamily,
  label: string,
  value: number,
  grain: string,
  providerClass: string,
  geography: string,
  sourceSystem: string,
  acceptedArtifact: string,
  sourceAsOf: string | null,
  counts: string,
  doesNotCount: string,
  researchDestination: string,
): SeniorHomepageEvidenceMeasure {
  return {
    key,
    family,
    label,
    value,
    grain,
    providerClass,
    geography,
    sourceSystem,
    acceptedArtifact,
    sourceAsOf,
    generatedOrRetrievedAt: null,
    definition: counts,
    counts,
    doesNotCount,
    publicationEligibility: "PUBLIC",
    researchDestination,
  };
}

export function assertSeniorHomepageEvidenceInventory(rows: SeniorHomepageEvidenceMeasure[]) {
  if (rows.length < 30 || new Set(rows.map((row) => row.key)).size !== rows.length)
    throw new Error("Senior homepage inventory is incomplete or has duplicate keys");
  if (rows.some((row) => row.publicationEligibility !== "PUBLIC" || row.value < 0))
    throw new Error("Homepage inventory contains an ineligible measure");
  if (rows.some((row) => /combined|grand total/i.test(row.key)))
    throw new Error("Homepage inventory must not collapse incompatible grains");
  for (const key of [
    "nj-enforcement-indexed",
    "tx-hcssa",
    "wa-afh",
    "az-gis-all",
    "fl-regulatory-observations",
    "ca-rcfe",
  ])
    if (!rows.some((row) => row.key === key)) throw new Error(`Missing homepage evidence ${key}`);
  return rows;
}

export const SENIOR_HOMEPAGE_STATE_CARDS: SeniorHomepageStateCard[] = [
  {
    state: "FL",
    name: "Florida",
    href: "/florida",
    regulators: "AHCA + CMS",
    stateClasses: "Assisted Living, Adult Family Care Home, state NH/HHA/Hospice",
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: "AHCA identities with class-specific CMS context",
    regulatoryDepth: "State regulatory observations plus federal evidence",
    sourceAsOf: "2026-08-27",
  },
  {
    state: "NJ",
    name: "New Jersey",
    href: NJ_PUBLIC_PATH,
    regulators: "NJDOH + CMS",
    stateClasses: "Long-term care, acute/program classes, PACE",
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: "State facility IDs; conservative class-specific crosswalks",
    regulatoryDepth: "Indexed corpus; only safe identity attachments publish",
    sourceAsOf: "2026-09-02",
  },
  {
    state: "CA",
    name: "California",
    href: CA_PUBLIC_PATH,
    regulators: "CDPH · CDSS CCLD · HCAI · CMS",
    stateClasses: "ELMS facility types, RCFE, HCO",
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${CA_LOCKED.snfExact.toLocaleString("en-US")} exact SNF CCN relationships`,
    regulatoryDepth: "Source-native status; structured statewide enforcement not acquired",
    sourceAsOf: "2026-09-02 / RCFE 2025-05-25",
  },
  {
    state: "TX",
    name: "Texas",
    href: TX_PUBLIC_PATH,
    regulators: "HHSC · TULIP · CMS",
    stateClasses: "Nursing Facility, ALF, HCSSA",
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${TX_LOCKED.hhscNfExactCms.toLocaleString("en-US")} exact NF-to-CMS matches`,
    regulatoryDepth: "Partial state enforcement plus federal NH evidence",
    sourceAsOf: TX_LOCKED.hhscAsOf,
  },
  {
    state: "WA",
    name: "Washington",
    href: WA_PUBLIC_PATH,
    regulators: "DSHS RCS + CMS",
    stateClasses:
      "6,179 Adult Family Homes · 557 Assisted Living Facilities · 16 Enhanced Services Facilities",
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${WA_LOCKED.stateNhCurrent} state Nursing Homes · ${WA_LOCKED.cmsNursingHomes} CMS Nursing Homes · ${WA_LOCKED.stateNhExactCms} exact matches`,
    regulatoryDepth: "State bulk enforcement not acquired; federal NH evidence remains",
    sourceAsOf: WA_LOCKED.gisAsOf,
  },
  {
    state: "AZ",
    name: "Arizona",
    href: AZ_PUBLIC_PATH,
    regulators: "ADHS + CMS",
    stateClasses: `${AZ_LOCKED.alHome.toLocaleString("en-US")} Assisted Living Homes · ${AZ_LOCKED.alCenter} Assisted Living Centers · ${AZ_LOCKED.afc} Adult Foster Care`,
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `Exact joins: NH ${AZ_LOCKED.nhExact}, HHA ${AZ_LOCKED.hhaExact}, Hospice ${AZ_LOCKED.hospiceExact}`,
    regulatoryDepth: "Open-search state evidence; missing bulk is unknown",
    sourceAsOf: AZ_LOCKED.gisRun,
  },
];
