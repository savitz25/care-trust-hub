import {
  HISTORY_READ_CAP,
  RECENT_HISTORY_MONTHS,
  STATE_HISTORY_REGULATORS,
  isMaterialStaffingChange,
  type HistoryEventRecord,
} from "./facility-history";
import {
  INTERVIEW_BUILDER_VERSION,
  INTERVIEW_MAX_MUST_ASK,
  INTERVIEW_MAX_QUESTIONS,
  INTERVIEW_MIN_QUESTIONS,
  INTERVIEW_QUESTION_LIBRARY,
  type FacilityEvidenceTrigger,
  type InterviewCareSetting,
  type InterviewConcernTag,
  type InterviewEvidencePathHint,
  type InterviewQuestionCategory,
  type InterviewQuestionDefinition,
  type InterviewQuestionPriority,
} from "./interview-questions";

export {
  INTERVIEW_BUILDER_VERSION,
  INTERVIEW_MAX_MUST_ASK,
  INTERVIEW_MAX_QUESTIONS,
  INTERVIEW_MIN_QUESTIONS,
  INTERVIEW_QUESTION_LIBRARY,
  isInterviewCareSetting,
  isInterviewConcernTag,
  type FacilityEvidenceTrigger,
  type InterviewCareSetting,
  type InterviewConcernTag,
  type InterviewEvidencePathHint,
  type InterviewQuestionCategory,
  type InterviewQuestionDefinition,
  type InterviewQuestionPriority,
} from "./interview-questions";

export const INTERVIEW_BUILDER_PATH = "/tools/facility-tour-interview-builder";

export const INTERVIEW_DISCLAIMER =
  "This checklist is educational. It does not rate a facility, recommend a provider, diagnose a condition, or determine that any setting is medically or financially appropriate. Checking a box does not create a score.";

export const ASSISTED_LIVING_MEMORY_TRANSPARENCY =
  "This checklist is general guidance. SeniorTrustHub publishes state-regulator licensing evidence for California, New York, and Texas assisted-living providers, not a national rating.";

export const ASSISTED_LIVING_FACILITY_TRANSPARENCY =
  "This checklist uses published state licensing evidence for this provider. State inspection and enforcement history is not yet integrated. That absence is not a clean record.";

export interface AssistedLivingInterviewEvidence {
  readonly providerId: string;
  readonly facilityName: string;
  readonly officialType: string;
  readonly licensedCapacity: number | null;
  readonly regulatorName: string;
  readonly memoryDesignation: string;
  readonly explicitMemory: boolean;
  readonly onProbation: boolean;
  readonly regulatorStatus: string | null;
}

export const HOME_CARE_TRANSPARENCY =
  "This checklist is general guidance for interviewing a home-care agency. SeniorTrustHub does not operate a verified national home-care directory and does not confirm that any agency is licensed or appropriate.";

export const FACILITY_RECORD_NOTE =
  "This record gives you something worth asking about. It is not a verdict on the facility.";

export const CARE_SETTING_LABELS: Record<InterviewCareSetting, string> = {
  skilled_nursing: "Skilled nursing",
  short_term_rehab: "Short-term rehabilitation",
  assisted_living: "Assisted living",
  memory_care: "Memory care",
  home_care: "Home-care agency",
};

export const CONCERN_TAG_LABELS: Record<InterviewConcernTag, string> = {
  staffing: "Staffing",
  falls: "Falls and safety",
  memory: "Memory and supervision",
  medications: "Medications",
  rehab: "Rehabilitation",
  communication: "Family communication",
  meals: "Meals",
  cost: "Cost and contracts",
  inspections: "Inspections",
  ownership: "Ownership",
  personal_care: "Personal care",
  activities: "Activities",
};

export const QUESTION_CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
  staffing: "Staffing",
  safety: "Safety",
  memory: "Memory",
  skilled_nursing: "Medical care",
  rehab: "Rehabilitation",
  medications: "Medical care",
  meals: "Meals",
  personal_care: "Personal care",
  activities: "Activities",
  family_communication: "Communication",
  inspections: "Inspections",
  ownership: "Ownership/compliance",
  pricing: "Costs",
};

export const BUILDER_CONCERN_CHOICES: readonly InterviewConcernTag[] = [
  "staffing",
  "falls",
  "memory",
  "medications",
  "rehab",
  "communication",
  "meals",
  "cost",
  "inspections",
  "ownership",
];

export type InterviewEvidenceRegulator = "CA_CDPH" | "NY_DOH";

export interface PublishedFacilityInterviewEvidence {
  readonly facilityName: string;
  readonly ccn: string;
  readonly cmsStaffingRating: number | null;
  readonly latestStaffingChangeDirection: "increase" | "decrease" | "stable" | null;
  readonly hasRecentInspectionDeficiencies: boolean;
  readonly recentInspectionCount: number;
  readonly hasRecentCmsPenalty: boolean;
  readonly recentPenaltyCount: number;
  readonly hasRecentOwnershipChange: boolean;
  readonly isMultiFacilityOrganization: boolean;
  readonly organizationFacilityCount: number | null;
  readonly hasPublishedStateEnforcement: boolean;
  readonly stateEnforcementRegulator: InterviewEvidenceRegulator | null;
  readonly hasPublishedNyComplaintInspection: boolean;
}

export interface InterviewQuestionEvidenceBasis {
  readonly trigger: FacilityEvidenceTrigger;
  readonly summary: string;
  readonly evidencePathHint: InterviewEvidencePathHint;
}

export interface InterviewChecklistQuestion {
  readonly id: string;
  readonly text: string;
  readonly whyAsk: string;
  readonly followUp?: string;
  readonly category: InterviewQuestionCategory;
  readonly categoryLabel: string;
  readonly priority: InterviewQuestionPriority;
  readonly evidenceBasis?: InterviewQuestionEvidenceBasis;
}

export interface InterviewChecklist {
  readonly version: typeof INTERVIEW_BUILDER_VERSION;
  readonly careSetting: InterviewCareSetting;
  readonly careSettingLabel: string;
  readonly concernTags: readonly InterviewConcernTag[];
  readonly mode: "general" | "facility";
  readonly facilityName: string | null;
  readonly facilityCcn: string | null;
  readonly questions: readonly InterviewChecklistQuestion[];
  readonly mustAsk: readonly InterviewChecklistQuestion[];
  readonly important: readonly InterviewChecklistQuestion[];
  readonly additional: readonly InterviewChecklistQuestion[];
  readonly firedEvidenceTriggers: readonly FacilityEvidenceTrigger[];
  readonly transparencyNote: string | null;
  readonly disclaimer: string;
}

const PRIORITY_WEIGHT: Record<InterviewQuestionPriority, number> = {
  MUST_ASK: 30,
  IMPORTANT: 20,
  OPTIONAL: 10,
};

const STATE_ENFORCEMENT_TYPES = new Set([
  "STATE_ENFORCEMENT",
  "STATE_ENFORCEMENT_ACTION",
  "STATE_FINE",
  "STATE_ADMINISTRATIVE_ORDER",
  "STATE_LICENSE_RESTRICTION",
  "STATE_LICENSE_SUSPENSION",
  "STATE_CLOSURE",
  "STATE_CLOSURE_ACTION",
  "STATE_IMMEDIATE_JEOPARDY",
]);

const NY_COMPLAINT_TYPES = new Set(["STATE_COMPLAINT_INSPECTION", "STATE_COMPLAINT"]);

function recentCutoff(now: Date): string {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RECENT_HISTORY_MONTHS);
  return cutoff.toISOString().slice(0, 10);
}

function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function regulatorFromEvent(event: HistoryEventRecord): InterviewEvidenceRegulator | null {
  if (event.regulator === STATE_HISTORY_REGULATORS.CA) return "CA_CDPH";
  if (event.regulator === STATE_HISTORY_REGULATORS.NY) return "NY_DOH";
  return null;
}

function inspectionHasDeficiencies(event: HistoryEventRecord): boolean {
  if (event.eventType !== "INSPECTION_COMPLETED") return false;
  if (/no linked health-deficiency findings/i.test(event.summary)) return false;
  return /\d+\s+deficienc/i.test(event.summary);
}

export function firedEvidenceTriggers(
  evidence: PublishedFacilityInterviewEvidence,
): FacilityEvidenceTrigger[] {
  const fired: FacilityEvidenceTrigger[] = [];
  if (evidence.latestStaffingChangeDirection === "decrease") fired.push("staffing_decline");
  if (evidence.cmsStaffingRating === 1 || evidence.cmsStaffingRating === 2) {
    fired.push("low_staffing_rating");
  }
  if (evidence.hasRecentInspectionDeficiencies) fired.push("recent_inspection");
  if (evidence.hasRecentCmsPenalty) fired.push("recent_penalty");
  if (evidence.hasRecentOwnershipChange) fired.push("ownership_change");
  if (evidence.isMultiFacilityOrganization) fired.push("multi_facility_org");
  if (evidence.hasPublishedStateEnforcement || evidence.hasPublishedNyComplaintInspection) {
    fired.push("state_enforcement");
  }
  return fired;
}

export function deriveFacilityInterviewEvidence(input: {
  facilityName: string;
  ccn: string;
  cmsStaffingRating: number | null;
  historyEvents?: readonly HistoryEventRecord[] | null;
  currentOrganizationFacilityCount?: number | null;
  now?: Date;
}): PublishedFacilityInterviewEvidence {
  const now = input.now ?? new Date();
  const cutoff = recentCutoff(now);
  const events = (input.historyEvents ?? []).slice(0, HISTORY_READ_CAP);
  const recent = events.filter((event) => event.eventDate.slice(0, 10) >= cutoff);

  const staffingChanges = recent
    .filter(
      (event) =>
        event.eventType === "STAFFING_TOTAL_CHANGED" || event.eventType === "STAFFING_RN_CHANGED",
    )
    .sort((left, right) => right.eventDate.localeCompare(left.eventDate));
  const latestStaffing = staffingChanges[0];
  let latestStaffingChangeDirection: PublishedFacilityInterviewEvidence["latestStaffingChangeDirection"] =
    null;
  if (latestStaffing) {
    const previous = parseNumericValue(latestStaffing.previousValue);
    const next = parseNumericValue(latestStaffing.newValue);
    if (previous != null && next != null && isMaterialStaffingChange(previous, next)) {
      latestStaffingChangeDirection = next < previous ? "decrease" : "increase";
    } else {
      latestStaffingChangeDirection = "stable";
    }
  }

  const deficiencyInspections = recent.filter(inspectionHasDeficiencies);
  const penalties = recent.filter((event) => event.eventType === "PENALTY_RECORDED");
  const ownershipChanges = recent.filter((event) => event.eventType === "OWNERSHIP_CHANGED");

  const publishedState = recent.filter((event) => {
    if (event.eventFamily !== "state") return false;
    return regulatorFromEvent(event) !== null;
  });
  const stateEnforcement = publishedState.find((event) =>
    STATE_ENFORCEMENT_TYPES.has(event.eventType),
  );
  const nyComplaint = publishedState.find(
    (event) => regulatorFromEvent(event) === "NY_DOH" && NY_COMPLAINT_TYPES.has(event.eventType),
  );

  const orgCount = input.currentOrganizationFacilityCount ?? null;
  const rating =
    input.cmsStaffingRating != null &&
    Number.isInteger(input.cmsStaffingRating) &&
    input.cmsStaffingRating >= 1 &&
    input.cmsStaffingRating <= 5
      ? input.cmsStaffingRating
      : null;

  return {
    facilityName: input.facilityName,
    ccn: input.ccn,
    cmsStaffingRating: rating,
    latestStaffingChangeDirection,
    hasRecentInspectionDeficiencies: deficiencyInspections.length > 0,
    recentInspectionCount: deficiencyInspections.length,
    hasRecentCmsPenalty: penalties.length > 0,
    recentPenaltyCount: penalties.length,
    hasRecentOwnershipChange: ownershipChanges.length > 0,
    isMultiFacilityOrganization: orgCount != null && orgCount >= 3,
    organizationFacilityCount: orgCount,
    hasPublishedStateEnforcement: Boolean(stateEnforcement),
    stateEnforcementRegulator: stateEnforcement
      ? regulatorFromEvent(stateEnforcement)
      : nyComplaint
        ? "NY_DOH"
        : null,
    hasPublishedNyComplaintInspection: Boolean(nyComplaint),
  };
}

function uniqueConcerns(tags: readonly InterviewConcernTag[]): InterviewConcernTag[] {
  return [...new Set(tags)];
}

function overlapCount(
  definition: InterviewQuestionDefinition,
  tags: readonly InterviewConcernTag[],
): number {
  return definition.triggerTags.filter((tag) => tags.includes(tag)).length;
}

function selectionScore(
  definition: InterviewQuestionDefinition,
  tags: readonly InterviewConcernTag[],
): number {
  return PRIORITY_WEIGHT[definition.defaultPriority] + overlapCount(definition, tags) * 15;
}

function toChecklistQuestion(
  definition: InterviewQuestionDefinition,
  priority: InterviewQuestionPriority,
  evidence?: InterviewQuestionEvidenceBasis,
): InterviewChecklistQuestion {
  return {
    id: definition.id,
    text: definition.text,
    whyAsk: definition.whyAsk,
    ...(definition.followUp ? { followUp: definition.followUp } : {}),
    category: definition.category,
    categoryLabel: QUESTION_CATEGORY_LABELS[definition.category],
    priority,
    ...(evidence ? { evidenceBasis: evidence } : {}),
  };
}

function evidenceBasisFor(
  definition: InterviewQuestionDefinition,
): InterviewQuestionEvidenceBasis | undefined {
  if (!definition.evidenceTrigger || !definition.evidencePathHint) return undefined;
  return {
    trigger: definition.evidenceTrigger,
    summary:
      definition.evidenceSummaryTemplate ??
      "The published facility record includes related public information.",
    evidencePathHint: definition.evidencePathHint,
  };
}

function assignDisplayPriority(
  selected: Array<{
    definition: InterviewQuestionDefinition;
    matched: boolean;
    evidence: boolean;
  }>,
): InterviewQuestionPriority[] {
  const assigned: InterviewQuestionPriority[] = selected.map((item) => {
    if (item.evidence || item.definition.defaultPriority === "MUST_ASK") return "MUST_ASK";
    if (item.matched || item.definition.defaultPriority === "IMPORTANT") return "IMPORTANT";
    return "OPTIONAL";
  });

  let mustAskCount = assigned.filter((priority) => priority === "MUST_ASK").length;
  if (mustAskCount <= INTERVIEW_MAX_MUST_ASK) return assigned;

  for (
    let index = assigned.length - 1;
    index >= 0 && mustAskCount > INTERVIEW_MAX_MUST_ASK;
    index -= 1
  ) {
    if (assigned[index] !== "MUST_ASK") continue;
    if (selected[index]?.evidence) continue;
    assigned[index] = "IMPORTANT";
    mustAskCount -= 1;
  }
  return assigned;
}

function transparencyNote(
  setting: InterviewCareSetting,
  mode: "general" | "facility",
  assistedLivingEvidence?: AssistedLivingInterviewEvidence | null,
): string | null {
  if (setting === "assisted_living" || setting === "memory_care") {
    return assistedLivingEvidence
      ? ASSISTED_LIVING_FACILITY_TRANSPARENCY
      : ASSISTED_LIVING_MEMORY_TRANSPARENCY;
  }
  if (setting === "home_care") return HOME_CARE_TRANSPARENCY;
  if (mode === "facility") return FACILITY_RECORD_NOTE;
  return null;
}

export function buildInterviewChecklist(input: {
  careSetting: InterviewCareSetting;
  concernTags?: readonly InterviewConcernTag[];
  facilityEvidence?: PublishedFacilityInterviewEvidence | null;
  assistedLivingEvidence?: AssistedLivingInterviewEvidence | null;
}): InterviewChecklist {
  const concernTags = uniqueConcerns(input.concernTags ?? []);
  const facilityEvidence =
    input.careSetting === "skilled_nursing" || input.careSetting === "short_term_rehab"
      ? (input.facilityEvidence ?? null)
      : null;
  const assistedLivingEvidence =
    input.careSetting === "assisted_living" || input.careSetting === "memory_care"
      ? (input.assistedLivingEvidence ?? null)
      : null;
  const triggers = facilityEvidence ? firedEvidenceTriggers(facilityEvidence) : [];
  if (assistedLivingEvidence?.explicitMemory) triggers.push("explicit_memory_designation");
  if (assistedLivingEvidence?.onProbation) triggers.push("ca_probation");
  const mode: "general" | "facility" =
    facilityEvidence || assistedLivingEvidence ? "facility" : "general";

  const evidenceDefinitions = INTERVIEW_QUESTION_LIBRARY.filter(
    (definition) =>
      Boolean(definition.evidenceTrigger) &&
      definition.careSettings.includes(input.careSetting) &&
      definition.evidenceTrigger !== undefined &&
      triggers.includes(definition.evidenceTrigger),
  );

  const generalDefinitions = INTERVIEW_QUESTION_LIBRARY.filter(
    (definition) =>
      !definition.evidenceTrigger && definition.careSettings.includes(input.careSetting),
  );

  const rankedGeneral = [...generalDefinitions].sort((left, right) => {
    const scoreDelta = selectionScore(right, concernTags) - selectionScore(left, concernTags);
    if (scoreDelta !== 0) return scoreDelta;
    return left.id.localeCompare(right.id);
  });

  const chosen = new Map<string, InterviewQuestionDefinition>();
  for (const definition of evidenceDefinitions) chosen.set(definition.id, definition);

  for (const definition of rankedGeneral) {
    if (chosen.size >= INTERVIEW_MAX_QUESTIONS) break;
    chosen.set(definition.id, definition);
  }

  if (chosen.size < INTERVIEW_MIN_QUESTIONS) {
    for (const definition of generalDefinitions) {
      chosen.set(definition.id, definition);
      if (chosen.size >= INTERVIEW_MIN_QUESTIONS) break;
    }
  }

  const selected = [...chosen.values()].map((definition) => ({
    definition,
    matched: overlapCount(definition, concernTags) > 0,
    evidence: Boolean(definition.evidenceTrigger),
  }));

  selected.sort((left, right) => {
    if (left.evidence !== right.evidence) return left.evidence ? -1 : 1;
    const scoreDelta =
      selectionScore(right.definition, concernTags) - selectionScore(left.definition, concernTags);
    if (scoreDelta !== 0) return scoreDelta;
    return left.definition.id.localeCompare(right.definition.id);
  });

  const priorities = assignDisplayPriority(selected);
  const questions = selected.map((item, index) =>
    toChecklistQuestion(
      item.definition,
      priorities[index] ?? "OPTIONAL",
      item.evidence ? evidenceBasisFor(item.definition) : undefined,
    ),
  );

  return {
    version: INTERVIEW_BUILDER_VERSION,
    careSetting: input.careSetting,
    careSettingLabel: CARE_SETTING_LABELS[input.careSetting],
    concernTags,
    mode,
    facilityName: facilityEvidence?.facilityName ?? assistedLivingEvidence?.facilityName ?? null,
    facilityCcn: facilityEvidence?.ccn ?? null,
    questions,
    mustAsk: questions.filter((question) => question.priority === "MUST_ASK"),
    important: questions.filter((question) => question.priority === "IMPORTANT"),
    additional: questions.filter((question) => question.priority === "OPTIONAL"),
    firedEvidenceTriggers: triggers,
    transparencyNote: transparencyNote(input.careSetting, mode, assistedLivingEvidence),
    disclaimer: INTERVIEW_DISCLAIMER,
  };
}
