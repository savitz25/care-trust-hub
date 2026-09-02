import { createHash } from "node:crypto";
import {
  SENIOR_HUB_INTEL_VERSION,
  STATE_NAMES,
  assertSeniorHubIntelligence,
  type HubSourceRow,
  type SeniorNationalIntelligence,
} from "./senior-hub-intelligence";
import { NJ_LOCKED, NJ_PUBLIC_PATH } from "./nj-intelligence";

export const SENIOR_HOME_INTEL_VERSION = "senior-home-intel-v1";
export const SENIOR_HOME_PUBLICATION_VERSION = "intel-002-v1";
export const HOME_SNAPSHOT_CONTRACT = "trusthub-intel-snapshot-v1";

export type HomeStoryType = "BENCHMARK" | "CHANGE" | "GAP";
export type HomeChartType = "composition" | "coverage" | "distribution";
export type CoverageStatus =
  | "strong"
  | "partial"
  | "limited"
  | "unavailable"
  | "not_yet_researched";

export interface HomeTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  unit: "count" | "percent" | "label";
  numerator: number | null;
  denominator: number | null;
  providerClass:
    | "nursing_home"
    | "home_health"
    | "hospice"
    | "ownership_graph"
    | "cross_class"
    | "florida_state"
    | "new_jersey_state";
  definition: string;
  components: Array<{ label: string; value: string; payloadKey: string }>;
  sourceIds: string[];
  officialAsOf: string | null;
  retrievedAt: string | null;
  method: string;
  payloadKey: string;
  limitations: string[];
}

export interface HomeFinding {
  storyId: string;
  storyType: HomeStoryType;
  title: string;
  summary: string;
  chartType: HomeChartType;
  chart: {
    caption: string;
    series: Array<{ label: string; value: number; note?: string }>;
    unit: "count" | "percent";
    max: number;
  };
  whyItMatters: string;
  doesNotMean: string[];
  sourceIds: string[];
  officialAsOf: string | null;
  retrievedAt: string | null;
  payloadKeys: string[];
}

export interface HomeCoverageRow {
  family: string;
  providerClass: string;
  numerator: number | null;
  denominator: number | null;
  display: string;
  status: CoverageStatus;
  method: string;
  limitations: string[];
}

export interface HomeGeoRow {
  state: string;
  name: string;
  nursingHomes: number;
  homeHealth: number;
  hospice: number;
  nhVolumeShare: number;
  enrichment: "florida_state_intelligence" | "new_jersey_state_intelligence" | "cms_directory_only";
  intelligenceHref: string | null;
  searchHref: string;
}

export interface HomeAskItem {
  id: string;
  question: string;
  answer: string;
  href: string;
  hrefLabel: string;
}

export interface SeniorHomeIntel {
  contractVersion: typeof SENIOR_HOME_INTEL_VERSION;
  homepagePublicationVersion: typeof SENIOR_HOME_PUBLICATION_VERSION;
  generatedAt: string;
  sourceFingerprint: string;
  payloadFingerprint: string;
  score: null;
  ranking: null;
  changeModule: {
    status: "UNSUPPORTED";
    reason: string;
  };
  snapshotFoundation: {
    contract: typeof HOME_SNAPSHOT_CONTRACT;
    dataset: string;
    source: string;
    officialAsOf: string | null;
    retrievedAt: string | null;
    sourceHash: string;
    publicationCohort: string;
    projectionHash: string;
    supersedesSnapshot: null;
  };
  stateOfRecord: HomeTraceMetric[];
  findings: HomeFinding[];
  coverage: HomeCoverageRow[];
  gaps: string[];
  verifyDirectly: string[];
  geography: HomeGeoRow[];
  floridaPreview: {
    href: string;
    ahcaIdentities: number;
    regulatoryObservations: number;
    cmsNursingHomes: number;
    cmsHomeHealth: number;
    cmsHospice: number;
    publishedAlfAfch: number;
    note: string;
  };
  newJerseyPreview: {
    href: string;
    ltcIdentities: number;
    acuteIdentities: number;
    cmsNursingHomes: number;
    cmsHomeHealth: number;
    cmsHospice: number;
    note: string;
  };
  askMarket: HomeAskItem[];
  sources: HubSourceRow[];
  limitations: string[];
  doesNotInfer: string[];
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((1000 * part) / whole) / 10;
}

function share(part: number, whole: number): string {
  return `${part.toLocaleString("en-US")} of ${whole.toLocaleString("en-US")} (${pct(part, whole).toFixed(1)}%)`;
}

function sourceDate(
  sources: HubSourceRow[],
  key: string,
): { officialAsOf: string | null; retrievedAt: string | null } {
  const row = sources.find((item) => item.datasetKey === key);
  return {
    officialAsOf: row?.sourceModifiedAt?.slice(0, 10) ?? row?.sourcePeriod ?? null,
    retrievedAt: row?.retrievedAt?.slice(0, 10) ?? null,
  };
}

function latest(dates: Array<string | null>): string | null {
  const values = dates.filter((value): value is string => Boolean(value)).sort();
  return values.at(-1) ?? null;
}

function coverageStatus(part: number, whole: number): CoverageStatus {
  if (whole <= 0) return "unavailable";
  const ratio = part / whole;
  if (ratio >= 0.9) return "strong";
  if (ratio >= 0.5) return "partial";
  if (ratio > 0) return "limited";
  return "unavailable";
}

export function buildSeniorHomeIntel(input: {
  national: SeniorNationalIntelligence;
  floridaIdentities: number;
  floridaRegulatoryObservations: number;
  publishedAlfAfch: number;
}): SeniorHomeIntel {
  const national = assertSeniorHubIntelligence(input.national);
  const nh = national.nursingHome;
  const hh = national.homeHealth;
  const hospice = national.hospice;
  const sources = national.sources;
  const nhDates = sourceDate(sources, "nursing-home-provider-information");
  const hhDates = sourceDate(sources, "home-health-care-agencies");
  const hospiceDates = sourceDate(sources, "hospice-general-information");
  const ownDates = sourceDate(sources, "nursing-home-ownership");
  const chowDates = sourceDate(sources, "skilled-nursing-facility-change-of-ownership");
  const flGeo = national.geography.find((row) => row.state === "FL") ?? {
    state: "FL",
    nursingHomes: 0,
    homeHealth: 0,
    hospice: 0,
  };
  const njGeo = national.geography.find((row) => row.state === "NJ") ?? {
    state: "NJ",
    nursingHomes: 0,
    homeHealth: 0,
    hospice: 0,
  };
  const nhMax = Math.max(...national.geography.map((row) => row.nursingHomes), 1);
  const officialAsOf = latest([
    nhDates.officialAsOf,
    hhDates.officialAsOf,
    hospiceDates.officialAsOf,
  ]);
  const retrievedAt = latest([nhDates.retrievedAt, hhDates.retrievedAt, hospiceDates.retrievedAt]);

  const stateOfRecord: HomeTraceMetric[] = [
    {
      id: "nh-current",
      label: "Current Nursing Homes",
      display: nh.current.toLocaleString("en-US"),
      value: nh.current,
      unit: "count",
      numerator: nh.current,
      denominator: null,
      providerClass: "nursing_home",
      definition:
        "Current CMS Nursing Home Provider Information directory identities. Identity is CMS CCN.",
      components: [
        {
          label: "Current directory",
          value: nh.current.toLocaleString("en-US"),
          payloadKey: "nursingHome.current",
        },
        {
          label: "Known CCNs in research graph",
          value: nh.known.toLocaleString("en-US"),
          payloadKey: "nursingHome.known",
        },
      ],
      sourceIds: ["nursing-home-provider-information"],
      officialAsOf: nhDates.officialAsOf,
      retrievedAt: nhDates.retrievedAt,
      method: "Count of current Nursing Home directory rows in senior-hub-intel-v1.",
      payloadKey: "nursingHome.current",
      limitations: [
        "Known CCNs (${known}) are not added into current. Absence from current is not proof of closure.".replace(
          "${known}",
          nh.known.toLocaleString("en-US"),
        ),
      ],
    },
    {
      id: "hh-current",
      label: "Current Home Health agencies",
      display: hh.current.toLocaleString("en-US"),
      value: hh.current,
      unit: "count",
      numerator: hh.current,
      denominator: null,
      providerClass: "home_health",
      definition:
        "Current CMS Home Health Care Agencies directory identities. Identity is CMS Home Health CCN.",
      components: [
        {
          label: "Current directory",
          value: hh.current.toLocaleString("en-US"),
          payloadKey: "homeHealth.current",
        },
      ],
      sourceIds: ["home-health-care-agencies"],
      officialAsOf: hhDates.officialAsOf,
      retrievedAt: hhDates.retrievedAt,
      method: "Count of current Home Health directory rows in senior-hub-intel-v1.",
      payloadKey: "homeHealth.current",
      limitations: ["An office address is not a verified service area."],
    },
    {
      id: "hospice-current",
      label: "Current Hospice providers (GI)",
      display: hospice.current.toLocaleString("en-US"),
      value: hospice.current,
      unit: "count",
      numerator: hospice.current,
      denominator: null,
      providerClass: "hospice",
      definition:
        "Current CMS Hospice General Information directory identities. Identity is CMS Hospice CCN.",
      components: [
        {
          label: "Current GI directory",
          value: hospice.current.toLocaleString("en-US"),
          payloadKey: "hospice.current",
        },
        {
          label: "Typed hospice identities",
          value: hospice.typed.toLocaleString("en-US"),
          payloadKey: "hospice.typed",
        },
        {
          label: "Quality-file-only identities",
          value: hospice.evidenceOnly.toLocaleString("en-US"),
          payloadKey: "hospice.evidenceOnly",
        },
      ],
      sourceIds: ["hospice-general-information"],
      officialAsOf: hospiceDates.officialAsOf,
      retrievedAt: hospiceDates.retrievedAt,
      method: "GI current count. Typed minus GI equals evidence-only identities.",
      payloadKey: "hospice.current",
      limitations: [
        "Evidence-only identities are not current GI providers and are not proof of closure.",
      ],
    },
    {
      id: "ownership-orgs",
      label: "Canonical organizations",
      display: national.ownership.organizations.toLocaleString("en-US"),
      value: national.ownership.organizations,
      unit: "count",
      numerator: national.ownership.organizations,
      denominator: null,
      providerClass: "ownership_graph",
      definition: "Distinct organizations in the CMS/PECOS ownership graph used by SeniorTrustHub.",
      components: [
        {
          label: "Organizations",
          value: national.ownership.organizations.toLocaleString("en-US"),
          payloadKey: "ownership.organizations",
        },
        {
          label: "UNKNOWN ownership edges",
          value: national.ownership.unknownEdges.toLocaleString("en-US"),
          payloadKey: "ownership.unknownEdges",
        },
      ],
      sourceIds: ["nursing-home-ownership", "skilled-nursing-facility-all-owners"],
      officialAsOf: ownDates.officialAsOf,
      retrievedAt: ownDates.retrievedAt,
      method: "Count of canonical organization nodes in senior-hub-intel-v1.",
      payloadKey: "ownership.organizations",
      limitations: [
        "Organization count is not a provider-class universe and is not a quality finding.",
      ],
    },
    {
      id: "nh-chow",
      label: "Nursing Home CHOW events",
      display: nh.chow.events.toLocaleString("en-US"),
      value: nh.chow.events,
      unit: "count",
      numerator: nh.chow.events,
      denominator: null,
      providerClass: "nursing_home",
      definition: "CMS Skilled Nursing Facility Change of Ownership events in the research graph.",
      components: [
        {
          label: "CHOW events",
          value: nh.chow.events.toLocaleString("en-US"),
          payloadKey: "nursingHome.chow.events",
        },
        {
          label: "Providers with CHOW history",
          value: nh.chow.providersWithHistory.toLocaleString("en-US"),
          payloadKey: "nursingHome.chow.providersWithHistory",
        },
      ],
      sourceIds: ["skilled-nursing-facility-change-of-ownership"],
      officialAsOf: chowDates.officialAsOf,
      retrievedAt: chowDates.retrievedAt,
      method: "Event count from SNF CHOW source family.",
      payloadKey: "nursingHome.chow.events",
      limitations: [
        "A CHOW record is not a sale and is not a quality finding.",
        "CMS does not publish Home Health or Hospice CHOW event files.",
      ],
    },
  ];

  const findings: HomeFinding[] = [
    {
      storyId: "not-one-market",
      storyType: "BENCHMARK",
      title: "Senior care is three federal markets, not one directory",
      summary: `CMS currently lists ${nh.current.toLocaleString("en-US")} Nursing Homes, ${hh.current.toLocaleString("en-US")} Home Health agencies, and ${hospice.current.toLocaleString("en-US")} Hospice providers in separate directories. They use different identifiers and measures.`,
      chartType: "composition",
      chart: {
        caption:
          "Current CMS directory identities by provider class. These are not one population.",
        series: [
          { label: "Nursing Homes", value: nh.current, note: "CMS CCN" },
          { label: "Home Health", value: hh.current, note: "Home Health CCN" },
          { label: "Hospice (GI)", value: hospice.current, note: "Hospice CCN" },
        ],
        unit: "count",
        max: Math.max(nh.current, hh.current, hospice.current),
      },
      whyItMatters:
        "Families often hear “senior care” as one category. Public evidence is assembled by regulated class. Mixing the three totals would invent a market that CMS does not publish.",
      doesNotMean: [
        "That one class is better or safer than another.",
        "That adding the three numbers counts unique companies or unique people.",
        "That Assisted Living is included in these national CMS directories.",
      ],
      sourceIds: [
        "nursing-home-provider-information",
        "home-health-care-agencies",
        "hospice-general-information",
      ],
      officialAsOf,
      retrievedAt,
      payloadKeys: ["nursingHome.current", "homeHealth.current", "hospice.current"],
    },
    {
      storyId: "star-availability-gap",
      storyType: "GAP",
      title: "Published CMS star coverage is not the same in every class",
      summary: `${share(nh.starDistribution.reported, nh.current)} current Nursing Homes have a CMS overall star. ${share(hh.starDistribution.reported, hh.current)} current Home Health agencies have a Quality of Patient Care star. Hospice has no CMS overall star in this directory.`,
      chartType: "coverage",
      chart: {
        caption:
          "Share of the current class directory with a published CMS star of that class’s type.",
        series: [
          {
            label: "Nursing Home overall star",
            value: pct(nh.starDistribution.reported, nh.current),
            note: share(nh.starDistribution.reported, nh.current),
          },
          {
            label: "Home Health Quality of Patient Care star",
            value: pct(hh.starDistribution.reported, hh.current),
            note: share(hh.starDistribution.reported, hh.current),
          },
          {
            label: "Hospice overall star",
            value: 0,
            note: "Not a CMS overall-star program in this directory",
          },
        ],
        unit: "percent",
        max: 100,
      },
      whyItMatters:
        "A missing star is evidence availability, not a zero. Hospice quality uses other CMS families (quality measures and CAHPS), not an overall star.",
      doesNotMean: [
        "That Nursing Homes are higher quality than Home Health or Hospice.",
        "That a missing Home Health star means poor care.",
        "That SeniorTrustHub has scored these classes.",
      ],
      sourceIds: [
        "nursing-home-provider-information",
        "home-health-care-agencies",
        "hospice-general-information",
      ],
      officialAsOf,
      retrievedAt,
      payloadKeys: [
        "nursingHome.starDistribution.reported",
        "homeHealth.starDistribution.reported",
        "hospice.coverage.qualityMeasureProviders",
      ],
    },
    {
      storyId: "ownership-coverage-gap",
      storyType: "GAP",
      title: "Ownership evidence is uneven — and UNKNOWN is not a clean history",
      summary: `CURRENT OWNED_BY evidence is on file for ${share(nh.coverage.ownedByProviders, nh.current)} Nursing Homes, ${share(hh.coverage.ownedByProviders, hh.current)} Home Health agencies, and ${share(hospice.coverage.ownedByProviders, hospice.current)} Hospice providers. The graph also contains ${national.ownership.unknownEdges.toLocaleString("en-US")} UNKNOWN ownership edges. Nursing Home CHOW events exist (${nh.chow.events.toLocaleString("en-US")}); Home Health and Hospice CHOW files do not.`,
      chartType: "coverage",
      chart: {
        caption: "Share of each current directory with resolved CURRENT OWNED_BY evidence.",
        series: [
          {
            label: "Nursing Homes",
            value: pct(nh.coverage.ownedByProviders, nh.current),
            note: share(nh.coverage.ownedByProviders, nh.current),
          },
          {
            label: "Home Health",
            value: pct(hh.coverage.ownedByProviders, hh.current),
            note: share(hh.coverage.ownedByProviders, hh.current),
          },
          {
            label: "Hospice",
            value: pct(hospice.coverage.ownedByProviders, hospice.current),
            note: share(hospice.coverage.ownedByProviders, hospice.current),
          },
        ],
        unit: "percent",
        max: 100,
      },
      whyItMatters:
        "Public ownership files help families see connected organizations. Missing or UNKNOWN links mean the published graph is incomplete, not that a provider is independent or trustworthy.",
      doesNotMean: [
        "That a larger ownership network is better or worse care.",
        "That UNKNOWN is a former owner or a confirmed sale.",
        "That Home Health or Hospice have no owners — CMS does not publish class-equivalent CHOW files.",
      ],
      sourceIds: [
        "nursing-home-ownership",
        "skilled-nursing-facility-all-owners",
        "skilled-nursing-facility-change-of-ownership",
      ],
      officialAsOf: latest([ownDates.officialAsOf, chowDates.officialAsOf]),
      retrievedAt: latest([ownDates.retrievedAt, chowDates.retrievedAt]),
      payloadKeys: [
        "nursingHome.coverage.ownedByProviders",
        "homeHealth.coverage.ownedByProviders",
        "hospice.coverage.ownedByProviders",
        "ownership.unknownEdges",
      ],
    },
  ];

  const coverage: HomeCoverageRow[] = [
    {
      family: "Identity",
      providerClass: "Nursing Homes",
      numerator: nh.current,
      denominator: nh.current,
      display: share(nh.current, nh.current),
      status: "strong",
      method: "Current CMS Nursing Home directory.",
      limitations: ["Directory presence is not a quality finding."],
    },
    {
      family: "Identity",
      providerClass: "Home Health",
      numerator: hh.current,
      denominator: hh.current,
      display: share(hh.current, hh.current),
      status: "strong",
      method: "Current CMS Home Health directory.",
      limitations: [
        "No national Home Health name-search directory is published on this hub yet; CCN research remains.",
      ],
    },
    {
      family: "Identity",
      providerClass: "Hospice",
      numerator: hospice.current,
      denominator: hospice.typed,
      display: `${hospice.current.toLocaleString("en-US")} GI of ${hospice.typed.toLocaleString("en-US")} typed`,
      status: "partial",
      method: "GI current versus typed hospice identities.",
      limitations: ["Typed-only identities are not treated as current GI providers."],
    },
    {
      family: "Consumer / quality evidence",
      providerClass: "Nursing Homes",
      numerator: nh.starDistribution.reported,
      denominator: nh.current,
      display: share(nh.starDistribution.reported, nh.current),
      status: coverageStatus(nh.starDistribution.reported, nh.current),
      method: "CMS overall star reported in Provider Information.",
      limitations: ["Missing is not a zero score."],
    },
    {
      family: "Consumer / quality evidence",
      providerClass: "Home Health",
      numerator: hh.starDistribution.reported,
      denominator: hh.current,
      display: share(hh.starDistribution.reported, hh.current),
      status: coverageStatus(hh.starDistribution.reported, hh.current),
      method: "CMS Quality of Patient Care star among current agencies.",
      limitations: ["HHCAHPS is a separate evidence family from Quality of Patient Care stars."],
    },
    {
      family: "Consumer / quality evidence",
      providerClass: "Hospice",
      numerator: null,
      denominator: hospice.current,
      display: "No CMS overall star. Quality measures and CAHPS are separate families.",
      status: "unavailable",
      method: "Hospice GI has no overall star field in this directory.",
      limitations: ["Do not invent a Hospice overall star from CAHPS or quality measures."],
    },
    {
      family: "Ownership / affiliations",
      providerClass: "Nursing Homes",
      numerator: nh.coverage.ownedByProviders,
      denominator: nh.current,
      display: share(nh.coverage.ownedByProviders, nh.current),
      status: coverageStatus(nh.coverage.ownedByProviders, nh.current),
      method: "Current directory CCNs with resolved CURRENT OWNED_BY evidence.",
      limitations: ["Ownership is not a quality inference."],
    },
    {
      family: "Ownership / affiliations",
      providerClass: "Home Health",
      numerator: hh.coverage.ownedByProviders,
      denominator: hh.current,
      display: share(hh.coverage.ownedByProviders, hh.current),
      status: coverageStatus(hh.coverage.ownedByProviders, hh.current),
      method: "Current directory with resolved CURRENT OWNED_BY evidence.",
      limitations: ["No CMS Home Health CHOW event file."],
    },
    {
      family: "Ownership / affiliations",
      providerClass: "Hospice",
      numerator: hospice.coverage.ownedByProviders,
      denominator: hospice.current,
      display: share(hospice.coverage.ownedByProviders, hospice.current),
      status: coverageStatus(hospice.coverage.ownedByProviders, hospice.current),
      method: "Current GI with resolved CURRENT OWNED_BY evidence.",
      limitations: ["No CMS Hospice CHOW event file."],
    },
    {
      family: "Regulatory history",
      providerClass: "Nursing Homes",
      numerator: national.regulatory.inspection.currentProvidersWithObservation,
      denominator: nh.current,
      display: share(national.regulatory.inspection.currentProvidersWithObservation, nh.current),
      status: coverageStatus(
        national.regulatory.inspection.currentProvidersWithObservation,
        nh.current,
      ),
      method: "Current Nursing Homes with at least one inspection observation.",
      limitations: [
        "Inspection files are Nursing Home datasets, not Home Health or Hospice enforcement files.",
      ],
    },
    {
      family: "Regulatory history",
      providerClass: "Home Health",
      numerator: null,
      denominator: hh.current,
      display: "Not a CMS national inspection/enforcement file on this hub",
      status: "unavailable",
      method: "No Home Health equivalent of NH health-deficiency/penalty files in this payload.",
      limitations: ["Absence of a connected event is not a clean history."],
    },
    {
      family: "Regulatory history",
      providerClass: "Hospice",
      numerator: null,
      denominator: hospice.current,
      display: "Not a CMS national inspection/enforcement file on this hub",
      status: "unavailable",
      method: "No Hospice equivalent of NH health-deficiency/penalty files in this payload.",
      limitations: ["Absence of a connected event is not a clean history."],
    },
    {
      family: "Licensing / registration",
      providerClass: "Florida AHCA (state enrichment)",
      numerator: input.floridaIdentities,
      denominator: null,
      display: `${input.floridaIdentities.toLocaleString("en-US")} current AHCA identities`,
      status: "partial",
      method: "Florida state-license universe on /florida. Not a national licensing denominator.",
      limitations: [
        "State licensing is not a CMS national class.",
        "Most states have no SeniorTrustHub state-intelligence page yet.",
      ],
    },
    {
      family: "Licensing / registration",
      providerClass: "New Jersey NJDOH (state enrichment)",
      numerator: NJ_LOCKED.ltcRows,
      denominator: null,
      display: `${NJ_LOCKED.ltcRows.toLocaleString("en-US")} All_LTC identities; ${NJ_LOCKED.acuteRows.toLocaleString("en-US")} All_Acute identities (not a combined total)`,
      status: "partial",
      method:
        "New Jersey state-license universes on /new-jersey. All_LTC and All_Acute stay separate.",
      limitations: [
        "Do not add All_LTC and All_Acute into one senior-provider denominator.",
        "CMS class overlays are independent and are not exact NJDOH joins in this snapshot.",
      ],
    },
  ];

  const geography: HomeGeoRow[] = national.geography.map((row) => ({
    state: row.state,
    name: STATE_NAMES[row.state] ?? row.state,
    nursingHomes: row.nursingHomes,
    homeHealth: row.homeHealth,
    hospice: row.hospice,
    nhVolumeShare: pct(row.nursingHomes, nhMax),
    enrichment:
      row.state === "FL"
        ? "florida_state_intelligence"
        : row.state === "NJ"
          ? "new_jersey_state_intelligence"
          : "cms_directory_only",
    intelligenceHref: row.state === "FL" ? "/florida" : row.state === "NJ" ? NJ_PUBLIC_PATH : null,
    searchHref: `/search?search=1&state=${row.state}`,
  }));

  const draft: Omit<SeniorHomeIntel, "payloadFingerprint"> = {
    contractVersion: SENIOR_HOME_INTEL_VERSION,
    homepagePublicationVersion: SENIOR_HOME_PUBLICATION_VERSION,
    generatedAt: national.generatedAt,
    sourceFingerprint: national.sourceFingerprint,
    score: null,
    ranking: null,
    changeModule: {
      status: "UNSUPPORTED",
      reason:
        "Dated homepage snapshots are not yet accumulated. Historical comparison will become available as snapshot metadata accumulates. This page does not invent a since-last-update delta.",
    },
    snapshotFoundation: {
      contract: HOME_SNAPSHOT_CONTRACT,
      dataset: "senior-national-intelligence",
      source: SENIOR_HUB_INTEL_VERSION,
      officialAsOf,
      retrievedAt,
      sourceHash: national.sourceFingerprint,
      publicationCohort: SENIOR_HOME_PUBLICATION_VERSION,
      projectionHash: "",
      supersedesSnapshot: null,
    },
    stateOfRecord,
    findings,
    coverage,
    gaps: [
      "Most U.S. states do not yet have a SeniorTrustHub state-intelligence page. Florida and New Jersey currently have state intelligence pages.",
      "CMS stars, staffing, inspections, and penalties are not interchangeable across Nursing Home, Home Health, and Hospice.",
      `${national.ownership.unknownEdges.toLocaleString("en-US")} ownership edges are UNKNOWN. UNKNOWN is not historical ownership.`,
      "Home Health and Hospice have no CMS CHOW event file in this research graph.",
      "Assisted Living is state-regulated and is not a CMS national directory class.",
      "No authoritative nationwide AHCA↔CMS File Number to CCN bridge is published. Internal candidates are not shown here.",
    ],
    verifyDirectly: [
      "Ask the provider who currently owns and operates the location.",
      "Read the latest inspection packet or survey, not only a star summary.",
      "Confirm whether Home Health or Hospice service area includes the county you care about.",
      "If the person needs a state-licensed setting such as assisted living, check that state’s regulator — not only CMS.",
    ],
    geography,
    floridaPreview: {
      href: "/florida",
      ahcaIdentities: input.floridaIdentities,
      regulatoryObservations: input.floridaRegulatoryObservations,
      cmsNursingHomes: flGeo.nursingHomes,
      cmsHomeHealth: flGeo.homeHealth,
      cmsHospice: flGeo.hospice,
      publishedAlfAfch: input.publishedAlfAfch,
      note: "Florida state intelligence is AHCA licensing and regulatory evidence plus CMS class context. It is not a ranking and does not publish HHA, Hospice, or Nursing Home state profile routes.",
    },
    newJerseyPreview: {
      href: NJ_PUBLIC_PATH,
      ltcIdentities: NJ_LOCKED.ltcRows,
      acuteIdentities: NJ_LOCKED.acuteRows,
      cmsNursingHomes: njGeo.nursingHomes,
      cmsHomeHealth: njGeo.homeHealth,
      cmsHospice: njGeo.hospice,
      note: "New Jersey state intelligence is NJDOH licensing, staffing, enforcement, Medicaid listed rates, and PACE evidence plus CMS class context. All_LTC and All_Acute are not added into one senior-provider total.",
    },
    askMarket: [
      {
        id: "nh-in-state",
        question: "How many nursing homes are in my state?",
        answer:
          "Use Explore by place for the current CMS Nursing Home directory count in that jurisdiction. That count is a snapshot, not a quality score.",
        href: "#explore",
        hrefLabel: "Explore by place",
      },
      {
        id: "cms-star",
        question: "What does a CMS star rating measure?",
        answer:
          "CMS stars are CMS ratings for a specific program. Nursing Home overall stars are not Home Health Quality of Patient Care stars, and Hospice has no overall star in this directory.",
        href: "#findings",
        hrefLabel: "What the data says",
      },
      {
        id: "chain-ownership",
        question: "How common is chain ownership?",
        answer: `Ownership is a research graph, not a ranking. ${national.ownership.organizations.toLocaleString("en-US")} canonical organizations appear in the graph. Missing OWNED_BY evidence is incompleteness, not independence.`,
        href: "#findings",
        hrefLabel: "Ownership coverage finding",
      },
      {
        id: "regulatory-review",
        question: "What regulatory history should I review?",
        answer:
          "For Nursing Homes, CMS publishes inspection, deficiency, and penalty families separately. Home Health and Hospice do not have those same national files on this hub.",
        href: "#depth",
        hrefLabel: "Evidence depth",
      },
      {
        id: "no-event",
        question: "What does “no event found” mean?",
        answer:
          "No connected event in SeniorTrustHub is not a clean record. It can mean no published file, a coverage gap, or a period outside the source window.",
        href: "#gaps",
        hrefLabel: "Where the record is incomplete",
      },
      {
        id: "florida-differs",
        question: "How does Florida’s research coverage differ?",
        answer: `Florida currently has a state intelligence page with ${input.floridaIdentities.toLocaleString("en-US")} AHCA identities and ${input.floridaRegulatoryObservations.toLocaleString("en-US")} regulatory observations, plus CMS class counts. New Jersey has a separate NJDOH state intelligence page. Other states on this homepage are CMS directory counts only.`,
        href: "/florida",
        hrefLabel: "Open Florida intelligence",
      },
      {
        id: "new-jersey-differs",
        question: "How does New Jersey’s research coverage differ?",
        answer: `New Jersey currently has a state intelligence page with ${NJ_LOCKED.ltcRows.toLocaleString("en-US")} NJDOH All_LTC identities and ${NJ_LOCKED.acuteRows.toLocaleString("en-US")} All_Acute identities, plus CMS class counts. All_LTC and All_Acute are not one senior-provider total.`,
        href: NJ_PUBLIC_PATH,
        hrefLabel: "Open New Jersey intelligence",
      },
    ],
    sources,
    limitations: national.limitations,
    doesNotInfer: [
      "No event found is not a clean record.",
      "CMS stars are not TrustHub rankings.",
      "Inspection findings describe conditions at points in time.",
      "Ownership can change, and UNKNOWN is not a former owner.",
      "Nursing Home, Home Health, and Hospice evidence is not directly comparable.",
      "State evidence availability differs. Florida and New Jersey are not a national template yet.",
      "Source publication schedules differ. This page is not live data.",
    ],
  };

  const fingerprint = fingerprintHomeIntel(draft);
  return {
    ...draft,
    payloadFingerprint: fingerprint,
    snapshotFoundation: {
      ...draft.snapshotFoundation,
      projectionHash: fingerprint,
    },
  };
}

export function fingerprintHomeIntel(
  value: Omit<SeniorHomeIntel, "payloadFingerprint"> | SeniorHomeIntel,
): string {
  const copy = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  delete copy.payloadFingerprint;
  if (copy.snapshotFoundation && typeof copy.snapshotFoundation === "object") {
    const foundation = copy.snapshotFoundation as Record<string, unknown>;
    delete foundation.projectionHash;
  }
  return createHash("sha256").update(JSON.stringify(copy)).digest("hex");
}

export function assertSeniorHomeIntel(value: SeniorHomeIntel): SeniorHomeIntel {
  if (value.contractVersion !== SENIOR_HOME_INTEL_VERSION) {
    throw new Error(`Unexpected home intel contract ${value.contractVersion}`);
  }
  if (value.score !== null || value.ranking !== null) {
    throw new Error("Home intel must not contain a score or ranking");
  }
  if (value.findings.length !== 3) {
    throw new Error(`Expected 3 findings, got ${value.findings.length}`);
  }
  const types = new Set(value.findings.map((item) => item.storyType));
  if (![...types].every((item) => item === "BENCHMARK" || item === "CHANGE" || item === "GAP")) {
    throw new Error("Findings must be BENCHMARK, CHANGE, or GAP");
  }
  const nh = value.stateOfRecord.find((item) => item.id === "nh-current");
  const hh = value.stateOfRecord.find((item) => item.id === "hh-current");
  const hospice = value.stateOfRecord.find((item) => item.id === "hospice-current");
  if (nh?.value !== 14690 || hh?.value !== 12460 || hospice?.value !== 6669) {
    throw new Error("Class snapshots drifted from locked national directories");
  }
  const geoNh = value.geography.reduce((sum, row) => sum + row.nursingHomes, 0);
  const geoHh = value.geography.reduce((sum, row) => sum + row.homeHealth, 0);
  const geoHospice = value.geography.reduce((sum, row) => sum + row.hospice, 0);
  if (geoNh !== 14690 || geoHh !== 12460 || geoHospice !== 6669) {
    throw new Error("Geography does not reconcile to class directories");
  }
  if (value.changeModule.status !== "UNSUPPORTED") {
    throw new Error("Change module must remain unsupported until dated snapshots exist");
  }
  const expected = fingerprintHomeIntel(value);
  if (value.payloadFingerprint !== expected) {
    throw new Error("Home intel fingerprint mismatch");
  }
  return value;
}

export const HOME_PROHIBITED_LANGUAGE =
  /best nursing homes|worst nursing homes|highest trust|lowest trust|risk ranking|quality ranking|Trust Score|Safety Score|Senior Care Score|composite score|top hospice|best home health|Most Trusted|Recommended|Facility is \d+% researched/i;
