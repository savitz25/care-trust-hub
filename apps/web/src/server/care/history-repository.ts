import "server-only";
import {
  DEFAULT_HISTORY_LIMIT,
  HISTORY_READ_CAP,
  historyCoverageLabel,
  recentChangesFallback,
  selectRecentHighlights,
  type HistoryEventRecord,
} from "@care/domain";
import { getCareDatabasePool } from "./db";
import type { CareFacilityHistory } from "./types";

function validateCcn(ccn: string): string {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) throw new RangeError("Invalid CMS CCN");
  return value;
}

interface HistoryRow {
  id: string;
  event_type: HistoryEventRecord["eventType"];
  event_family: HistoryEventRecord["eventFamily"];
  event_date: string;
  date_precision: HistoryEventRecord["datePrecision"];
  date_basis: HistoryEventRecord["dateBasis"];
  importance: HistoryEventRecord["importance"];
  title: string;
  summary: string;
  previous_value: string | null;
  new_value: string | null;
  evidence_href: string;
  source_dataset_key: string;
  source_record_locator: string | null;
  source_label: string | null;
  regulator: string | null;
}

interface CountRow {
  total: string;
}

export async function getPublishedFacilityHistory(
  ccn: string,
  options: { includeStateEvents?: boolean } = {},
): Promise<CareFacilityHistory> {
  const identifier = validateCcn(ccn);
  const includeState = options.includeStateEvents === true;
  const pool = getCareDatabasePool();
  const stateClause = includeState
    ? "AND (e.event_family <> 'state' OR coalesce(e.federal_relationship, '') <> 'POSSIBLE_DUPLICATE')"
    : "AND e.event_family <> 'state'";
  const [events, count] = await Promise.all([
    pool.query<HistoryRow>(
      `SELECT e.id, e.event_type, e.event_family, e.event_date::text, e.date_precision,
              e.date_basis, e.importance, e.title, e.summary, e.previous_value, e.new_value,
              e.evidence_href, e.source_dataset_key, e.source_record_locator,
              e.source_label, e.regulator
         FROM published_facility_history_event e
         JOIN provider_identifier pi ON pi.provider_id = e.provider_id
          AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
        WHERE pi.identifier_value = $1
          ${stateClause}
        ORDER BY e.event_date DESC, e.importance ASC, e.id DESC
        LIMIT $2`,
      [identifier, HISTORY_READ_CAP],
    ),
    pool.query<CountRow>(
      `SELECT count(*)::text AS total
         FROM published_facility_history_event e
         JOIN provider_identifier pi ON pi.provider_id = e.provider_id
          AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
        WHERE pi.identifier_value = $1
          ${stateClause}`,
      [identifier],
    ),
  ]);
  const mapped: HistoryEventRecord[] = events.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    eventFamily: row.event_family,
    eventDate: row.event_date,
    datePrecision: row.date_precision,
    dateBasis: row.date_basis,
    importance: row.importance,
    title: row.title,
    summary: row.summary,
    previousValue: row.previous_value,
    newValue: row.new_value,
    evidenceHref: row.evidence_href,
    sourceDatasetName: row.source_dataset_key,
    sourceRecordLocator: row.source_record_locator,
    sourceLabel: row.source_label ?? (row.event_family === "state" ? "State regulator" : "CMS"),
    regulator: row.regulator,
  }));
  const totalCount = Number(count.rows[0]?.total ?? mapped.length);
  return {
    events: mapped,
    totalCount,
    coverageLabel: historyCoverageLabel(totalCount),
    recentHighlights: selectRecentHighlights(mapped),
    emptyRecentLabel: recentChangesFallback(),
  };
}

function mapHistoryRow(row: HistoryRow): HistoryEventRecord {
  return {
    id: row.id,
    eventType: row.event_type,
    eventFamily: row.event_family,
    eventDate: row.event_date,
    datePrecision: row.date_precision,
    dateBasis: row.date_basis,
    importance: row.importance,
    title: row.title,
    summary: row.summary,
    previousValue: row.previous_value,
    newValue: row.new_value,
    evidenceHref: row.evidence_href,
    sourceDatasetName: row.source_dataset_key,
    sourceRecordLocator: row.source_record_locator,
    sourceLabel: row.source_label ?? (row.event_family === "state" ? "State regulator" : "CMS"),
    regulator: row.regulator,
  };
}

export async function getPublishedFacilityHistoriesByCcns(
  ccns: readonly string[],
  options: { includeStateEvents?: boolean } = {},
): Promise<Map<string, CareFacilityHistory>> {
  const unique = [...new Set(ccns.map(validateCcn))].slice(0, 5);
  const result = new Map<string, CareFacilityHistory>();
  if (unique.length === 0) return result;
  const includeState = options.includeStateEvents === true;
  const stateClause = includeState
    ? "AND (e.event_family <> 'state' OR coalesce(e.federal_relationship, '') <> 'POSSIBLE_DUPLICATE')"
    : "AND e.event_family <> 'state'";
  const pool = getCareDatabasePool();
  const [events, counts] = await Promise.all([
    pool.query<HistoryRow & { ccn: string }>(
      `SELECT * FROM (
         SELECT e.id, e.event_type, e.event_family, e.event_date::text, e.date_precision,
                e.date_basis, e.importance, e.title, e.summary, e.previous_value, e.new_value,
                e.evidence_href, e.source_dataset_key, e.source_record_locator,
                e.source_label, e.regulator, pi.identifier_value AS ccn,
                row_number() OVER (
                  PARTITION BY pi.identifier_value
                  ORDER BY e.event_date DESC, e.importance ASC, e.id DESC
                ) AS rn
           FROM published_facility_history_event e
           JOIN provider_identifier pi ON pi.provider_id = e.provider_id
            AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
          WHERE pi.identifier_value = ANY($1::text[])
            ${stateClause}
       ) ranked
       WHERE ranked.rn <= $2`,
      [unique, HISTORY_READ_CAP],
    ),
    pool.query<{ ccn: string; total: string }>(
      `SELECT pi.identifier_value AS ccn, count(*)::text AS total
         FROM published_facility_history_event e
         JOIN provider_identifier pi ON pi.provider_id = e.provider_id
          AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
        WHERE pi.identifier_value = ANY($1::text[])
          ${stateClause}
        GROUP BY pi.identifier_value`,
      [unique],
    ),
  ]);
  const grouped = new Map<string, HistoryEventRecord[]>();
  for (const row of events.rows) {
    grouped.set(row.ccn, [...(grouped.get(row.ccn) ?? []), mapHistoryRow(row)]);
  }
  const totals = new Map(counts.rows.map((row) => [row.ccn, Number(row.total)]));
  for (const ccn of unique) {
    const mapped = grouped.get(ccn) ?? [];
    const totalCount = totals.get(ccn) ?? mapped.length;
    result.set(ccn, {
      events: mapped,
      totalCount,
      coverageLabel: historyCoverageLabel(totalCount),
      recentHighlights: selectRecentHighlights(mapped),
      emptyRecentLabel: recentChangesFallback(),
    });
  }
  return result;
}

export const FACILITY_HISTORY_DEFAULT_LIMIT = DEFAULT_HISTORY_LIMIT;
