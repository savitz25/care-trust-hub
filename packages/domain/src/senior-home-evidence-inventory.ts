import {
  AZ_ACCEPTED,
  CA_ACCEPTED,
  CO_ACCEPTED,
  IL_ACCEPTED,
  NJ_ACCEPTED,
  NY_ACCEPTED,
  TX_ACCEPTED,
  VA_ACCEPTED,
  WA_ACCEPTED,
} from "./senior-home-accepted-inputs";
import { AZ_PUBLIC_FINGERPRINT, AZ_PUBLIC_PATH } from "./az-intelligence";
import { CO_PUBLIC_FINGERPRINT, CO_PUBLIC_PATH } from "./co-intelligence";
import { VA_PUBLIC_FINGERPRINT, VA_PUBLIC_PATH } from "./va-intelligence";
import { NY_PUBLIC_FINGERPRINT, NY_PUBLIC_PATH } from "./ny-intelligence";
import { IL_PUBLIC_FINGERPRINT, IL_PUBLIC_PATH } from "./il-intelligence";
import { CA_PUBLIC_FINGERPRINT, CA_PUBLIC_PATH } from "./ca-intelligence";
import { NJ_PUBLIC_FINGERPRINT, NJ_PUBLIC_PATH } from "./nj-intelligence";
import type { SeniorNetworkMetricsV1 } from "./senior-network-metrics";
import { TX_PUBLIC_FINGERPRINT, TX_PUBLIC_PATH } from "./tx-intelligence";
import { WA_PUBLIC_FINGERPRINT, WA_PUBLIC_PATH } from "./wa-intelligence";

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
  generatedAt?: string | null;
  retrievedAt?: string | null;
  snapshotAsOf?: string | null;
  definition: string;
  counts: string;
  doesNotCount: string;
  publicationEligibility: "PUBLIC";
  researchDestination: string;
}

export interface SeniorHomepageStateCard {
  sourceClocks?: {
    label: string;
    sourceAsOf: string | null;
    snapshotAsOf: string | null;
    retrievedAt: string | null;
  }[];
  state: "FL" | "NJ" | "CA" | "TX" | "WA" | "AZ" | "CO" | "VA" | "NY" | "IL";
  name: string;
  href: string;
  regulators: string;
  stateClasses: string;
  cmsOverlay: string;
  identityDepth: string;
  regulatoryDepth: string;
  sourceAsOf: string | null;
  snapshotAsOf?: string | null;
  retrievedAt?: string | null;
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
      NJ_ACCEPTED.ltcRows,
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
      NJ_ACCEPTED.enforcementIndexed,
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
      NJ_ACCEPTED.enforcementDownloaded,
      "downloaded document occurrence",
      "NJDOH regulated facilities",
      "New Jersey",
      "NJDOH enforcement corpus",
      NJ_PUBLIC_FINGERPRINT,
      "2026-09-02",
      `${NJ_ACCEPTED.enforcementDownloaded.toLocaleString("en-US")} downloaded document occurrences. The accepted corpus separately reports ${NJ_ACCEPTED.enforcementUniqueHashes.toLocaleString("en-US")} unique content hashes.`,
      "Unique legal actions, violations, or safe provider attachments; downloaded occurrences and deduplicated content hashes are different grains.",
      NJ_PUBLIC_PATH,
    ),
    m(
      "ca-elms",
      "IDENTITY_LICENSURE",
      "California CDPH ELMS locations",
      CA_ACCEPTED.elmsRows,
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
      CA_ACCEPTED.rcfeLicensed,
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
      CA_ACCEPTED.snfExact,
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
      TX_ACCEPTED.hhscNf,
      "HHSC nursing-facility directory row",
      "Nursing Facility",
      "Texas",
      "Texas HHSC",
      TX_PUBLIC_FINGERPRINT,
      TX_ACCEPTED.hhscAsOf,
      "State nursing-facility licensing rows.",
      "CMS Nursing Homes or a combined provider universe.",
      TX_PUBLIC_PATH,
    ),
    m(
      "tx-alf",
      "STATE_CARE_ECOSYSTEM",
      "Texas HHSC assisted-living rows",
      TX_ACCEPTED.hhscAlf,
      "HHSC assisted-living directory row",
      "Assisted Living Facility",
      "Texas",
      "Texas HHSC",
      TX_PUBLIC_FINGERPRINT,
      TX_ACCEPTED.hhscAsOf,
      "Source-native Texas ALF rows.",
      "Nursing facilities or CMS Nursing Homes.",
      TX_PUBLIC_PATH,
    ),
    m(
      "tx-hcssa",
      "STATE_CARE_ECOSYSTEM",
      "Texas HHSC HCSSA rows",
      TX_ACCEPTED.hhscHcssa,
      "HHSC HCSSA directory row",
      "Home and Community Support Services Agency",
      "Texas",
      "Texas HHSC / TULIP",
      TX_PUBLIC_FINGERPRINT,
      TX_ACCEPTED.hhscAsOf,
      "State HCSSA directory rows with source-native service fields.",
      "CMS Home Health agencies, service areas, or unique organizations.",
      TX_PUBLIC_PATH,
    ),
    m(
      "tx-nf-crosswalk",
      "IDENTITY_LICENSURE",
      "Texas exact NF-to-CMS matches",
      TX_ACCEPTED.hhscNfExactCms,
      "exact CCN relationship",
      "Nursing Facility / Nursing Home",
      "Texas",
      "Texas HHSC + CMS",
      TX_PUBLIC_FINGERPRINT,
      TX_ACCEPTED.hhscAsOf,
      "Accepted exact state NF-to-CMS Nursing Home links.",
      "Endorsements; unmatched does not mean unlicensed or uncertified.",
      TX_PUBLIC_PATH,
    ),
    m(
      "wa-residential",
      "STATE_CARE_ECOSYSTEM",
      "Washington current residential GIS rows",
      WA_ACCEPTED.gisCurrent,
      "current DSHS residential GIS location",
      "AFH, ALF, ESF and adjacent source classes",
      "Washington",
      "Washington DSHS RCS",
      WA_PUBLIC_FINGERPRINT,
      WA_ACCEPTED.gisAsOf,
      "Current GIS rows under the artifact's archive-date rule.",
      "CMS providers or proof of license good standing.",
      WA_PUBLIC_PATH,
    ),
    m(
      "wa-afh",
      "STATE_CARE_ECOSYSTEM",
      "Washington Adult Family Homes",
      WA_ACCEPTED.afh,
      "AFH license location",
      "Adult Family Home",
      "Washington",
      "Washington DSHS RCS",
      WA_PUBLIC_FINGERPRINT,
      WA_ACCEPTED.gisAsOf,
      "Source-native AFH locations.",
      "Assisted Living Facilities, Nursing Homes, or CMS providers.",
      WA_PUBLIC_PATH,
    ),
    m(
      "wa-nh-crosswalk",
      "IDENTITY_LICENSURE",
      "Washington exact state NH-to-CMS matches",
      WA_ACCEPTED.stateNhExactCms,
      "exact state nursing-home-to-CMS CCN relationship",
      "Nursing Home",
      "Washington",
      "Washington DSHS + CMS",
      WA_PUBLIC_FINGERPRINT,
      WA_ACCEPTED.gisAsOf,
      "Accepted exact CCN identity relationships.",
      "State-only residential settings or endorsements.",
      WA_PUBLIC_PATH,
    ),
    m(
      "az-gis-all",
      "IDENTITY_LICENSURE",
      "Arizona ADHS all licensed-facility GIS features",
      AZ_ACCEPTED.gisRows,
      "ADHS GIS licensed-facility feature",
      "All ADHS licensed facility classes",
      "Arizona",
      "Arizona ADHS GIS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_ACCEPTED.gisRun,
      "All licensed-facility features in the accepted GIS extract.",
      "Senior facilities; the file includes non-senior classes.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-al-home",
      "STATE_CARE_ECOSYSTEM",
      "Arizona Assisted Living Homes",
      AZ_ACCEPTED.alHome,
      "licensed Assisted Living Home location",
      "Assisted Living Home",
      "Arizona",
      "Arizona ADHS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_ACCEPTED.gisRun,
      "Source-native Assisted Living Home locations.",
      "Assisted Living Centers, Adult Foster Care, or Nursing Homes.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-nh-crosswalk",
      "IDENTITY_LICENSURE",
      "Arizona exact state NH-to-CMS matches",
      AZ_ACCEPTED.nhExact,
      "exact state license-to-CMS CCN relationship",
      "Nursing Home",
      "Arizona",
      "Arizona ADHS + CMS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_ACCEPTED.gisRun,
      "Accepted exact Nursing Home identity relationships.",
      "Endorsements; unmatched does not mean unlicensed or uncertified.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-hha-crosswalk",
      "IDENTITY_LICENSURE",
      "Arizona exact Home Health crosswalks",
      AZ_ACCEPTED.hhaExact,
      "exact state license-to-CMS CCN relationship",
      "Home Health",
      "Arizona",
      "Arizona ADHS + CMS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_ACCEPTED.gisRun,
      "Accepted exact Home Health identity relationships.",
      "All state Home Health rows or endorsements.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "az-hospice-crosswalk",
      "IDENTITY_LICENSURE",
      "Arizona exact Hospice crosswalks",
      AZ_ACCEPTED.hospiceExact,
      "exact state license-to-CMS CCN relationship",
      "Hospice",
      "Arizona",
      "Arizona ADHS + CMS",
      AZ_PUBLIC_FINGERPRINT,
      AZ_ACCEPTED.gisRun,
      "Accepted exact Hospice identity relationships.",
      "All state Hospice rows or endorsements.",
      AZ_PUBLIC_PATH,
    ),
    m(
      "co-cms-nh",
      "FEDERAL_DIRECTORY",
      "Colorado CMS Nursing Home overlay",
      CO_ACCEPTED.cmsNursingHomes,
      "CMS Nursing Home CCN in Colorado geography",
      "Nursing Home",
      "Colorado",
      "CMS Provider Data Catalog",
      CO_PUBLIC_FINGERPRINT,
      CO_ACCEPTED.overlayAsOf,
      "Accepted CMS Nursing Home identities already in the national geography partition.",
      "National CMS totals (already included); Assisted Living Residences; a combined Colorado provider count.",
      CO_PUBLIC_PATH,
    ),
    m(
      "co-cms-hha",
      "FEDERAL_DIRECTORY",
      "Colorado CMS Home Health overlay",
      CO_ACCEPTED.cmsHomeHealth,
      "CMS Home Health CCN in Colorado geography",
      "Home Health",
      "Colorado",
      "CMS Provider Data Catalog",
      CO_PUBLIC_FINGERPRINT,
      CO_ACCEPTED.overlayAsOf,
      "Accepted CMS Home Health identities already in the national geography partition.",
      "National CMS totals (already included); CDPHE Home Care Agencies; a service area.",
      CO_PUBLIC_PATH,
    ),
    m(
      "co-cms-hospice",
      "FEDERAL_DIRECTORY",
      "Colorado CMS Hospice overlay",
      CO_ACCEPTED.cmsHospice,
      "CMS Hospice CCN in Colorado geography",
      "Hospice",
      "Colorado",
      "CMS Provider Data Catalog",
      CO_PUBLIC_FINGERPRINT,
      CO_ACCEPTED.overlayAsOf,
      "Accepted CMS Hospice identities already in the national geography partition.",
      "National CMS totals (already included); Home Health agencies; a combined provider count.",
      CO_PUBLIC_PATH,
    ),
    m(
      "va-dss-alf",
      "IDENTITY_LICENSURE",
      "Virginia DSS Assisted Living Facilities",
      VA_ACCEPTED.alfCount,
      "licensed ALF; VA-DSS-ALF:{licenseId}",
      "Assisted Living",
      "Virginia",
      "Virginia DSS DOLP search JSON",
      VA_PUBLIC_FINGERPRINT,
      null,
      "Complete official licensed ALF search universe.",
      "Nursing homes; Adult Day Centers; occupancy; a combined Virginia senior-provider total.",
      VA_PUBLIC_PATH,
    ),
    m(
      "va-dss-alf-inspections",
      "INSPECTION_DEFICIENCY",
      "Virginia DSS ALF inspection observations",
      VA_ACCEPTED.alfInspections,
      "one DSS inspection row = one observation",
      "Assisted Living",
      "Virginia",
      "Virginia DSS DOLP facility-detail JSON",
      VA_PUBLIC_FINGERPRINT,
      null,
      "Inspection-level observations with complaintNumber and violations Y/N flags.",
      "Substantiated complaints; deficiency counts; a ranking.",
      VA_PUBLIC_PATH,
    ),
    m(
      "va-dss-adc",
      "IDENTITY_LICENSURE",
      "Virginia DSS Adult Day Centers",
      VA_ACCEPTED.adcCount,
      "licensed Adult Day Center",
      "Adult Day",
      "Virginia",
      "Virginia DSS DOLP search JSON",
      VA_PUBLIC_FINGERPRINT,
      null,
      "Complete official licensed Adult Day Center search universe.",
      "Assisted Living Facilities; Nursing Homes; a combined provider total.",
      VA_PUBLIC_PATH,
    ),
    m(
      "ny-acf",
      "IDENTITY_LICENSURE",
      "New York Adult Care Facility identities",
      NY_ACCEPTED.acfFacilities,
      "NYSDOH Facility ID with operating certificate (AH or EHP)",
      "Adult Care",
      "New York",
      "Health Facility General Information",
      NY_PUBLIC_FINGERPRINT,
      NY_ACCEPTED.snapshotAsOf,
      "Adult Home and Enriched Housing Facility IDs with operating certificates.",
      "Nursing homes; a sum of ALR/EALR/SNALR/ALP designations; occupancy.",
      NY_PUBLIC_PATH,
    ),
    m(
      "il-cms-nh",
      "FEDERAL_DIRECTORY",
      "Illinois CMS nursing-home providers",
      IL_ACCEPTED.cmsNursingHomes,
      "CMS Nursing Home CCN in Illinois geography",
      "Nursing Home",
      "Illinois",
      "CMS Provider Information",
      IL_PUBLIC_FINGERPRINT,
      "2026-08-01",
      "Accepted CMS Illinois overlay identities.",
      "IDPH license census, Supportive Living sites, or a combined Illinois provider total.",
      IL_PUBLIC_PATH,
    ),
    m(
      "il-idph-hha",
      "IDENTITY_LICENSURE",
      "Illinois IDPH Home Health licenses",
      IL_ACCEPTED.idphHomeHealth,
      "IDPH Home Health license_number",
      "Home Health Agency (state license)",
      "Illinois",
      "IDPH Open Data p7mg-cnpx",
      IL_PUBLIC_FINGERPRINT,
      "2026-04-28",
      "Current IDPH Home Health license rows.",
      "CMS Home Health CCNs; Home Nursing; Home Services.",
      IL_PUBLIC_PATH,
    ),
    m(
      "il-slp",
      "STATE_CARE_ECOSYSTEM",
      "Illinois HFS Supportive Living operational sites",
      IL_ACCEPTED.slpSites,
      "HFS operational SLP site",
      "Supportive Living Program",
      "Illinois",
      "HFS OperationalSites.pdf",
      IL_PUBLIC_FINGERPRINT,
      "2026-02-06",
      "Official HFS operational site total.",
      "Nursing homes; assisted living; CMS SNFs.",
      IL_PUBLIC_PATH,
    ),
    m(
      "state-pages",
      "PUBLIC_RESEARCH_SURFACES",
      "Published state intelligence pages",
      SENIOR_HOMEPAGE_STATE_CARDS.length,
      "published state intelligence route",
      "Multiple source-native classes",
      "FL, NJ, CA, TX, WA, AZ, CO, VA, NY, IL",
      "SeniorTrustHub accepted state artifacts",
      "Accepted state publication artifacts",
      null,
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
    "co-cms-nh",
    "va-dss-alf",
    "ny-acf",
    "il-cms-nh",
    "il-idph-hha",
    "il-slp",
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
    identityDepth: `${CA_ACCEPTED.snfExact.toLocaleString("en-US")} exact SNF CCN relationships`,
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
    identityDepth: `${TX_ACCEPTED.hhscNfExactCms.toLocaleString("en-US")} exact NF-to-CMS matches`,
    regulatoryDepth: "Partial state enforcement plus federal NH evidence",
    sourceAsOf: TX_ACCEPTED.hhscAsOf,
  },
  {
    state: "WA",
    name: "Washington",
    href: WA_PUBLIC_PATH,
    regulators: "DSHS RCS + CMS",
    stateClasses: `${WA_ACCEPTED.afh.toLocaleString("en-US")} Adult Family Homes / ${WA_ACCEPTED.alf} Assisted Living Facilities / ${WA_ACCEPTED.esf} Enhanced Services Facilities`,
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${WA_ACCEPTED.stateNhCurrent} state Nursing Homes · ${WA_ACCEPTED.cmsNursingHomes} CMS Nursing Homes · ${WA_ACCEPTED.stateNhExactCms} exact matches`,
    regulatoryDepth: "State bulk enforcement not acquired; federal NH evidence remains",
    sourceAsOf: WA_ACCEPTED.gisAsOf,
  },
  {
    state: "AZ",
    name: "Arizona",
    href: AZ_PUBLIC_PATH,
    regulators: "ADHS + CMS",
    stateClasses: `${AZ_ACCEPTED.alHome.toLocaleString("en-US")} Assisted Living Homes · ${AZ_ACCEPTED.alCenter} Assisted Living Centers · ${AZ_ACCEPTED.afc} Adult Foster Care`,
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `Exact joins: NH ${AZ_ACCEPTED.nhExact}, HHA ${AZ_ACCEPTED.hhaExact}, Hospice ${AZ_ACCEPTED.hospiceExact}`,
    regulatoryDepth: "Open-search state evidence; missing bulk is unknown",
    sourceAsOf: AZ_ACCEPTED.gisRun,
  },
  {
    state: "CO",
    name: "Colorado",
    href: CO_PUBLIC_PATH,
    regulators: "CDPHE HFEMSD + CMS",
    stateClasses:
      "CMS Nursing Home / Home Health / Hospice overlays; ALR, HCA, hospice, and NHA as separate state classes without a current bulk roster",
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${CO_ACCEPTED.cmsNursingHomes} CMS Nursing Homes · ${CO_ACCEPTED.cmsHomeHealth} CMS Home Health · ${CO_ACCEPTED.cmsHospice} CMS Hospice · CDPHE search/path`,
    regulatoryDepth:
      "Open-search state inspection/occurrence path; 2017 GIS excluded; missing bulk is unknown",
    sourceAsOf: CO_ACCEPTED.overlayAsOf,
  },
  {
    state: "VA",
    name: "Virginia",
    href: VA_PUBLIC_PATH,
    regulators: "VDSS DOLP + CMS",
    stateClasses: `${VA_ACCEPTED.alfCount.toLocaleString("en-US")} Assisted Living Facilities · ${VA_ACCEPTED.adcCount} Adult Day Centers`,
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${VA_ACCEPTED.alfCount} DSS ALF · ${VA_ACCEPTED.adcCount} Adult Day · ${VA_ACCEPTED.cmsNursingHomes} CMS Nursing Homes`,
    regulatoryDepth:
      "Complete DSS ALF inspection-observation flags; VDH nursing-home portal remains search-only",
    sourceAsOf: VA_ACCEPTED.snapshotAsOf,
  },
  {
    state: "NY",
    name: "New York",
    href: NY_PUBLIC_PATH,
    regulators: "NYSDOH + CMS",
    stateClasses: `${NY_ACCEPTED.acfFacilities.toLocaleString("en-US")} Adult Care Facilities · ${NY_ACCEPTED.nhFacilities} NYSDOH Nursing Home Profile facilities`,
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${NY_ACCEPTED.acfFacilities} ACF · ${NY_ACCEPTED.nhFacilities} state NH · ${NY_ACCEPTED.nhDistinctCcn} exact Profile CCNs · ${NY_ACCEPTED.cmsNursingHomes} CMS Nursing Homes`,
    regulatoryDepth:
      "Nursing Home Profile surveys/citations/fines plus Do Not Refer observations; ACF Health Profiles inspections remain a research path",
    sourceAsOf: NY_ACCEPTED.snapshotAsOf,
  },
  {
    state: "IL",
    name: "Illinois",
    href: IL_PUBLIC_PATH,
    regulators: "IDPH · HFS · CMS",
    stateClasses: `${IL_ACCEPTED.cmsNursingHomes} CMS Nursing Homes · ${IL_ACCEPTED.idphHomeHealth} IDPH Home Health licenses · ${IL_ACCEPTED.slpSites} HFS Supportive Living sites`,
    cmsOverlay: "Nursing Home · Home Health · Hospice",
    identityDepth: `${IL_ACCEPTED.cmsNursingHomes} CMS NH · ${IL_ACCEPTED.idphHomeHealth} IDPH HHA licenses · state and CMS identities remain separate`,
    regulatoryDepth:
      "Current NH/AL license censuses remain LLCS search-only; CMS survey evidence reused on exact CCN",
    sourceAsOf: IL_ACCEPTED.snapshotAsOf,
  },
];
