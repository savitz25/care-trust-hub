import "server-only";
import type { QueryResultRow } from "pg";
import { getCareDatabasePool } from "./db";
import { CMS_REGULATORY_SOURCES } from "./source-contracts";
import type {
  CareDeficiencyFinding,
  CareHistoryEvent,
  CareInspection,
  CarePenalty,
  CareRegulatoryIntelligence,
  CareRegulatorySourceDisclosure,
  CareScopeSeverity,
} from "./types";

const scopes = ["Isolated", "Pattern", "Widespread"] as const;
const severityRows = [
  ["ABC", "No actual harm with potential for minimal harm", 1, false],
  [
    "DEF",
    "No actual harm with potential for more than minimal harm that is not immediate jeopardy",
    2,
    false,
  ],
  ["GHI", "Actual harm that is not immediate jeopardy", 3, false],
  ["JKL", "Immediate jeopardy to resident health or safety", 4, true],
] as const;
export const CMS_SCOPE_SEVERITY: Record<string, CareScopeSeverity> = Object.fromEntries(
  severityRows.flatMap(([codes, severity, level, immediateJeopardy]) =>
    [...codes].map((code, index) => [
      code,
      { code, scope: scopes[index]!, severity, severityLevel: level, immediateJeopardy },
    ]),
  ),
);

function validateCcn(ccn: string): string {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) throw new RangeError("Invalid CMS CCN");
  return value;
}

interface SourceRow extends QueryResultRow {
  id: string;
  ccn: string;
  source_record_locator: string;
  source_organization: string;
  dataset_name: string;
  official_url: string;
  release_key: string;
  source_modified_at: Date | null;
  retrieved_at: Date;
}
interface InspectionRow extends SourceRow {
  survey_date: string;
  survey_type: string;
  survey_cycle: number;
}
interface DeficiencyRow extends SourceRow {
  inspection_event_id: string | null;
  deficiency_prefix: string;
  deficiency_tag: string;
  deficiency_category: string | null;
  official_description: string | null;
  scope_severity_code: string;
  deficiency_corrected: string | null;
  correction_date: string | null;
  citation_under_idr: boolean | null;
  citation_under_iidr: boolean | null;
}
interface PenaltyRow extends SourceRow {
  penalty_date: string;
  penalty_type: "Fine" | "Payment Denial";
  fine_amount: string | null;
  payment_denial_start_date: string | null;
  payment_denial_days: number | null;
}

function currentRelease(datasetKey: string): string {
  return `SELECT sr.id FROM source_dataset sd JOIN source_release sr ON sr.source_dataset_id=sd.id
    JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
    WHERE sd.dataset_key='${datasetKey}'
    ORDER BY sr.source_modified_at DESC NULLS LAST, sr.source_release_date DESC NULLS LAST,
      sr.release_key DESC, ir.completed_at DESC LIMIT 1`;
}
const provenance = `JOIN provider_identifier pi ON pi.provider_id=r.provider_id
  AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
  JOIN source_release sr ON sr.id=r.source_release_id
  JOIN source_dataset sd ON sd.id=sr.source_dataset_id`;

function disclosure(
  row: SourceRow,
  kind: keyof typeof CMS_REGULATORY_SOURCES,
): CareRegulatorySourceDisclosure {
  return {
    sourceOrganization: row.source_organization,
    datasetName: row.dataset_name,
    cmsDatasetIdentifier: CMS_REGULATORY_SOURCES[kind].datasetIdentifier,
    officialSourceUrl: row.official_url,
    releaseIdentifier: row.release_key,
    sourceModifiedAt: row.source_modified_at?.toISOString() ?? null,
    retrievedAt: row.retrieved_at.toISOString(),
    providerIdentifier: row.ccn,
    sourceRecordLocator: row.source_record_locator,
  };
}

export async function getProviderRegulatoryIntelligence(
  ccn: string,
): Promise<CareRegulatoryIntelligence> {
  const identifier = validateCcn(ccn);
  const pool = getCareDatabasePool();
  const [inspectionResult, deficiencyResult, penaltyResult] = await Promise.all([
    pool.query<InspectionRow>(
      `SELECT r.id, pi.identifier_value ccn, r.survey_date::text, r.survey_type,
       r.survey_cycle, r.source_record_locator, sd.source_organization,
       sd.display_name dataset_name, sd.official_url, sr.release_key,
       sr.source_modified_at, sr.retrieved_at FROM inspection_event r ${provenance}
       WHERE pi.identifier_value=$1 AND r.source_release_id=(${currentRelease(CMS_REGULATORY_SOURCES.inspections.datasetKey)})
       ORDER BY r.survey_date DESC, r.survey_type LIMIT 20`,
      [identifier],
    ),
    pool.query<DeficiencyRow>(
      `SELECT r.id, pi.identifier_value ccn, r.inspection_event_id,
       r.deficiency_prefix, r.deficiency_tag, r.deficiency_category, r.official_description,
       r.scope_severity_code, r.deficiency_corrected, r.correction_date::text,
       r.citation_under_idr, r.citation_under_iidr, r.source_record_locator,
       sd.source_organization, sd.display_name dataset_name, sd.official_url,
       sr.release_key, sr.source_modified_at, sr.retrieved_at
       FROM deficiency_finding r ${provenance}
       WHERE pi.identifier_value=$1 AND r.source_release_id=(${currentRelease(CMS_REGULATORY_SOURCES.deficiencies.datasetKey)})
       ORDER BY r.survey_date DESC, r.deficiency_prefix, r.deficiency_tag LIMIT 200`,
      [identifier],
    ),
    pool.query<PenaltyRow>(
      `SELECT r.id, pi.identifier_value ccn, r.penalty_date::text, r.penalty_type,
       r.fine_amount::text, r.payment_denial_start_date::text, r.payment_denial_days,
       r.source_record_locator, sd.source_organization, sd.display_name dataset_name,
       sd.official_url, sr.release_key, sr.source_modified_at, sr.retrieved_at
       FROM penalty_enforcement r ${provenance}
       WHERE pi.identifier_value=$1 AND r.source_release_id=(${currentRelease(CMS_REGULATORY_SOURCES.penalties.datasetKey)})
       ORDER BY r.penalty_date DESC, r.id LIMIT 100`,
      [identifier],
    ),
  ]);
  const findingsByInspection = new Map<string, CareDeficiencyFinding[]>();
  for (const row of deficiencyResult.rows) {
    const scopeSeverity = CMS_SCOPE_SEVERITY[row.scope_severity_code];
    if (!scopeSeverity)
      throw new Error(`Unsupported CMS scope/severity: ${row.scope_severity_code}`);
    const finding: CareDeficiencyFinding = {
      id: row.id,
      tag: `${row.deficiency_prefix}${row.deficiency_tag}`,
      category: row.deficiency_category,
      officialDescription: row.official_description,
      scopeSeverity,
      correctionStatus: row.deficiency_corrected,
      correctionDate: row.correction_date,
      underIdr: row.citation_under_idr,
      underIidr: row.citation_under_iidr,
      source: disclosure(row, "deficiencies"),
    };
    if (row.inspection_event_id) {
      findingsByInspection.set(row.inspection_event_id, [
        ...(findingsByInspection.get(row.inspection_event_id) ?? []),
        finding,
      ]);
    }
  }
  const inspections: CareInspection[] = inspectionResult.rows.map((row) => {
    const findings = findingsByInspection.get(row.id) ?? [];
    return {
      id: row.id,
      surveyDate: row.survey_date,
      surveyType: row.survey_type,
      surveyCycle: row.survey_cycle,
      findings,
      highestScopeSeverity: findings.reduce<CareScopeSeverity | null>(
        (highest, finding) =>
          !highest || finding.scopeSeverity.severityLevel > highest.severityLevel
            ? finding.scopeSeverity
            : highest,
        null,
      ),
      source: disclosure(row, "inspections"),
    };
  });
  const penalties: CarePenalty[] = penaltyResult.rows.map((row) => ({
    id: row.id,
    penaltyDate: row.penalty_date,
    penaltyType: row.penalty_type,
    fineAmount: row.fine_amount,
    paymentDenialStartDate: row.payment_denial_start_date,
    paymentDenialDays: row.payment_denial_days,
    source: disclosure(row, "penalties"),
  }));
  const repeated = new Map<string, Set<string>>();
  for (const inspection of inspections) {
    for (const finding of inspection.findings) {
      repeated.set(finding.tag, (repeated.get(finding.tag) ?? new Set()).add(inspection.id));
    }
  }
  const repeatTags = [...repeated]
    .filter(([, inspections]) => inspections.size > 1)
    .map(([tag, inspectionIds]) => ({ tag, inspectionCount: inspectionIds.size }))
    .sort((a, b) => b.inspectionCount - a.inspectionCount || a.tag.localeCompare(b.tag));
  const timeline: CareHistoryEvent[] = [
    ...inspections.map((inspection) => ({
      id: `inspection-${inspection.id}`,
      eventDate: inspection.surveyDate,
      kind: "inspection" as const,
      title: inspection.surveyType,
      detail: `${inspection.findings.length} linked deficiency finding${inspection.findings.length === 1 ? "" : "s"}`,
    })),
    ...penalties.map((penalty) => ({
      id: `penalty-${penalty.id}`,
      eventDate: penalty.penaltyDate,
      kind: "penalty" as const,
      title: penalty.penaltyType,
      detail: penalty.fineAmount
        ? `$${Number(penalty.fineAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        : `${penalty.paymentDenialDays ?? "Not reported"} payment-denial days`,
    })),
  ].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.id.localeCompare(b.id));
  return { inspections, penalties, repeatTags, timeline };
}
