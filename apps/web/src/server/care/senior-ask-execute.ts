import "server-only";
import { getCareDatabasePool } from "./db";
import { CMS_PROVIDER_INFORMATION_SOURCE, CMS_REGULATORY_SOURCES } from "./source-contracts";
import { providerHref } from "./consumer";
import { getCurrentAgencySourceClock, searchCurrentAgencies } from "./agency-search";
import { getProviderByCcn } from "./repository";
import {
  ASK_PAGE_SIZE,
  CLASS_LABEL,
  SENIOR_ASK_CONTRACT,
  type SeniorAskChip,
  type SeniorProviderClass,
  type SeniorResearchQuery,
} from "./senior-ask-contract";
import { interpretSeniorAskQuery } from "./senior-ask-parse";

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
  statusLabel: string;
  href: string;
  evidence: Array<{ label: string; value: string }>;
  whyMatched: string;
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
};

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
            : query.geography.value,
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
  if (query.sort)
    rows.push({ label: "Sort", value: query.sort === "name" ? "Provider name" : query.sort });
  if (query.metric) rows.push({ label: "Evidence", value: query.metric });
  return rows;
}

function nhWhy(query: SeniorResearchQuery, name: string, ccn: string): string {
  const parts = [
    `${name} matches because it is classified as a current nursing home provider (CMS CCN ${ccn})`,
  ];
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

function starText(value: number | null, label: string): string {
  return value == null
    ? `${label}: not available in the current indexed source`
    : `${label}: ${value}/5 CMS-reported`;
}

async function lookupCcn(ccn: string): Promise<SeniorAskEntity[]> {
  const nh = await getProviderByCcn(ccn);
  if (nh) {
    return [
      {
        providerClass: "nursing_home",
        ccn: nh.ccn,
        providerName: nh.providerName,
        location: [nh.location.city, nh.location.state, nh.location.zipCode]
          .filter(Boolean)
          .join(", "),
        statusLabel: "Current research cohort (CMS nursing-home directory)",
        href: providerHref(nh),
        evidence: [
          { label: "CMS overall stars", value: starText(nh.ratings.overall, "Overall") },
          { label: "Staffing stars", value: starText(nh.ratings.staffing, "Staffing") },
          {
            label: "Health inspection stars",
            value: starText(nh.ratings.healthInspection, "Inspection"),
          },
        ],
        whyMatched: `This provider matches CCN ${ccn}.`,
      },
    ];
  }
  const [hh, hospice] = await Promise.all([
    searchCurrentAgencies({ providerClass: "home_health", query: ccn, limit: 2, offset: 0 }),
    searchCurrentAgencies({ providerClass: "hospice", query: ccn, limit: 2, offset: 0 }),
  ]);
  const hit = hh[0] ?? hospice[0];
  if (!hit) return [];
  return [
    {
      providerClass: hit.providerClass,
      ccn: hit.ccn,
      providerName: hit.providerName,
      location: [hit.city, hit.state, hit.zipCode].filter(Boolean).join(", "),
      statusLabel: `Current research cohort (CMS ${CLASS_LABEL[hit.providerClass]} directory)`,
      href: hit.href,
      evidence: [
        {
          label:
            hit.providerClass === "home_health"
              ? "Quality of Patient Care stars"
              : "CMS overall stars",
          value:
            hit.providerClass === "home_health"
              ? starText(hit.cmsQualityStar, "Quality of Patient Care")
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
  if (query.geography?.type === "state") conditions.push(`state_code=${p(query.geography.value)}`);
  if (query.geography?.type === "county") {
    conditions.push(`county_name ILIKE ${p(`%${query.geography.value}%`)} ESCAPE '\\'`);
  }
  if (query.geography?.type === "city") {
    conditions.push(`city ILIKE ${p(query.geography.value)} ESCAPE '\\'`);
  }
  if (query.geography?.type === "zip") {
    conditions.push(`zip_code=${p(query.geography.value)}`);
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

async function searchNursingHomes(
  query: SeniorResearchQuery,
): Promise<{ rows: SeniorAskEntity[]; hasMore: boolean; asOf: string | null }> {
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
    ORDER BY ${order}
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
      { label: "CMS overall stars", value: starText(row.overall_rating, "Overall") },
      { label: "Staffing stars", value: starText(row.staffing_rating, "Staffing") },
      {
        label: "Health inspection stars",
        value: starText(row.health_inspection_rating, "Inspection"),
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
      location: [row.city, row.state_code, row.county_name].filter(Boolean).join(", "),
      statusLabel: "Current research cohort (CMS nursing-home directory)",
      href: providerHref({ ccn: row.ccn, providerName: row.provider_name }),
      evidence,
      whyMatched: nhWhy(query, row.provider_name, row.ccn),
    };
  });
  return { rows, hasMore, asOf: result.rows[0]?.source_modified_at?.toISOString() ?? null };
}

export async function executeSeniorResearchQuery(raw: string, page = 1): Promise<SeniorAskResult> {
  const query = interpretSeniorAskQuery(raw, page);
  return executeSeniorResearchPlan(query, raw);
}

export async function executeSeniorResearchPlan(
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

  if (query.mode === "identifier" && query.identifier) {
    const entities = await lookupCcn(query.identifier.value);
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
        identifierMethod: "Labeled CMS CCN exact match against current class directories",
        officialAsOf: null,
      },
      limitations: [
        ...limitations,
        entities.length === 0
          ? "No current indexed provider matched this CCN. That is not proof the number is unused elsewhere."
          : "CCN match is canonical identity for that class directory.",
      ],
    };
  }

  if (query.providerClass === "hospice" && query.geography?.type === "county") {
    const { hospiceHref } = await import("./consumer");
    const [sourceClock, result] = await Promise.all([
      getCurrentAgencySourceClock("hospice"),
      getCareDatabasePool().query<{
        cms_ccn: string;
        provider_name: string;
        city: string | null;
        state_code: string;
        zip_code: string | null;
        county_name: string | null;
      }>(
        `WITH current_directory AS (
         SELECT DISTINCT ON (cms_ccn)
           cms_ccn, provider_name, city, state_code, zip_code, county_name
         FROM hospice_snapshot
         ORDER BY cms_ccn, id DESC
       )
       SELECT cms_ccn, provider_name, city, state_code, zip_code, county_name
       FROM current_directory
       WHERE county_name ILIKE $1 ESCAPE '\\'
       ORDER BY provider_name, cms_ccn
       LIMIT $2 OFFSET $3`,
        [`%${query.geography.value}%`, ASK_PAGE_SIZE + 1, (query.page - 1) * ASK_PAGE_SIZE],
      ),
    ]);
    if (query.mode === "count") {
      const counted = await getCareDatabasePool().query<{ n: string }>(
        `SELECT count(DISTINCT cms_ccn)::text AS n FROM hospice_snapshot WHERE county_name ILIKE $1 ESCAPE '\\'`,
        [`%${query.geography.value}%`],
      );
      return {
        contract: SENIOR_ASK_CONTRACT,
        rawQuery: raw,
        query,
        interpretation,
        resultType: "count",
        entities: [],
        count: {
          n: Number(counted.rows[0]?.n ?? 0),
          grain:
            "Current hospice directory identities with recorded office county matching the filter. Not service area.",
        },
        pagination: { page: 1, pageSize: ASK_PAGE_SIZE, hasMore: false },
        provenance: {
          ...provenanceBase,
          sourceFamily: sourceClock.sourceFamily,
          officialAsOf: sourceClock.officialAsOf,
          geographyMeaning: query.geography.meaning,
          queryGrain: "hospice office/address county",
        },
        limitations,
      };
    }
    const hasMore = result.rows.length > ASK_PAGE_SIZE;
    const entities: SeniorAskEntity[] = result.rows.slice(0, ASK_PAGE_SIZE).map((row) => ({
      providerClass: "hospice",
      ccn: row.cms_ccn,
      providerName: row.provider_name,
      location: [row.city, row.state_code, row.county_name].filter(Boolean).join(", "),
      statusLabel: "Current research cohort (CMS Hospice directory)",
      href: hospiceHref(row.cms_ccn, row.provider_name),
      evidence: [
        {
          label: "Overall CMS stars",
          value: "Not applicable — hospice has no overall CMS star in this directory",
        },
      ],
      whyMatched: `${row.provider_name} matches because it is a current hospice provider with a recorded ${query.geography?.value} office county on the CMS hospice snapshot. Office county is not a verified service area.`,
    }));
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
        sourceFamily: sourceClock.sourceFamily,
        officialAsOf: sourceClock.officialAsOf,
        geographyMeaning: query.geography.meaning,
        queryGrain: "hospice office/address county",
      },
      limitations,
    };
  }

  if (query.providerClass === "home_health" || query.providerClass === "hospice") {
    const [sourceClock, agency] = await Promise.all([
      getCurrentAgencySourceClock(query.providerClass),
      searchCurrentAgencies({
        providerClass: query.providerClass,
        query:
          query.metric === "hh_hhcahps" || query.metric === "hospice_cahps" ? undefined : undefined,
        state: query.geography?.type === "state" ? query.geography.value : undefined,
        city: query.geography?.type === "city" ? query.geography.value : undefined,
        zip: query.geography?.type === "zip" ? query.geography.value : undefined,
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
      location: [row.city, row.state, row.zipCode].filter(Boolean).join(", "),
      statusLabel: `Current research cohort (CMS ${CLASS_LABEL[row.providerClass]} directory)`,
      href: row.href,
      evidence:
        row.providerClass === "home_health"
          ? [
              {
                label: "Quality of Patient Care stars",
                value: starText(row.cmsQualityStar, "Quality of Patient Care"),
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
      whyMatched: `${row.providerName} matches because it is a current ${CLASS_LABEL[row.providerClass].slice(0, -1).toLowerCase()} in the CMS directory${query.geography?.type === "state" ? ` with recorded ${query.geography.value} office/location state` : ""}. Office location is not a verified service area.`,
    }));
    if (query.mode === "count") {
      const table =
        query.providerClass === "home_health" ? "home_health_snapshot" : "hospice_snapshot";
      const values: string[] = [];
      const conditions: string[] = [];
      if (query.geography) {
        values.push(
          query.geography.type === "city"
            ? `%${query.geography.value.replace(/[\\%_]/g, "\\$&")}%`
            : query.geography.value,
        );
        const column =
          query.geography.type === "state"
            ? "state_code"
            : query.geography.type === "city"
              ? "city"
              : "zip_code";
        conditions.push(
          query.geography.type === "city" ? `${column} ILIKE $1 ESCAPE '\\'` : `${column}=$1`,
        );
      }
      if (query.providerClass === "home_health" && query.qualityFilters?.qpcStars?.[0]) {
        values.push(String(query.qualityFilters.qpcStars[0]));
        conditions.push(`quality_of_patient_care_star=$${values.length}::numeric`);
      }
      const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
      const counted = await getCareDatabasePool().query<{ n: string }>(
        `SELECT count(DISTINCT cms_ccn)::text AS n FROM ${table}${where}`,
        values,
      );
      const n = Number(counted.rows[0]?.n ?? 0);
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
        sourceFamily: sourceClock.sourceFamily,
        officialAsOf: sourceClock.officialAsOf,
      },
      limitations,
    };
  }

  if (query.mode === "count" && query.providerClass === "nursing_home") {
    const values: unknown[] = [];
    const { conditions } = nhFilters(query, values);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await getCareDatabasePool().query<{ n: string; as_of: Date | null }>(
      `${NH_CTE} SELECT count(*)::text AS n, max(source_modified_at) AS as_of FROM current_snapshots ${where}`,
      values,
    );
    const n = Number(result.rows[0]?.n ?? 0);
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
        officialAsOf: result.rows[0]?.as_of?.toISOString() ?? null,
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
         WHERE county_name ILIKE ${p(`%${county}%`)} ESCAPE '\\'`,
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

export { interpretSeniorAskQuery };
