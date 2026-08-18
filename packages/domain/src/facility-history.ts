export const FACILITY_HISTORY_VERSION = "facility-history-v1";

export const HISTORY_EVENT_FAMILIES = [
  "rating",
  "staffing",
  "inspection",
  "enforcement",
  "ownership",
  "state",
] as const;

export type HistoryEventFamily = (typeof HISTORY_EVENT_FAMILIES)[number];
export type HistoryImportance = "HIGH" | "MEDIUM" | "LOW";
export type HistoryDatePrecision = "day" | "month" | "quarter" | "release";
export type HistoryDateBasis = "occurred" | "reported_in_release";

export const HISTORY_EVENT_TYPES = [
  "OVERALL_RATING_CHANGED",
  "HEALTH_INSPECTION_RATING_CHANGED",
  "STAFFING_RATING_CHANGED",
  "QUALITY_MEASURE_RATING_CHANGED",
  "STAFFING_RN_CHANGED",
  "STAFFING_TOTAL_CHANGED",
  "INSPECTION_COMPLETED",
  "PENALTY_RECORDED",
  "OWNERSHIP_CHANGED",
  "STATE_INSPECTION",
  "STATE_COMPLAINT",
  "STATE_ENFORCEMENT",
  "STATE_FINE",
  "STATE_LICENSE_RESTRICTION",
  "STATE_CLOSURE",
  "STATE_OPERATOR_CHANGE",
] as const;

export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export const HISTORY_FILTERS = [
  "all",
  "rating",
  "staffing",
  "inspection",
  "enforcement",
  "ownership",
] as const;

export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export const STAFFING_ABSOLUTE_HPRD = 0.2;
export const STAFFING_RELATIVE = 0.1;
export const STAFFING_RELATIVE_FLOOR = 0.1;
export const MAJOR_PENALTY_DOLLARS = 10_000;
export const DEFAULT_HISTORY_LIMIT = 12;
export const HISTORY_READ_CAP = 60;
export const RECENT_HISTORY_MONTHS = 18;

const ORG_NAME =
  /\b(llc|inc|corp|ltd|lp|llp|hospital|health|county|city|district|authority|services|care|center|homes|rehab|nursing)\b/i;

export interface HistoryEventRecord {
  id: string;
  eventType: HistoryEventType;
  eventFamily: HistoryEventFamily;
  eventDate: string;
  datePrecision: HistoryDatePrecision;
  dateBasis: HistoryDateBasis;
  importance: HistoryImportance;
  title: string;
  summary: string;
  previousValue: string | null;
  newValue: string | null;
  evidenceHref: string;
  sourceDatasetName: string;
  sourceRecordLocator: string | null;
}

export interface RecentHistoryHighlight {
  title: string;
  summary: string;
}

export function isMaterialStaffingChange(previous: number, next: number): boolean {
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return false;
  const delta = Math.abs(next - previous);
  if (delta === 0) return false;
  if (delta >= STAFFING_ABSOLUTE_HPRD) return true;
  if (previous === 0) return false;
  return delta >= STAFFING_RELATIVE_FLOOR && delta / Math.abs(previous) >= STAFFING_RELATIVE;
}

export function deriveRatingChange(input: {
  kind: "overall" | "healthInspection" | "staffing" | "qualityMeasure";
  previous: number | null | undefined;
  next: number | null | undefined;
}): {
  type: HistoryEventType;
  title: string;
  summary: string;
  previousValue: string;
  newValue: string;
} | null {
  if (input.previous == null || input.next == null) return null;
  if (!Number.isInteger(input.previous) || !Number.isInteger(input.next)) return null;
  if (input.previous < 1 || input.previous > 5 || input.next < 1 || input.next > 5) return null;
  if (input.previous === input.next) return null;
  const labels = {
    overall: ["OVERALL_RATING_CHANGED", "Overall CMS rating changed"] as const,
    healthInspection: [
      "HEALTH_INSPECTION_RATING_CHANGED",
      "Health inspection rating changed",
    ] as const,
    staffing: ["STAFFING_RATING_CHANGED", "Staffing rating changed"] as const,
    qualityMeasure: ["QUALITY_MEASURE_RATING_CHANGED", "Quality-measure rating changed"] as const,
  };
  const [type, title] = labels[input.kind];
  const direction = input.next > input.previous ? "increased" : "declined";
  return {
    type,
    title,
    summary: `${title} from ${input.previous}★ to ${input.next}★. The rating ${direction}.`,
    previousValue: String(input.previous),
    newValue: String(input.next),
  };
}

export function deriveStaffingChange(input: {
  measure: "rn" | "total";
  previous: number | null | undefined;
  next: number | null | undefined;
  previousQuarter: string;
  nextQuarter: string;
}): {
  type: HistoryEventType;
  title: string;
  summary: string;
  previousValue: string;
  newValue: string;
  importance: HistoryImportance;
} | null {
  if (input.previous == null || input.next == null) return null;
  if (!isMaterialStaffingChange(input.previous, input.next)) return null;
  const label = input.measure === "rn" ? "RN staffing" : "Total nurse staffing";
  const type = input.measure === "rn" ? "STAFFING_RN_CHANGED" : "STAFFING_TOTAL_CHANGED";
  const increased = input.next > input.previous;
  const verb = increased ? "increased" : "decreased";
  const trend = increased ? "improved" : "declined";
  return {
    type,
    title: `${label} ${verb}`,
    summary: `${label} ${verb} from ${input.previous.toFixed(2)} to ${input.next.toFixed(2)} hours per resident day between ${input.previousQuarter} and ${input.nextQuarter}. Staffing ${trend} across those reported periods.`,
    previousValue: input.previous.toFixed(2),
    newValue: input.next.toFixed(2),
    importance: "MEDIUM",
  };
}

export function inspectionConsumerTitle(surveyType: string): string {
  const normalized = surveyType.trim().toLowerCase();
  if (normalized.includes("complaint") && normalized.includes("fire")) {
    return "Fire-safety complaint inspection recorded";
  }
  if (normalized.includes("complaint")) return "Complaint inspection recorded";
  if (normalized.includes("infection")) return "Infection-control inspection recorded";
  if (normalized.includes("fire")) return "Fire-safety inspection recorded";
  return "Health inspection completed";
}

export function shouldPublishInspectionType(surveyType: string): boolean {
  const normalized = surveyType.trim().toLowerCase();
  if (normalized === "fire safety standard") return false;
  return (
    normalized.includes("health") ||
    normalized.includes("complaint") ||
    normalized.includes("infection")
  );
}

export function inspectionImportance(highestCode: string | null): HistoryImportance {
  const code = (highestCode ?? "").toUpperCase();
  if (/[G-L]/.test(code)) return "HIGH";
  return "MEDIUM";
}

export function inspectionSummary(input: {
  surveyType: string;
  deficiencyCount: number;
  higherSeverityCount: number;
}): string {
  const count = input.deficiencyCount;
  const base =
    count === 0
      ? "No linked health-deficiency findings were recorded for this survey."
      : `${count} ${count === 1 ? "deficiency was" : "deficiencies were"} recorded.`;
  if (input.higherSeverityCount > 0) {
    return `${base} That includes ${input.higherSeverityCount} higher-severity ${
      input.higherSeverityCount === 1 ? "deficiency" : "deficiencies"
    }.`;
  }
  return base;
}

export function penaltyEvent(input: {
  penaltyType: "Fine" | "Payment Denial";
  fineAmount: number | null;
  paymentDenialDays: number | null;
}): { title: string; summary: string; importance: HistoryImportance } {
  if (input.penaltyType === "Fine") {
    const amount = input.fineAmount ?? 0;
    const formatted = amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    });
    return {
      title: "Civil monetary penalty recorded",
      summary: `CMS recorded a ${formatted} civil monetary penalty.`,
      importance: amount >= MAJOR_PENALTY_DOLLARS ? "HIGH" : "MEDIUM",
    };
  }
  const days = input.paymentDenialDays;
  return {
    title: "Medicare payment denial recorded",
    summary:
      days == null
        ? "CMS recorded a Medicare payment-denial action."
        : `CMS recorded a Medicare payment denial lasting ${days} ${days === 1 ? "day" : "days"}.`,
    importance: "HIGH",
  };
}

export function isSafeOrganizationName(value: string | null | undefined): boolean {
  const name = value?.trim() ?? "";
  if (name.length < 4) return false;
  if (name.includes("@")) return false;
  return ORG_NAME.test(name);
}

export function ownershipSummary(buyerName: string | null | undefined): string {
  if (isSafeOrganizationName(buyerName)) {
    return `An ownership change was recorded. New organization: ${buyerName!.trim()}.`;
  }
  return "CMS recorded a change of ownership.";
}

export function eventFamilyForType(type: HistoryEventType): HistoryEventFamily {
  if (type.includes("RATING")) return "rating";
  if (type.startsWith("STAFFING_")) return "staffing";
  if (type.startsWith("INSPECTION")) return "inspection";
  if (type.startsWith("PENALTY") || type.includes("ENFORCEMENT") || type.includes("FINE")) {
    return type.startsWith("STATE_") ? "state" : "enforcement";
  }
  if (type.startsWith("OWNERSHIP") || type === "STATE_OPERATOR_CHANGE") {
    return type.startsWith("STATE_") ? "state" : "ownership";
  }
  if (type.startsWith("STATE_")) return "state";
  return "inspection";
}

export function evidenceHrefForFamily(family: HistoryEventFamily): string {
  if (family === "staffing") return "#staffing";
  if (family === "enforcement") return "#penalties";
  if (family === "ownership") return "#ownership";
  if (family === "state") return "#state-license";
  if (family === "inspection") return "#inspections";
  return "#overview";
}

export function filterHistoryEvents(
  events: readonly HistoryEventRecord[],
  filter: HistoryFilter,
): HistoryEventRecord[] {
  if (filter === "all") return [...events];
  return events.filter((event) => event.eventFamily === filter);
}

export function groupHistoryByYear(
  events: readonly HistoryEventRecord[],
): Array<{ year: string; events: HistoryEventRecord[] }> {
  const grouped = new Map<string, HistoryEventRecord[]>();
  for (const event of events) {
    const year = event.eventDate.slice(0, 4);
    grouped.set(year, [...(grouped.get(year) ?? []), event]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([year, yearEvents]) => ({ year, events: yearEvents }));
}

export function selectRecentHighlights(
  events: readonly HistoryEventRecord[],
  now = new Date(),
): RecentHistoryHighlight[] {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RECENT_HISTORY_MONTHS);
  const cutoffText = cutoff.toISOString().slice(0, 10);
  const recent = events.filter(
    (event) => event.eventDate >= cutoffText && event.importance !== "LOW",
  );
  const seen = new Set<HistoryEventFamily>();
  const highlights: RecentHistoryHighlight[] = [];
  for (const event of recent) {
    if (seen.has(event.eventFamily)) continue;
    seen.add(event.eventFamily);
    highlights.push({ title: event.title, summary: event.summary });
    if (highlights.length === 3) break;
  }
  return highlights;
}

export function recentChangesFallback(): string {
  return "No major recent changes were identified in the available history.";
}

export function historyCoverageLabel(eventCount: number): string {
  if (eventCount <= 0) return "Limited historical data is available for this facility.";
  return `${eventCount} historical ${eventCount === 1 ? "event" : "events"} available`;
}

export function historyFingerprint(parts: readonly string[]): string {
  return `${FACILITY_HISTORY_VERSION}|${parts.join("|")}`;
}
