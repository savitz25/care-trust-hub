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
}

interface CountRow {
  total: string;
}

export async function getPublishedFacilityHistory(ccn: string): Promise<CareFacilityHistory> {
  const identifier = validateCcn(ccn);
  const pool = getCareDatabasePool();
  const [events, count] = await Promise.all([
    pool.query<HistoryRow>(
      `SELECT e.id, e.event_type, e.event_family, e.event_date::text, e.date_precision,
              e.date_basis, e.importance, e.title, e.summary, e.previous_value, e.new_value,
              e.evidence_href, e.source_dataset_key, e.source_record_locator
         FROM published_facility_history_event e
         JOIN provider_identifier pi ON pi.provider_id = e.provider_id
          AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
        WHERE pi.identifier_value = $1
        ORDER BY e.event_date DESC, e.importance ASC, e.id DESC
        LIMIT $2`,
      [identifier, HISTORY_READ_CAP],
    ),
    pool.query<CountRow>(
      `SELECT count(*)::text AS total
         FROM published_facility_history_event e
         JOIN provider_identifier pi ON pi.provider_id = e.provider_id
          AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
        WHERE pi.identifier_value = $1`,
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

export const FACILITY_HISTORY_DEFAULT_LIMIT = DEFAULT_HISTORY_LIMIT;
