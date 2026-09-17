import { loadFacilityEvidence, type FacilityEvidenceAnswer } from "./senior-facility-evidence";
import { sourceRating, type CmsRatingMetric } from "@/lib/cms-rating";
import "server-only";
import { getCareDatabasePool } from "./db";
import { CMS_PROVIDER_INFORMATION_SOURCE, CMS_REGULATORY_SOURCES } from "./source-contracts";
import { providerHref } from "./consumer";
import {
  getCurrentAgencySourceClock,
  searchCurrentAgencies,
  countCurrentAgencies,
  type AgencySearchResult,
} from "./agency-search";
import { getProviderByCcn } from "./repository";
import {
  ASK_PAGE_SIZE,
  validateSeniorResearchQuery,
  CLASS_LABEL,
  SENIOR_ASK_CONTRACT,
  type SeniorAskChip,
  type SeniorProviderClass,
  type SeniorResearchQuery,
} from "./senior-ask-contract";
import {
  planSeniorRequest,
  seniorRequestHref,
  type SeniorRequestParams,
} from "./senior-ask-request";
import { validState } from "./senior-location";

const NH_CTE = `
  WITH current_ingest AS (
    SELECT ir.id AS ingest_run_id, sr.id AS source_release_id,
      sr.release_key, sr.source_modified_at, sr.retrieved_at AS source_retrieved_at,
      sd.display_name AS dataset_name, sd.source_organization, sd.official_url
    FROM source_dataset sd
    JOIN source_release sr ON sr.source_dataset_id=sd.id
    JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
    WHERE sd.dataset_key='${CMS_PROVIDER_INFORMATION_SOURCE.datasetKey}'
    ORDER BY sr.source_modified_at DESC NULLS LAST, ir.completed_at DESC
    LIMIT 1
  ), current_snapshots AS (
    SELECT fs.provider_id, pi.identifier_value AS ccn, fs.provider_name, fs.address, fs.city,
      fs.state_code, fs.zip_code, fs.county_name, fs.overall_rating, fs.health_inspection_rating,
      fs.staffing_rating, fs.quality_measure_rating, fs.ownership_type,
      ci.release_key, ci.source_modified_at, ci.source_retrieved_at, ci.dataset_name,
      ci.source_organization, ci.official_url
    FROM current_ingest ci
    JOIN facility_snapshot fs ON fs.source_release_id=ci.source_release_id
      AND fs.ingest_run_id=ci.ingest_run_id
    JOIN provider_identifier pi ON pi.provider_id=fs.provider_id
      AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
  )`;

export type SeniorAskEntity = {
  providerClass: SeniorProviderClass;
  ccn: string;
  providerName: string;
  location: string;
  recordedLocation?: { city: string | null; state: string; county?: string | null };
  statusLabel: string;
  href: string;
  evidence: Array<{
    label: string;
    value: string;
    rating?: { metric: CmsRatingMetric; value: number | null };
  }>;
  whyMatched: string;
  sourceAsOf?: string | null;
  selectionHref?: string;
};

export type SeniorAskResult = {
  contract: typeof SENIOR_ASK_CONTRACT;
  rawQuery: string;
  query: SeniorResearchQuery;
  interpretation: SeniorAskChip[];
  resultType: SeniorResearchQuery["mode"];
  entities: SeniorAskEntity[];
  count?: { n: number; grain: string; denominator?: string };
  buckets?: Array<{ label: string; n: number }>;
  comparison?: Array<{ label: string; n: number }>;
  definition?: { title: string; body: string };
  pagination: { page: number; pageSize: number; hasMore: boolean };
  provenance: {
    sourceRelease?: string;
    sourceFingerprint?: string;
    retrievedAt?: string | null;
    providerClass: string;
    sourceFamily: string;
    officialAsOf: string | null;
    geographyMeaning: string;
    queryGrain: string;
    metric: string | null;
    numerator?: string;
    denominator?: string;
    exclusions: string[];
    identifierMethod: string;
  };
  limitations: string[];
  failClosed?: { reason: string; alternatives: string[] };
  facilityAnswer?: FacilityEvidenceAnswer;
  candidateSelection?: boolean;
  classPreviews?: Array<{
    providerClass: SeniorProviderClass;
    label: string;
    entities: SeniorAskEntity[];
  }>;
};

const CLASS_PREVIEW_LIMIT = 5;

/**
 * TH-DISCOVERY-PARITY-001B: strips a generic corporate/care-setting suffix off a provider-name
 * search so a national brand phrase ("Brookdale Senior Living") can be retried as just its brand
 * name ("Brookdale") once the exact phrase finds nothing -- CMS directories index each facility
 * individually under its own registered name, not a parent brand. Returns undefined when nothing
 * generic was stripped (so an already-bare, already-tried name is never silently re-searched).
 */
const GENERIC_PROVIDER_NAME_SUFFIX =
  /\s+(?:senior living|senior care|healthcare|health care|health system|rehabilitation center|rehabilitation|rehab center|rehab|nursing center|nursing home|nursing facility|care center|assisted living|memory care)$/iu;
function brandPrefixCandidate(name: string): string | undefined {
  let stripped = name.trim();
  let previous: string;
  do {
    previous = stripped;
    stripped = stripped.replace(GENERIC_PROVIDER_NAME_SUFFIX, "").trim();
  } while (stripped !== previous && stripped.length > 0);
  if (!stripped || stripped.length < 3) return undefined;
  if (stripped.toUpperCase() === name.trim().toUpperCase()) return undefined;
  return stripped;
}

/**
 * TH-DISCOVERY-PARITY-001B: a recorded county without an explicit state (e.g. "nursing home
 * Sacramento County") is resolved against the real indexed corpus instead of being rejected
 * outright or silently defaulted to a hardcoded state. Exactly one matching state applies it
 * directly; zero or more than one honestly fails closed instead of ever guessing a wrong state --
 * this is the fix for the "Sacramento County" -> wrong-state (Lancaster, PA) production bug, and it
 * is general across every county name, not keyed to Sacramento specifically.
 */
async function resolveCountyGeography(query: SeniorResearchQuery): Promise<SeniorResearchQuery> {
  const geo = query.geography;
  if (!geo || geo.type !== "county" || geo.state) return query;
  const result = await getCareDatabasePool().query<{ state_code: string }>(
    `${NH_CTE} SELECT DISTINCT state_code FROM current_snapshots
     WHERE county_name ILIKE $1 ESCAPE '\\' ORDER BY state_code`,
    [`%${geo.value.replace(/[\\%_]/g, "\\$&")}%`],
  );
  const states = [...new Set(result.rows.map((r) => r.state_code))];
  if (states.length === 1) {
    return { ...query, geography: { ...geo, state: states[0] } };
  }
  const reason =
    states.length === 0
      ? `No current indexed provider has a recorded address county matching "${geo.value} County." Choose a recorded city and state, or add the state to this county.`
      : `"${geo.value} County" matches more than one state in the current corpus (${states.join(", ")}). Add the state to this county; none was guessed.`;
  return {
    ...query,
    mode: "fail_closed",
    page: 1,
    terminalState: states.length === 0 ? "UNSUPPORTED" : "NEEDS_CLARIFICATION",
    coverageState: states.length === 0 ? "UNSUPPORTED" : "UNKNOWN",
    failReason: reason,
    alternatives: [],
  };
}

// TH-DISCOVERY-RESET-001B: "senior care Florida" (no care-setting word) still needs a choice
// between Nursing Homes / Home Health / Hospice -- those are genuinely separate CMS classes and
// must never be merged into one generic universe. But requiring a second click before showing ANY
// provider is the exact stonewall this ticket eliminates. Reuse the same existing per-class search
// functions that already back the real "nursing homes in Florida" / "hospice near Tampa" PASS
// cases, scoped to the same requested geography, and show a few real rows from each class directly
// under the refinement choices. Each class's own search failing independently (e.g. a genuinely
// unsupported geography) must not block the other two classes' previews.
async function classPreviews(
  query: SeniorResearchQuery,
): Promise<SeniorAskResult["classPreviews"]> {
  const base: SeniorResearchQuery = {
    ...query,
    page: 1,
    identityQuery: undefined,
    qualityFilters: undefined,
    metric: undefined,
    sort: undefined,
  };
  const [nursingHome, homeHealth, hospice] = await Promise.all([
    searchNursingHomes({ ...base, providerClass: "nursing_home" })
      .then((r) => r.rows.slice(0, CLASS_PREVIEW_LIMIT))
      .catch(() => [] as SeniorAskEntity[]),
    searchCurrentAgencies({
      providerClass: "home_health",
      state: query.geography?.type === "state" ? query.geography.value : query.geography?.state,
      city: query.geography?.type === "city" ? query.geography.value : undefined,
      zip: query.geography?.type === "zip" ? query.geography.value : undefined,
      county: query.geography?.type === "county" ? query.geography.value : undefined,
      limit: CLASS_PREVIEW_LIMIT,
      offset: 0,
    })
      .then((rows) =>
        rows.slice(0, CLASS_PREVIEW_LIMIT).map(
          (row): SeniorAskEntity => ({
            providerClass: "home_health",
            ccn: row.ccn,
            providerName: row.providerName,
            recordedLocation: { city: row.city, state: row.state },
            location: [row.city, row.state, row.zipCode].filter(Boolean).join(", "),
            statusLabel: `Current research cohort (CMS ${CLASS_LABEL.home_health} directory)`,
            href: row.href,
            evidence: [],
            whyMatched: `${row.providerName} is a current Home Health agency in the CMS directory${query.geography ? ` with recorded office location ${row.city ?? "city unreported"}, ${row.state}` : ""}. Office location is not a verified service area.`,
          }),
        ),
      )
      .catch(() => [] as SeniorAskEntity[]),
    searchCurrentAgencies({
      providerClass: "hospice",
      state: query.geography?.type === "state" ? query.geography.value : query.geography?.state,
      city: query.geography?.type === "city" ? query.geography.value : undefined,
      zip: query.geography?.type === "zip" ? query.geography.value : undefined,
      county: query.geography?.type === "county" ? query.geography.value : undefined,
      limit: CLASS_PREVIEW_LIMIT,
      offset: 0,
    })
      .then((rows) =>
        rows.slice(0, CLASS_PREVIEW_LIMIT).map(
          (row): SeniorAskEntity => ({
            providerClass: "hospice",
            ccn: row.ccn,
            providerName: row.providerName,
            recordedLocation: { city: row.city, state: row.state },
            location: [row.city, row.state, row.zipCode].filter(Boolean).join(", "),
            statusLabel: `Current research cohort (CMS ${CLASS_LABEL.hospice} directory)`,
            href: row.href,
            evidence: [],
            whyMatched: `${row.providerName} is a current Hospice provider in the CMS directory${query.geography ? ` with recorded office location ${row.city ?? "city unreported"}, ${row.state}` : ""}. Office location is not a verified service area.`,
          }),
        ),
      )
      .catch(() => [] as SeniorAskEntity[]),
  ]);
  return [
    { providerClass: "nursing_home", label: CLASS_LABEL.nursing_home, entities: nursingHome },
    { providerClass: "home_health", label: CLASS_LABEL.home_health, entities: homeHealth },
    { providerClass: "hospice", label: CLASS_LABEL.hospice, entities: hospice },
  ];
}

async function getNursingHomeSourceClock(): Promise<{
  sourceRelease?: string;
  sourceFingerprint?: string;
  retrievedAt?: string | null;
  sourceFamily: string;
  officialAsOf: string | null;
}> {
  const result = await getCareDatabasePool().query<{
    display_name: string;
    source_organization: string;
    release_key?: string;
    content_sha256?: string;
    retrieved_at?: Date | null;
    source_modified_at: Date | null;
  }>(
    `SELECT sd.display_name, sd.source_organization, sr.source_modified_at, sr.release_key, sr.content_sha256, sr.retrieved_at
     FROM source_dataset sd
     JOIN source_release sr ON sr.source_dataset_id=sd.id
     JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
     WHERE sd.dataset_key=$1
     ORDER BY sr.source_modified_at DESC NULLS LAST, ir.completed_at DESC
     LIMIT 1`,
    [CMS_PROVIDER_INFORMATION_SOURCE.datasetKey],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Current nursing-home release unavailable");
  return {
    sourceFamily: row
      ? `${row.display_name} (${row.source_organization})`
      : `${CMS_PROVIDER_INFORMATION_SOURCE.datasetName} (${CMS_PROVIDER_INFORMATION_SOURCE.datasetIdentifier})`,
    officialAsOf: row?.source_modified_at?.toISOString() ?? null,
    sourceRelease: row?.release_key,
    sourceFingerprint: row?.content_sha256,
    retrievedAt: row?.retrieved_at?.toISOString() ?? null,
  };
}

const DEFINITIONS: Record<string, { title: string; body: string }> = {
  overall_star: {
    title: "CMS overall star rating (nursing homes)",
    body: "CMS overall rating summarizes health inspections, staffing, and quality measures inside Medicare’s Five-Star system. It is a CMS-reported rating, not a TrustHub score, recommendation, or “best facility” rank. Overall stars are not staffing stars or inspection stars.",
  },
  staffing_star: {
    title: "CMS staffing star rating (nursing homes)",
    body: "The CMS staffing rating reflects staffing levels used in Medicare’s Five-Star system. It is not hours per resident day, not a TrustHub staffing score, and not interchangeable with the overall rating.",
  },
  chow: {
    title: "CHOW — change of ownership",
    body: "A CHOW record is a CMS skilled-nursing-facility ownership-change event in this research graph. It is not a sale finding and not quality. Comparable Home Health and Hospice CHOW files are not published in this system.",
  },
};

function chips(query: SeniorResearchQuery): SeniorAskChip[] {
  const rows: SeniorAskChip[] = [];
  if (query.providerClass)
    rows.push({ label: "Provider class", value: CLASS_LABEL[query.providerClass] });
  if (query.geography) {
    rows.push({
      label: "Geography",
      value:
        query.geography.type === "county"
          ? `${query.geography.value} County`
          : query.geography.type === "state"
            ? query.geography.value
            : [query.geography.value, query.geography.state].filter(Boolean).join(", "),
    });
  }
  if (query.status) rows.push({ label: "Status", value: "Current research cohort" });
  if (query.qualityFilters?.overallStars) {
    rows.push({ label: "CMS overall stars", value: query.qualityFilters.overallStars.join(", ") });
  }
  if (query.qualityFilters?.staffingStars) {
    rows.push({
      label: "CMS staffing stars",
      value: query.qualityFilters.staffingStars.join(", "),
    });
  }
  if (query.qualityFilters?.inspectionStars) {
    rows.push({
      label: "CMS health-inspection stars",
      value: query.qualityFilters.inspectionStars.join(", "),
    });
  }
  if (query.qualityFilters?.qpcStars) {
    rows.push({
      label: "CMS Quality of Patient Care stars",
      value: query.qualityFilters.qpcStars.join(", "),
    });
  }
  if (query.identifier) rows.push({ label: "CCN", value: query.identifier.value });
  if (query.identityQuery) rows.push({ label: "Provider", value: query.identityQuery });
  if (query.sort)
    rows.push({ label: "Sort", value: query.sort === "name" ? "Provider name" : query.sort });
  if (query.facilityEvidence)
    rows.push({
      label: "Facility evidence requested",
      value: {
        ownership: "Ownership relationships",
        chow: "Changes of ownership",
        penalty: "Penalty/enforcement observations",
        inspection: "Inspection observations",
        deficiency: "Deficiency observations",
      }[query.facilityEvidence],
    });
  else if (query.metric) rows.push({ label: "Evidence", value: query.metric });
  return rows;
}

function nhWhy(
  query: SeniorResearchQuery,
  name: string,
  ccn: string,
  city: string | null,
  state: string,
): string {
  if (query.identityQuery)
    return `${name} is a bounded provider-name match in the current CMS nursing-home directory (CCN ${ccn}). Name similarity is a research match, not proof that similarly named providers are the same identity.`;
  const parts = [
    `${name} matches because it is classified as a current nursing home provider (CMS CCN ${ccn})`,
  ];
  if (query.geography?.type === "city")
    parts.push(`with recorded city ${city ?? "unreported"}, ${state}; this is not a service area`);
  if (query.geography?.type === "state")
    parts.push(`with a recorded ${query.geography.value} address/location state`);
  if (query.geography?.type === "county") {
    parts.push(
      `with a recorded ${query.geography.value} provider location/address county — not a verified service area`,
    );
  }
  if (query.qualityFilters?.overallStars) {
    parts.push(
      `and a CMS-reported overall rating of ${query.qualityFilters.overallStars.join(" or ")} stars`,
    );
  }
  if (query.identifier) return `This provider matches CCN ${query.identifier.value}.`;
  return `${parts.join(" ")}.`;
}

function starEvidence(value: number | null, label: string) {
  const metric: CmsRatingMetric =
    label === "Quality of Patient Care"
      ? "hh_qpc"
      : label === "Staffing"
        ? "nh_staffing"
        : label === "Inspection"
          ? "nh_inspection"
          : "nh_overall";
  const valid = sourceRating(value, metric);
  return {
    value:
      valid === null
        ? `${label}: not available in the current indexed source`
        : `${label}: ${valid}/5 CMS-reported`,
    rating: { metric, value: valid },
  };
}

async function lookupCcn(
  ccn: string,
  requestedClass?: SeniorProviderClass,
): Promise<SeniorAskEntity[]> {
  if (!requestedClass || requestedClass === "nursing_home") await getNursingHomeSourceClock();
  const nh =
    !requestedClass || requestedClass === "nursing_home" ? await getProviderByCcn(ccn) : null;
  if (nh) {
    return [
      {
        providerClass: "nursing_home",
        ccn: nh.ccn,
        providerName: nh.providerName,
        recordedLocation: { city: nh.location.city, state: nh.location.state },
        location: [nh.location.city, nh.location.state, nh.location.zipCode]
          .filter(Boolean)
          .join(", "),
        statusLabel: "Current research cohort (CMS nursing-home directory)",
        href: providerHref(nh),
        evidence: [
          { label: "CMS overall stars", ...starEvidence(nh.ratings.overall, "Overall") },
          { label: "Staffing stars", ...starEvidence(nh.ratings.staffing, "Staffing") },
          {
            label: "Health inspection stars",
            ...starEvidence(nh.ratings.healthInspection, "Inspection"),
          },
        ],
        whyMatched: `This provider matches CCN ${ccn}.`,
      },
    ];
  }
  await Promise.all([
    !requestedClass || requestedClass === "home_health"
      ? getCurrentAgencySourceClock("home_health")
      : Promise.resolve(),
    !requestedClass || requestedClass === "hospice"
      ? getCurrentAgencySourceClock("hospice")
      : Promise.resolve(),
  ]);
  const [hh, hospice] = await Promise.all([
    !requestedClass || requestedClass === "home_health"
      ? searchCurrentAgencies({ providerClass: "home_health", query: ccn, limit: 2, offset: 0 })
      : Promise.resolve([]),
    !requestedClass || requestedClass === "hospice"
      ? searchCurrentAgencies({ providerClass: "hospice", query: ccn, limit: 2, offset: 0 })
      : Promise.resolve([]),
  ]);
  const hit = [...hh, ...hospice].find((row) => row.ccn === ccn);
  if (!hit) return [];
  return [
    {
      providerClass: hit.providerClass,
      ccn: hit.ccn,
      providerName: hit.providerName,
      recordedLocation: { city: hit.city, state: hit.state },
      location: [hit.city, hit.state, hit.zipCode].filter(Boolean).join(", "),
      statusLabel: `Current research cohort (CMS ${CLASS_LABEL[hit.providerClass]} directory)`,
      href: hit.href,
      evidence: [
        {
          label:
            hit.providerClass === "home_health"
              ? "Quality of Patient Care stars"
              : "CMS overall stars",
          rating:
            hit.providerClass === "home_health"
              ? starEvidence(hit.cmsQualityStar, "Quality of Patient Care").rating
              : undefined,
          value:
            hit.providerClass === "home_health"
              ? starEvidence(hit.cmsQualityStar, "Quality of Patient Care").value
              : "Hospice has no overall CMS star rating in this directory",
        },
      ],
      whyMatched: `This provider matches CCN ${ccn} in the ${CLASS_LABEL[hit.providerClass]} directory.`,
    },
  ];
}

function nhFilters(query: SeniorResearchQuery, values: unknown[]) {
  const conditions: string[] = [];
  const p = (v: unknown) => {
    values.push(v);
    return `$${values.length}`;
  };
  if (query.geography?.state) conditions.push(`state_code=${p(query.geography.state)}`);
  if (query.geography?.type === "state") conditions.push(`state_code=${p(query.geography.value)}`);
  if (query.geography?.type === "county") {
    conditions.push(`county_name ILIKE ${p(`%${query.geography.value}%`)} ESCAPE '\\'`);
  }
  if (query.geography?.type === "city") {
    conditions.push(`upper(trim(city))=${p(query.geography.value.toUpperCase())}`);
  }
  if (query.geography?.type === "zip") {
    conditions.push(`zip_code=${p(query.geography.value)}`);
  }
  if (query.identityQuery) {
    conditions.push(
      `provider_name ILIKE ${p(`%${query.identityQuery.replace(/[\\%_]/g, "\\$&")}%`)} ESCAPE '\\'`,
    );
  }
  if (query.qualityFilters?.overallStars?.length) {
    conditions.push(`overall_rating = ANY(${p(query.qualityFilters.overallStars)}::int[])`);
  }
  if (query.qualityFilters?.staffingStars?.length) {
    conditions.push(`staffing_rating = ANY(${p(query.qualityFilters.staffingStars)}::int[])`);
  }
  if (query.qualityFilters?.inspectionStars?.length) {
    conditions.push(
      `health_inspection_rating = ANY(${p(query.qualityFilters.inspectionStars)}::int[])`,
    );
  }
  return { conditions, p };
}

async function searchNursingHomes(query: SeniorResearchQuery): Promise<{
  rows: SeniorAskEntity[];
  hasMore: boolean;
  asOf: string | null;
  clock: Awaited<ReturnType<typeof getNursingHomeSourceClock>>;
}> {
  const clock = await getNursingHomeSourceClock();
  const values: unknown[] = [];
  const { conditions, p } = nhFilters(query, values);
  let extraJoin = "";
  let extraSelect = "";
  if (query.metric === "deficiency_count") {
    extraSelect = ", d.n AS extra_n";
    extraJoin = `LEFT JOIN LATERAL (
      SELECT count(*)::int AS n FROM deficiency_finding df WHERE df.provider_id = cs.provider_id
    ) d ON true`;
  }
  if (query.metric === "penalty") {
    extraSelect = ", d.n AS extra_n";
    extraJoin = `JOIN LATERAL (
      SELECT count(*)::int AS n FROM penalty_enforcement pe WHERE pe.provider_id = cs.provider_id
    ) d ON d.n > 0`;
  }
  if (query.metric === "chow") {
    extraJoin = `JOIN ownership_change_event e ON e.provider_id = cs.provider_id`;
  }
  if (query.metric === "staffing_hprd") {
    extraSelect = ", st.total_nurse_hprd, st.source_quarter";
    extraJoin = `LEFT JOIN LATERAL (
      SELECT total_nurse_hprd, source_quarter FROM pbj_staffing_quarter_summary s
      WHERE s.provider_id = cs.provider_id ORDER BY coverage_end DESC LIMIT 1
    ) st ON true`;
  }
  const exactNameOrder = query.identityQuery
    ? `CASE WHEN upper(provider_name)=upper(${p(query.identityQuery)}) THEN 0 ELSE 1 END, `
    : "";
  const order =
    query.metric === "deficiency_count" || query.metric === "penalty"
      ? "extra_n DESC NULLS LAST, provider_name, ccn"
      : query.metric === "staffing_hprd"
        ? "st.total_nurse_hprd DESC NULLS LAST, provider_name, ccn"
        : query.sort === "overall_desc"
          ? "overall_rating DESC NULLS LAST, provider_name, ccn"
          : query.sort === "staffing_desc"
            ? "staffing_rating DESC NULLS LAST, provider_name, ccn"
            : query.sort === "city"
              ? "city, provider_name, ccn"
              : query.sort === "ccn"
                ? "ccn"
                : "provider_name, ccn";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = p(ASK_PAGE_SIZE + 1);
  const offset = p((query.page - 1) * ASK_PAGE_SIZE);
  const sql = `${NH_CTE}
    SELECT cs.ccn, cs.provider_name, cs.city, cs.state_code, cs.zip_code, cs.county_name,
           cs.overall_rating, cs.staffing_rating, cs.health_inspection_rating, cs.ownership_type,
           cs.release_key, cs.source_modified_at${extraSelect}
    FROM current_snapshots cs
    ${extraJoin}
    ${where}
    ORDER BY ${exactNameOrder}${order}
    LIMIT ${limit} OFFSET ${offset}`;
  const result = await getCareDatabasePool().query<{
    ccn: string;
    provider_name: string;
    city: string | null;
    state_code: string;
    zip_code: string | null;
    county_name: string | null;
    overall_rating: number | null;
    staffing_rating: number | null;
    health_inspection_rating: number | null;
    ownership_type: string | null;
    extra_n?: number | null;
    total_nurse_hprd?: string | null;
    source_quarter?: string | null;
    source_modified_at: Date | null;
  }>(sql, values);
  const hasMore = result.rows.length > ASK_PAGE_SIZE;
  const rows = result.rows.slice(0, ASK_PAGE_SIZE).map((row) => {
    const evidence = [
      { label: "CMS overall stars", ...starEvidence(row.overall_rating, "Overall") },
      { label: "Staffing stars", ...starEvidence(row.staffing_rating, "Staffing") },
      {
        label: "Health inspection stars",
        ...starEvidence(row.health_inspection_rating, "Inspection"),
      },
      {
        label: "Ownership category",
        value: row.ownership_type ?? "Not available in the current indexed source",
      },
    ];
    if (row.extra_n != null) {
      evidence.push({
        label:
          query.metric === "penalty" ? "Indexed penalty events" : "Indexed deficiency findings",
        value: String(row.extra_n),
      });
    }
    if (row.total_nurse_hprd != null) {
      evidence.push({
        label: "Total nurse hours per resident day",
        value: `${Number(row.total_nurse_hprd).toFixed(2)} HPRD (${row.source_quarter ?? "quarter not reported"})`,
      });
    }
    return {
      providerClass: "nursing_home" as const,
      ccn: row.ccn,
      providerName: row.provider_name,
      recordedLocation: { city: row.city, state: row.state_code, county: row.county_name },
      location: [row.city, row.state_code, row.county_name].filter(Boolean).join(", "),
      statusLabel: "Current research cohort (CMS nursing-home directory)",
      href: providerHref({ ccn: row.ccn, providerName: row.provider_name }),
      evidence,
      whyMatched: nhWhy(query, row.provider_name, row.ccn, row.city, row.state_code),
    };
  });
  return {
    rows,
    hasMore,
    clock,
    asOf: result.rows[0]?.source_modified_at?.toISOString() ?? clock.officialAsOf,
  };
}

export async function executeSeniorResearchQuery(raw: string, page = 1): Promise<SeniorAskResult> {
  return executeSeniorRequest({ q: raw, page: String(page) });
}

export async function executeSeniorRequest(input: SeniorRequestParams): Promise<SeniorAskResult> {
  const { query, raw } = planSeniorRequest(input);
  return executeSeniorResearchPlan(query, raw);
}

export async function executeSeniorResearchPlan(
  query: SeniorResearchQuery,
  raw = "Structured specialist execution request",
): Promise<SeniorAskResult> {
  query = validateSeniorResearchQuery(query);
  if (
    query.geography?.type === "county" &&
    !query.geography.state &&
    (query.mode !== "fail_closed" ||
      query.clarification === "provider_class" ||
      query.clarification === "state_care")
  ) {
    try {
      query = await resolveCountyGeography(query);
    } catch {
      return executeSeniorResearchPlanUnsafe(
        {
          ...query,
          mode: "fail_closed",
          page: 1,
          terminalState: "SOURCE_UNAVAILABLE",
          coverageState: "UNKNOWN",
          failReason:
            "SeniorTrustHub could not reach the published research corpus. No provider or evidence conclusion was inferred.",
          alternatives: ["Try the research again later or confirm a provider directly with CMS."],
        },
        raw,
      );
    }
  }
  if (
    query.mode !== "fail_closed" &&
    query.geography &&
    ((query.geography.type === "city" && !query.geography.state) ||
      (query.geography.state && !validState(query.geography.state)) ||
      (query.geography.type === "state" && !validState(query.geography.value)))
  )
    query = {
      ...query,
      mode: "fail_closed",
      terminalState: "NEEDS_CLARIFICATION",
      failReason: "Choose a valid state for this recorded location. It was not broadened.",
      alternatives: [],
    };
  if (query.metric === "ownership_network_size" && query.geography)
    query = {
      ...query,
      mode: "fail_closed",
      terminalState: "UNSUPPORTED",
      failReason:
        "The published ownership-network count does not establish this requested location. Choose provider-location research or explicitly remove the location.",
      alternatives: [],
    };
  try {
    return await executeSeniorResearchPlanUnsafe(query, raw);
  } catch {
    return executeSeniorResearchPlanUnsafe(
      {
        ...query,
        mode: "fail_closed",
        page: 1,
        terminalState: "SOURCE_UNAVAILABLE",
        coverageState: "UNKNOWN",
        failReason:
          "SeniorTrustHub could not reach the published research corpus. No provider or evidence conclusion was inferred.",
        alternatives: ["Try the research again later or confirm a provider directly with CMS."],
      },
      raw,
    );
  }
}

async function executeSeniorResearchPlanUnsafe(
  query: SeniorResearchQuery,
  raw = "Structured specialist execution request",
): Promise<SeniorAskResult> {
  const started = Date.now();
  const interpretation = chips(query);
  const limitations: string[] = [
    "Ask does not invent provider facts. Results come from structured SeniorTrustHub production data.",
    "Missing source evidence is not zero, clean, or good standing.",
    "CMS-reported ratings are not TrustHub recommendations.",
  ];
  const provenanceBase = {
    providerClass: query.providerClass ? CLASS_LABEL[query.providerClass] : "unspecified",
    sourceFamily: "CMS Care Compare / SeniorTrustHub current directory snapshot",
    officialAsOf: null as string | null,
    geographyMeaning: query.geography?.meaning ?? "Not geography-filtered",
    queryGrain: query.mode,
    metric: query.metric ?? null,
    exclusions: [
      "Do not add nursing homes, home health, and hospice.",
      "Provider location/address is not service area unless the dataset says so.",
    ],
    identifierMethod: query.identifier ? "Labeled CMS CCN" : "Not an identifier query",
  };

  if (query.mode === "fail_closed") {
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "fail_closed",
      entities: [],
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: provenanceBase,
      limitations,
      failClosed: {
        reason: query.failReason ?? "Unsupported question.",
        alternatives: query.alternatives ?? [],
      },
      // TH-DISCOVERY-PARITY-001B: an unsupported provider class outside the CMS trio (retirement
      // community, adult day care, elder care, in-home caregiving...) reuses this same
      // "provider_class" clarification + preview path -- see unsupportedSeniorClassLabel() in
      // senior-ask-parse.ts -- so it shows broader, clearly-labeled CMS options instead of a dead
      // end. "assisted living" and "memory care" keep their own dedicated "state_care" clarification
      // and its established, DB-free recovery-link contract; that is unchanged here.
      classPreviews:
        query.clarification === "provider_class" ? await classPreviews(query) : undefined,
    };
  }

  if (query.mode === "definition") {
    const def = DEFINITIONS[query.metric ?? "overall_star"] ?? DEFINITIONS.overall_star;
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "definition",
      entities: [],
      definition: def,
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: { ...provenanceBase, queryGrain: "definition" },
      limitations,
    };
  }

  if (query.facilityEvidence) {
    const task = query.facilityEvidence;
    if (!query.identifier && !query.identityQuery) throw new Error("Facility identity required");
    const candidatePlan: SeniorResearchQuery = {
      ...query,
      facilityEvidence: undefined,
      selectedCcn: undefined,
      metric: undefined,
      mode: query.identifier ? "identifier" : "entity",
      page: 1,
    };
    if (query.identityQuery)
      await Promise.all([
        !query.providerClass || query.providerClass === "nursing_home"
          ? getNursingHomeSourceClock()
          : Promise.resolve(),
        !query.providerClass || query.providerClass === "home_health"
          ? getCurrentAgencySourceClock("home_health")
          : Promise.resolve(),
        !query.providerClass || query.providerClass === "hospice"
          ? getCurrentAgencySourceClock("hospice")
          : Promise.resolve(),
      ]);
    const identity = await executeSeniorResearchPlanUnsafe(candidatePlan, raw);
    query = { ...query, locationRequirement: identity.query.locationRequirement };
    const candidates = identity.entities;
    const exact = candidates.filter(
      (e) => e.providerName.trim().toUpperCase() === query.identityQuery?.trim().toUpperCase(),
    );
    let chosen =
      query.identifier && candidates.length === 1
        ? candidates[0]
        : exact.length === 1 && !identity.pagination.hasMore
          ? exact[0]
          : undefined;
    if (query.selectedCcn) {
      const matches = candidates.filter((e) => e.ccn === query.selectedCcn);
      chosen = matches.length === 1 ? matches[0] : undefined;
      if (!chosen)
        return {
          ...identity,
          query,
          entities: [],
          candidateSelection: false,
          failClosed: {
            reason:
              "That selection is not a unique current candidate for this provider-name and location request. Search and select again.",
            alternatives: [],
          },
        };
    }
    if (!chosen)
      return {
        ...identity,
        query,
        interpretation: chips(query),
        candidateSelection: candidates.length > 0,
        entities: candidates.slice(0, 10).map((e) => ({
          ...e,
          evidence: [],
          selectionHref: seniorRequestHref(raw, query.inputOverrides, {
            selected: e.ccn,
            class: e.providerClass,
          }),
        })),
        limitations: [
          ...identity.limitations,
          "Select a provider before attaching facility-specific evidence. At most 10 candidates are shown; refine the name if needed. Similar names and classes are not merged.",
        ],
      };
    const checked = await lookupCcn(chosen.ccn, chosen.providerClass);
    if (
      checked.length !== 1 ||
      checked[0]!.ccn !== chosen.ccn ||
      checked[0]!.providerName !== chosen.providerName
    )
      throw new Error("Selected provider changed; retry identity resolution");
    const identityClock =
      chosen.providerClass === "nursing_home"
        ? await getNursingHomeSourceClock()
        : await getCurrentAgencySourceClock(chosen.providerClass);
    const facilityAnswer = await loadFacilityEvidence(chosen, task);
    return {
      ...identity,
      query,
      interpretation: chips(query),
      resultType: "evidence",
      entities: [chosen],
      facilityAnswer,
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: {
        ...identity.provenance,
        ...identityClock,
        providerClass: CLASS_LABEL[chosen.providerClass],
        metric: task,
        identifierMethod: query.identifier
          ? "Labeled exact CMS CCN"
          : query.selectedCcn
            ? "Server-revalidated name candidate selection and exact CCN"
            : "Unique exact source provider name and revalidated CCN",
        queryGrain: "One resolved provider; source-native evidence relationships/events",
      },
    };
  }

  if (query.mode === "identifier" && query.identifier) {
    const entities = await lookupCcn(query.identifier.value, query.providerClass);
    if (entities.some((e) => e.ccn !== query.identifier!.value))
      throw new Error("Exact CCN source mismatch");
    if (query.geography) {
      const geo = query.geography;
      const established =
        entities.length > 0 &&
        entities.every(
          (e) =>
            e.recordedLocation &&
            (geo.type === "state"
              ? e.recordedLocation.state === geo.value
              : geo.type === "city"
                ? e.recordedLocation.city?.trim().toUpperCase() === geo.value.toUpperCase() &&
                  e.recordedLocation.state === geo.state
                : false),
        );
      query = {
        ...query,
        locationRequirement: {
          raw: query.locationRequirement?.raw ?? geo.value,
          outcome: established ? "APPLIED" : "CONFLICT",
          reason: established
            ? "The returned identity's recorded location matches."
            : "The identity lookup does not establish the requested location. The identity is shown separately; it is not a geographic match.",
        },
      };
      limitations.push(query.locationRequirement!.reason!);
    }
    const matchedClass = entities[0]?.providerClass;
    const sourceClock = matchedClass
      ? matchedClass === "nursing_home"
        ? await getNursingHomeSourceClock()
        : await getCurrentAgencySourceClock(matchedClass)
      : null;
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "identifier",
      entities,
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: {
        ...provenanceBase,
        ...sourceClock,
        providerClass: matchedClass ? CLASS_LABEL[matchedClass] : provenanceBase.providerClass,
        sourceFamily: sourceClock?.sourceFamily ?? provenanceBase.sourceFamily,
        officialAsOf: sourceClock?.officialAsOf ?? null,
        identifierMethod: "Labeled CMS CCN exact match against current class directories",
      },
      limitations: [
        ...limitations,
        entities.length === 0
          ? "No current indexed provider matched this CCN. That is not proof the number is unused elsewhere."
          : "CCN match is canonical identity for that class directory.",
      ],
    };
  }

  if (query.identityQuery && !query.providerClass) {
    const mapAgencyEntities = (rows: AgencySearchResult[]): SeniorAskEntity[] =>
      rows.map((row) => ({
        providerClass: row.providerClass,
        ccn: row.ccn,
        providerName: row.providerName,
        recordedLocation: { city: row.city, state: row.state },
        location: [row.city, row.state, row.zipCode].filter(Boolean).join(", "),
        statusLabel: `Current research cohort (CMS ${CLASS_LABEL[row.providerClass]} directory)`,
        href: row.href,
        evidence:
          row.providerClass === "home_health"
            ? [
                {
                  label: "Quality of Patient Care stars",
                  ...starEvidence(row.cmsQualityStar, "Quality of Patient Care"),
                },
              ]
            : [
                {
                  label: "Overall CMS stars",
                  value: "Not applicable — hospice has no overall CMS star in this directory",
                },
              ],
        whyMatched: `${row.providerName} is a bounded provider-name match in the current ${CLASS_LABEL[row.providerClass]} directory (CCN ${row.ccn}). Similar names are not merged.`,
      }));
    const identitySearch = async (identityQuery: string) => {
      const [nursing, homeHealth, hospice] = await Promise.all([
        searchNursingHomes({ ...query, identityQuery }),
        searchCurrentAgencies({
          providerClass: "home_health",
          query: identityQuery,
          state: query.geography?.type === "state" ? query.geography.value : query.geography?.state,
          city: query.geography?.type === "city" ? query.geography.value : undefined,
          limit: 8,
          offset: 0,
        }),
        searchCurrentAgencies({
          providerClass: "hospice",
          query: identityQuery,
          state: query.geography?.type === "state" ? query.geography.value : query.geography?.state,
          city: query.geography?.type === "city" ? query.geography.value : undefined,
          limit: 8,
          offset: 0,
        }),
      ]);
      return {
        nursing,
        homeHealth,
        hospice,
        agencyEntities: mapAgencyEntities([...homeHealth, ...hospice]),
      };
    };
    const primary = await identitySearch(query.identityQuery);
    let entities = [...primary.nursing.rows, ...primary.agencyEntities]
      .sort(
        (a, b) =>
          Number(a.providerName.toUpperCase() !== query.identityQuery?.toUpperCase()) -
            Number(b.providerName.toUpperCase() !== query.identityQuery?.toUpperCase()) ||
          a.providerName.localeCompare(b.providerName),
      )
      .slice(0, ASK_PAGE_SIZE);
    let hasMore =
      primary.nursing.hasMore ||
      primary.homeHealth.length >= 8 ||
      primary.hospice.length >= 8 ||
      primary.agencyEntities.length + primary.nursing.rows.length > ASK_PAGE_SIZE;
    let identityLimitations = [
      ...limitations,
      "Name matches are candidates within their displayed class. Exact CCN remains the strongest identity lookup.",
    ];
    let candidateSelection: boolean | undefined;
    // TH-DISCOVERY-PARITY-001B: national senior-living brands (Brookdale, Sunrise, Atria...) are
    // indexed under each individual facility's own registered name (e.g. "Brookdale Boise"), not
    // the parent brand, so an exact-substring match on the full brand phrase legitimately finds
    // nothing. Rather than a bare "no matching record," retry once against the brand's own name
    // with a generic corporate suffix stripped ("Senior Living", "Healthcare"...) and, if that finds
    // real current providers, disclose them as name-fragment candidates -- never as a confirmed
    // brand-wide grouping the data does not actually support.
    if (entities.length === 0) {
      const brand = brandPrefixCandidate(query.identityQuery);
      if (brand) {
        const fallback = await identitySearch(brand);
        const fallbackEntities = [...fallback.nursing.rows, ...fallback.agencyEntities]
          .sort((a, b) => a.providerName.localeCompare(b.providerName))
          .slice(0, 10);
        if (fallbackEntities.length) {
          entities = fallbackEntities;
          hasMore = false;
          candidateSelection = true;
          identityLimitations = [
            ...limitations,
            `No current provider is named exactly "${query.identityQuery}". CMS directories index each facility individually under its own registered name, not a parent brand -- showing current providers whose name contains "${brand}" as name-fragment candidates, not confirmed common ownership or brand affiliation. Enter one facility's exact name, or search by class and location instead.`,
          ];
        }
      }
    }
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "entity",
      entities,
      candidateSelection,
      pagination: {
        page: 1,
        pageSize: ASK_PAGE_SIZE,
        hasMore,
      },
      provenance: {
        ...provenanceBase,
        providerClass: "class-resolved identity search",
        queryGrain: "bounded provider-name match across separate current CMS class directories",
        identifierMethod: "Provider names searched separately by class; no fuzzy identity merge",
      },
      limitations: identityLimitations,
    };
  }

  if (query.providerClass === "home_health" || query.providerClass === "hospice") {
    const [sourceClock, agency] = await Promise.all([
      getCurrentAgencySourceClock(query.providerClass),
      searchCurrentAgencies({
        providerClass: query.providerClass,
        query: query.identityQuery,
        state: query.geography?.type === "state" ? query.geography.value : query.geography?.state,
        city: query.geography?.type === "city" ? query.geography.value : undefined,
        zip: query.geography?.type === "zip" ? query.geography.value : undefined,
        county: query.geography?.type === "county" ? query.geography.value : undefined,
        cmsStar: query.qualityFilters?.qpcStars?.[0],
        qualityAvailable:
          query.metric === "hospice_cahps" || query.metric === "hh_hhcahps" ? true : undefined,
        experienceAvailable:
          query.metric === "hospice_cahps" || query.metric === "hh_hhcahps" ? true : undefined,
        limit: ASK_PAGE_SIZE + 1,
        offset: (query.page - 1) * ASK_PAGE_SIZE,
      }),
    ]);
    const hasMore = agency.length > ASK_PAGE_SIZE;
    const entities: SeniorAskEntity[] = agency.slice(0, ASK_PAGE_SIZE).map((row) => ({
      providerClass: row.providerClass,
      ccn: row.ccn,
      providerName: row.providerName,
      recordedLocation: { city: row.city, state: row.state },
      location: [row.city, row.state, row.zipCode].filter(Boolean).join(", "),
      statusLabel: `Current research cohort (CMS ${CLASS_LABEL[row.providerClass]} directory)`,
      href: row.href,
      evidence:
        row.providerClass === "home_health"
          ? [
              {
                label: "Quality of Patient Care stars",
                ...starEvidence(row.cmsQualityStar, "Quality of Patient Care"),
              },
              {
                label: "HHCAHPS",
                value: row.experienceAvailable
                  ? "Experience measures indexed"
                  : "Not available in the current indexed source",
              },
            ]
          : [
              {
                label: "Overall CMS stars",
                value: "Not applicable — hospice has no overall CMS star in this directory",
              },
              {
                label: "CAHPS",
                value: row.experienceAvailable
                  ? "Hospice CAHPS measures indexed"
                  : "Not available in the current indexed source",
              },
            ],
      whyMatched: `${row.providerName} matches because it is a current ${CLASS_LABEL[row.providerClass].slice(0, -1).toLowerCase()} in the CMS directory${query.geography ? ` with recorded office location ${row.city ?? "city unreported"}, ${row.state}` : ""}. Office location is not a verified service area.`,
    }));
    if (query.mode === "count") {
      const n = await countCurrentAgencies({
        providerClass: query.providerClass,
        query: query.identityQuery,
        state: query.geography?.type === "state" ? query.geography.value : query.geography?.state,
        city: query.geography?.type === "city" ? query.geography.value : undefined,
        zip: query.geography?.type === "zip" ? query.geography.value : undefined,
        county: query.geography?.type === "county" ? query.geography.value : undefined,
        cmsStar: query.qualityFilters?.qpcStars?.[0],
        qualityAvailable:
          query.metric === "hospice_cahps" || query.metric === "hh_hhcahps" ? true : undefined,
        experienceAvailable:
          query.metric === "hospice_cahps" || query.metric === "hh_hhcahps" ? true : undefined,
      });
      return {
        contract: SENIOR_ASK_CONTRACT,
        rawQuery: raw,
        query,
        interpretation,
        resultType: "count",
        entities: [],
        count: {
          n,
          grain: `Current ${CLASS_LABEL[query.providerClass]} directory identities. Not combined with other classes.`,
        },
        pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
        provenance: {
          ...provenanceBase,
          ...sourceClock,
          sourceFamily: sourceClock.sourceFamily,
          officialAsOf: sourceClock.officialAsOf,
        },
        limitations,
      };
    }
    void started;
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "entity",
      entities,
      pagination: { page: query.page, pageSize: ASK_PAGE_SIZE, hasMore },
      provenance: {
        ...provenanceBase,
        ...sourceClock,
        sourceFamily: sourceClock.sourceFamily,
        officialAsOf: sourceClock.officialAsOf,
      },
      limitations,
    };
  }

  if (query.mode === "count" && query.providerClass === "nursing_home") {
    const clock = await getNursingHomeSourceClock();
    const values: unknown[] = [];
    const { conditions } = nhFilters(query, values);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await getCareDatabasePool().query<{ n: string; as_of: Date | null }>(
      `${NH_CTE} SELECT count(*)::text AS n, max(source_modified_at) AS as_of FROM current_snapshots ${where}`,
      values,
    );
    const n = Number(result.rows[0]?.n);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error("Count unavailable");
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "count",
      entities: [],
      count: {
        n,
        grain: "Current CMS nursing-home directory identities in this research cohort.",
        denominator: query.qualityFilters?.overallStars
          ? "Current nursing homes in the geography with a reported overall-star value matching the filter."
          : "Current nursing homes in the selected geography (or national if none).",
      },
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: {
        ...provenanceBase,
        ...clock,
        officialAsOf: result.rows[0]?.as_of?.toISOString() ?? clock.officialAsOf,
        numerator: String(n),
      },
      limitations,
    };
  }

  if (query.mode === "aggregate" && query.providerClass === "nursing_home") {
    const values: unknown[] = [];
    const { conditions } = nhFilters(query, values);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await getCareDatabasePool().query<{ bucket: string; n: string }>(
      `${NH_CTE} SELECT coalesce(overall_rating::text, 'not_reported') AS bucket, count(*)::text AS n
       FROM current_snapshots ${where}
       GROUP BY 1 ORDER BY 1`,
      values,
    );
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "aggregate",
      entities: [],
      buckets: result.rows.map((row) => ({
        label:
          row.bucket === "not_reported"
            ? "Not available in the current indexed source"
            : `${row.bucket} CMS overall stars`,
        n: Number(row.n),
      })),
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: {
        ...provenanceBase,
        queryGrain: "overall_star_distribution",
        denominator:
          "Current nursing homes in the geography. Null ratings are a separate bucket, not zero stars.",
      },
      limitations,
    };
  }

  if (query.mode === "comparison" && query.providerClass === "nursing_home") {
    const countCounty = async (county: string) => {
      const values: unknown[] = [];
      const p = (v: unknown) => {
        values.push(v);
        return `$${values.length}`;
      };
      const result = await getCareDatabasePool().query<{ n: string }>(
        `${NH_CTE} SELECT count(*)::text AS n FROM current_snapshots
         WHERE state_code='FL' AND county_name ILIKE ${p(`%${county}%`)} ESCAPE '\\'`,
        values,
      );
      return Number(result.rows[0]?.n ?? 0);
    };
    const left = query.geography?.value ?? "BROWARD";
    const right = query.compareGeography?.value ?? "PALM BEACH";
    const [a, b] = await Promise.all([countCounty(left), countCounty(right)]);
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "comparison",
      entities: [],
      comparison: [
        { label: `${left} County nursing homes (address county)`, n: a },
        { label: `${right} County nursing homes (address county)`, n: b },
      ],
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: {
        ...provenanceBase,
        queryGrain: "nursing_home_count_by_address_county",
        exclusions: [
          ...provenanceBase.exclusions,
          "Counts are not quality and not service-area coverage.",
        ],
      },
      limitations,
    };
  }

  if (query.metric === "ownership_network_size") {
    const result = await getCareDatabasePool().query<{
      organization_id: string;
      display_name: string;
      current_facility_count: number;
    }>(
      `SELECT organization_id::text, display_name, current_facility_count
       FROM ownership_portfolio
       WHERE publication_eligible
       ORDER BY current_facility_count DESC, display_name
       LIMIT 20`,
    );
    return {
      contract: SENIOR_ASK_CONTRACT,
      rawQuery: raw,
      query,
      interpretation,
      resultType: "evidence",
      entities: result.rows.map((row) => ({
        providerClass: "nursing_home",
        ccn: row.organization_id.slice(0, 8),
        providerName: row.display_name,
        location: "Ownership organization (not a provider)",
        statusLabel: "Published ownership-portfolio snapshot",
        href: `/ownership/${row.organization_id}`,
        evidence: [
          {
            label: "Connected current nursing homes",
            value: String(row.current_facility_count),
          },
        ],
        whyMatched:
          "This organization appears in the published ownership graph ranked by connected current nursing-home count. Network size is not quality. Similar names are not merged.",
      })),
      pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
      provenance: {
        ...provenanceBase,
        sourceFamily: "SeniorTrustHub ownership_portfolio (CMS ownership graph)",
        queryGrain: "connected current nursing-home count",
      },
      limitations: [
        ...limitations,
        "This is network size / connected-provider count, not “best owner” or a national company ranking.",
      ],
    };
  }

  const found = await searchNursingHomes(query);
  void started;
  return {
    contract: SENIOR_ASK_CONTRACT,
    rawQuery: raw,
    query,
    interpretation,
    resultType: "entity",
    entities: found.rows,
    pagination: { page: query.page, pageSize: ASK_PAGE_SIZE, hasMore: found.hasMore },
    provenance: {
      ...provenanceBase,
      ...found.clock,
      officialAsOf: found.asOf,
      sourceFamily: `${CMS_PROVIDER_INFORMATION_SOURCE.datasetName} (${CMS_PROVIDER_INFORMATION_SOURCE.datasetIdentifier})`,
      queryGrain: query.metric ? query.metric : "Current CMS nursing-home directory identities",
      exclusions: [
        ...provenanceBase.exclusions,
        query.metric === "deficiency_count"
          ? `Deficiency count is indexed findings (${CMS_REGULATORY_SOURCES.deficiencies.datasetName}), not severity and not “worst.”`
          : "Quality-based sort only when requested.",
      ],
    },
    limitations,
  };
}

export { interpretSeniorAskQuery } from "./senior-ask-parse";
