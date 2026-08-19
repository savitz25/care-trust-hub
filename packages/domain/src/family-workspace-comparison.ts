import {
  HISTORY_READ_CAP,
  RECENT_HISTORY_MONTHS,
  STATE_HISTORY_REGULATORS,
  isMaterialStaffingChange,
  selectRecentHighlights,
  type HistoryEventRecord,
} from "./facility-history";
import { FAMILY_WORKSPACE_VERSION } from "./family-workspace";
import type { PublishedStateIntelligence } from "./state-publication";

export const FAMILY_WORKSPACE_COMPARISON_VERSION = "family-workspace-comparison-v1" as const;

export const FAMILY_WORKSPACE_COMPARISON_DISCLAIMER =
  "This comparison presents published SeniorTrustHub evidence and your local notes. It does not rank facilities, recommend a provider, or create a score. The family decides.";

export const USER_ENTERED_QUOTE_LABEL = "User-entered quote";

export type StaffingDirectionLabel =
  | "increased"
  | "decreased"
  | "no material recent change identified"
  | "insufficient comparable history";

export interface WorkspaceHistoryHighlight {
  readonly title: string;
  readonly summary: string;
}

export interface PublishedWorkspaceFacilityInput {
  readonly ccn: string;
  readonly facilityName: string;
  readonly city: string | null;
  readonly state: string;
  readonly facilityHref: string;
  readonly ratings: {
    readonly overall: number | null;
    readonly staffing: number | null;
    readonly healthInspection: number | null;
    readonly qualityMeasure: number | null;
  };
  readonly cmsOwnershipType: string | null;
  readonly staffingQuarter: string | null;
  readonly totalNurseHprd: number | null;
  readonly rnHprd: number | null;
  readonly latestInspectionDate: string | null;
  readonly latestInspectionDeficiencyCount: number | null;
  readonly latestPenaltyType: string | null;
  readonly latestFineAmount: number | null;
  readonly chainName: string | null;
  readonly chainFacilityCount: number | null;
  readonly organizationName: string | null;
  readonly organizationHref: string | null;
  readonly organizationFacilityCount: number | null;
  readonly historyEvents?: readonly HistoryEventRecord[] | null;
  readonly historyTotalCount?: number | null;
  readonly stateIntelligence?: PublishedStateIntelligence | null;
}

export interface WorkspaceAssistedLivingFacts {
  readonly officialType: string;
  readonly licensedCapacity: number | null;
  readonly memoryLabel: string | null;
  readonly statusHeadline: string | null;
  readonly statusDetail: string;
  readonly licenseId: string | null;
  readonly regulator: string;
  readonly organizations: readonly { readonly role: string; readonly name: string }[];
}

export interface PublishedWorkspaceAssistedLivingInput {
  readonly id: string;
  readonly facilityName: string;
  readonly city: string | null;
  readonly state: string;
  readonly facilityHref: string;
  readonly officialType: string;
  readonly licensedCapacity: number | null;
  readonly memoryLabel: string | null;
  readonly statusHeadline: string | null;
  readonly statusDetail: string;
  readonly licenseId: string | null;
  readonly regulator: string;
  readonly organizations: readonly { readonly role: string; readonly name: string }[];
}

export interface WorkspaceFacilitySnapshot {
  readonly kind: "cms" | "assisted_living";
  readonly id: string;
  readonly ccn: string;
  readonly careSetting: "skilled_nursing" | "assisted_living";
  readonly facilityName: string;
  readonly city: string | null;
  readonly state: string;
  readonly facilityHref: string;
  readonly assistedLiving: WorkspaceAssistedLivingFacts | null;
  readonly ratings: PublishedWorkspaceFacilityInput["ratings"];
  readonly staffing: {
    readonly quarter: string | null;
    readonly totalNurseHprd: number | null;
    readonly rnHprd: number | null;
    readonly direction: StaffingDirectionLabel;
  };
  readonly inspections: {
    readonly latestDate: string | null;
    readonly latestDeficiencyCount: number | null;
    readonly recentComplaintInspection: boolean;
    readonly recentImportantSummary: string | null;
  };
  readonly penalties: {
    readonly hasRecordedCmsPenalty: boolean;
    readonly recentCmsPenalty: boolean;
    readonly recentSummary: string | null;
    readonly latestFineAmount: number | null;
  };
  readonly history: {
    readonly recentImportantCount: number;
    readonly highlights: readonly WorkspaceHistoryHighlight[];
    readonly coverageLabel: string | null;
    readonly historyHref: string;
  };
  readonly ownership: {
    readonly cmsOwnershipType: string | null;
    readonly chainName: string | null;
    readonly chainFacilityCount: number | null;
    readonly organizationName: string | null;
    readonly organizationHref: string | null;
    readonly organizationFacilityCount: number | null;
    readonly recentOwnershipChange: boolean;
    readonly recentSummary: string | null;
  };
  readonly stateEvidence: {
    readonly stateCode: string | null;
    readonly regulator: string | null;
    readonly licenseLabel: string | null;
    readonly licenseId: string | null;
    readonly licenseType: string | null;
    readonly licenseStatus: string | null;
    readonly hasPublishedStateEnforcement: boolean;
    readonly stateEnforcementSummary: string | null;
    readonly coverageIsNotNational: boolean;
  };
}

export interface WorkspaceDifference {
  readonly id: string;
  readonly text: string;
}

export interface FamilyWorkspaceComparison {
  readonly version: typeof FAMILY_WORKSPACE_COMPARISON_VERSION;
  readonly workspaceVersion: typeof FAMILY_WORKSPACE_VERSION;
  readonly facilities: readonly WorkspaceFacilitySnapshot[];
  readonly differences: readonly WorkspaceDifference[];
  readonly disclaimer: string;
}

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

function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function publishedStateRegulator(event: HistoryEventRecord): "CA" | "NY" | null {
  if (event.regulator === STATE_HISTORY_REGULATORS.CA) return "CA";
  if (event.regulator === STATE_HISTORY_REGULATORS.NY) return "NY";
  return null;
}

function ratingOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

export function staffingDirectionFromHistory(
  events: readonly HistoryEventRecord[],
  now = new Date(),
): StaffingDirectionLabel {
  const cutoff = recentCutoff(now);
  const latest = events
    .filter(
      (event) =>
        (event.eventType === "STAFFING_TOTAL_CHANGED" ||
          event.eventType === "STAFFING_RN_CHANGED") &&
        event.eventDate.slice(0, 10) >= cutoff,
    )
    .sort((left, right) => right.eventDate.localeCompare(left.eventDate))[0];
  if (!latest) return "insufficient comparable history";
  const previous = parseNumeric(latest.previousValue);
  const next = parseNumeric(latest.newValue);
  if (previous == null || next == null || !isMaterialStaffingChange(previous, next)) {
    return "no material recent change identified";
  }
  return next > previous ? "increased" : "decreased";
}

function recentEvents(events: readonly HistoryEventRecord[], now: Date): HistoryEventRecord[] {
  const cutoff = recentCutoff(now);
  return events
    .slice(0, HISTORY_READ_CAP)
    .filter((event) => event.eventDate.slice(0, 10) >= cutoff);
}

function snapshotFacility(
  input: PublishedWorkspaceFacilityInput,
  now: Date,
): WorkspaceFacilitySnapshot {
  const events = input.historyEvents ?? [];
  const recent = recentEvents(events, now);
  const recentImportant = recent.filter((event) => event.importance !== "LOW");
  const complaint = recent.some(
    (event) =>
      event.eventType === "INSPECTION_COMPLETED" &&
      /complaint/i.test(`${event.title} ${event.summary}`),
  );
  const inspectionHighlight = recent.find((event) => event.eventFamily === "inspection");
  const penaltyEvents = recent.filter((event) => event.eventType === "PENALTY_RECORDED");
  const ownershipChange = recent.find((event) => event.eventType === "OWNERSHIP_CHANGED");
  const publishedState = recent.filter((event) => publishedStateRegulator(event) !== null);
  const stateEnforcement = publishedState.find((event) =>
    STATE_ENFORCEMENT_TYPES.has(event.eventType),
  );
  const nyComplaint = publishedState.find(
    (event) => publishedStateRegulator(event) === "NY" && NY_COMPLAINT_TYPES.has(event.eventType),
  );
  const stateEvent = stateEnforcement ?? nyComplaint ?? null;
  const highlights = selectRecentHighlights(events, now).map((item) => ({
    title: item.title,
    summary: item.summary,
  }));

  return {
    kind: "cms",
    id: input.ccn,
    ccn: input.ccn,
    careSetting: "skilled_nursing",
    assistedLiving: null,
    facilityName: input.facilityName,
    city: input.city,
    state: input.state,
    facilityHref: input.facilityHref,
    ratings: {
      overall: ratingOrNull(input.ratings.overall),
      staffing: ratingOrNull(input.ratings.staffing),
      healthInspection: ratingOrNull(input.ratings.healthInspection),
      qualityMeasure: ratingOrNull(input.ratings.qualityMeasure),
    },
    staffing: {
      quarter: input.staffingQuarter,
      totalNurseHprd: input.totalNurseHprd,
      rnHprd: input.rnHprd,
      direction: staffingDirectionFromHistory(events, now),
    },
    inspections: {
      latestDate: input.latestInspectionDate,
      latestDeficiencyCount: input.latestInspectionDeficiencyCount,
      recentComplaintInspection: complaint,
      recentImportantSummary: inspectionHighlight?.summary ?? null,
    },
    penalties: {
      hasRecordedCmsPenalty: Boolean(input.latestPenaltyType) || penaltyEvents.length > 0,
      recentCmsPenalty: penaltyEvents.length > 0,
      recentSummary: penaltyEvents[0]?.summary ?? null,
      latestFineAmount: input.latestFineAmount,
    },
    history: {
      recentImportantCount: recentImportant.length,
      highlights,
      coverageLabel:
        input.historyTotalCount != null
          ? `${input.historyTotalCount} historical ${input.historyTotalCount === 1 ? "event" : "events"} available`
          : null,
      historyHref: `${input.facilityHref}#history`,
    },
    ownership: {
      cmsOwnershipType: input.cmsOwnershipType,
      chainName: input.chainName,
      chainFacilityCount: input.chainFacilityCount,
      organizationName: input.organizationName,
      organizationHref: input.organizationHref,
      organizationFacilityCount: input.organizationFacilityCount,
      recentOwnershipChange: Boolean(ownershipChange),
      recentSummary: ownershipChange?.summary ?? null,
    },
    stateEvidence: {
      stateCode: input.stateIntelligence?.stateCode ?? null,
      regulator: input.stateIntelligence?.regulator ?? null,
      licenseLabel: input.stateIntelligence?.licenseLabel ?? null,
      licenseId: input.stateIntelligence?.licenseId?.value ?? null,
      licenseType: input.stateIntelligence?.licenseType?.value ?? null,
      licenseStatus: input.stateIntelligence?.licenseStatus?.value ?? null,
      hasPublishedStateEnforcement: Boolean(stateEvent),
      stateEnforcementSummary: stateEvent?.summary ?? null,
      coverageIsNotNational: true,
    },
  };
}

function uniqueValues<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function countTrue(values: readonly boolean[]): number {
  return values.filter(Boolean).length;
}

export function describeWorkspaceDifferences(
  facilities: readonly WorkspaceFacilitySnapshot[],
): WorkspaceDifference[] {
  if (facilities.length < 2) return [];
  const differences: WorkspaceDifference[] = [];
  const push = (id: string, text: string) => differences.push({ id, text });

  const overall = facilities.map((item) => item.ratings.overall);
  if (uniqueValues(overall.filter((value): value is number => value != null)).length > 1) {
    push("overall_rating", "CMS overall ratings differ across these facilities.");
  } else if (overall.some((value) => value == null) && overall.some((value) => value != null)) {
    push("overall_rating_missing", "Some facilities do not have a published CMS overall rating.");
  }

  const staffing = facilities.map((item) => item.ratings.staffing);
  if (uniqueValues(staffing.filter((value): value is number => value != null)).length > 1) {
    push("staffing_rating", "Staffing ratings differ across these facilities.");
  }

  const directions = uniqueValues(facilities.map((item) => item.staffing.direction));
  if (directions.length > 1) {
    push(
      "staffing_direction",
      "Recent staffing direction is not the same across these facilities.",
    );
  }

  const recentPenalties = countTrue(facilities.map((item) => item.penalties.recentCmsPenalty));
  if (recentPenalties > 0 && recentPenalties < facilities.length) {
    push(
      "recent_penalty",
      `Recent CMS penalties appear for ${recentPenalties} of the ${facilities.length} facilities.`,
    );
  } else if (recentPenalties === facilities.length) {
    push(
      "recent_penalty",
      "Recent CMS penalties appear in the published record for each facility.",
    );
  }

  const ownershipChanges = countTrue(
    facilities.map((item) => item.ownership.recentOwnershipChange),
  );
  if (ownershipChanges === 1) {
    push("ownership_change", "One facility has a recent recorded ownership change.");
  } else if (ownershipChanges > 1 && ownershipChanges < facilities.length) {
    push(
      "ownership_change",
      `Recent recorded ownership changes appear for ${ownershipChanges} of the ${facilities.length} facilities.`,
    );
  }

  const orgs = uniqueValues(
    facilities
      .map((item) => item.ownership.organizationName)
      .filter((value): value is string => Boolean(value)),
  );
  if (orgs.length > 1) {
    push(
      "ownership_org",
      "These facilities are linked to different published ownership organizations.",
    );
  }

  const chains = uniqueValues(
    facilities
      .map((item) => item.ownership.chainName)
      .filter((value): value is string => Boolean(value)),
  );
  if (chains.length > 1) {
    push("chain", "CMS chain names differ across these facilities.");
  }

  const byState = new Map<string, WorkspaceFacilitySnapshot[]>();
  for (const facility of facilities) {
    const code = facility.stateEvidence.stateCode ?? facility.state;
    if (!code) continue;
    byState.set(code, [...(byState.get(code) ?? []), facility]);
  }
  for (const [stateCode, group] of [...byState.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (group.length < 1) continue;
    const withEnforcement = countTrue(
      group.map((item) => item.stateEvidence.hasPublishedStateEnforcement),
    );
    if (withEnforcement > 0 && (stateCode === "CA" || stateCode === "NY")) {
      const label = stateCode === "CA" ? "California" : "New York";
      push(
        `state_enforcement_${stateCode}`,
        `${label} state enforcement evidence is available for ${withEnforcement} ${
          withEnforcement === 1 ? "facility" : "facilities"
        }.`,
      );
    }
  }

  return differences;
}

function snapshotAssistedLiving(
  input: PublishedWorkspaceAssistedLivingInput,
): WorkspaceFacilitySnapshot {
  return {
    kind: "assisted_living",
    id: input.id,
    ccn: "",
    careSetting: "assisted_living",
    facilityName: input.facilityName,
    city: input.city,
    state: input.state,
    facilityHref: input.facilityHref,
    assistedLiving: {
      officialType: input.officialType,
      licensedCapacity: input.licensedCapacity,
      memoryLabel: input.memoryLabel,
      statusHeadline: input.statusHeadline,
      statusDetail: input.statusDetail,
      licenseId: input.licenseId,
      regulator: input.regulator,
      organizations: input.organizations,
    },
    ratings: { overall: null, staffing: null, healthInspection: null, qualityMeasure: null },
    staffing: {
      quarter: null,
      totalNurseHprd: null,
      rnHprd: null,
      direction: "insufficient comparable history",
    },
    inspections: {
      latestDate: null,
      latestDeficiencyCount: null,
      recentComplaintInspection: false,
      recentImportantSummary: null,
    },
    penalties: {
      hasRecordedCmsPenalty: false,
      recentCmsPenalty: false,
      recentSummary: null,
      latestFineAmount: null,
    },
    history: {
      recentImportantCount: 0,
      highlights: [],
      coverageLabel: "State inspection and enforcement history is not yet integrated.",
      historyHref: input.facilityHref,
    },
    ownership: {
      cmsOwnershipType: null,
      chainName: null,
      chainFacilityCount: null,
      organizationName: null,
      organizationHref: null,
      organizationFacilityCount: null,
      recentOwnershipChange: false,
      recentSummary: null,
    },
    stateEvidence: {
      stateCode: input.state,
      regulator: input.regulator,
      licenseLabel: "State license",
      licenseId: input.licenseId,
      licenseType: input.officialType,
      licenseStatus: input.statusHeadline,
      hasPublishedStateEnforcement: false,
      stateEnforcementSummary: null,
      coverageIsNotNational: true,
    },
  };
}

export function buildFamilyWorkspaceComparison(
  inputs: readonly PublishedWorkspaceFacilityInput[],
  now = new Date(),
  assistedLiving: readonly PublishedWorkspaceAssistedLivingInput[] = [],
): FamilyWorkspaceComparison {
  const cms = inputs.map((input) => snapshotFacility(input, now));
  const al = assistedLiving.map(snapshotAssistedLiving);
  const facilities = [...cms, ...al].slice(0, 5);
  const mixed = cms.length > 0 && al.length > 0;
  return {
    version: FAMILY_WORKSPACE_COMPARISON_VERSION,
    workspaceVersion: FAMILY_WORKSPACE_VERSION,
    facilities,
    differences: [
      ...(mixed
        ? [
            {
              id: "mixed_care_settings",
              text: "This workspace includes both nursing homes and assisted-living providers. They are regulated differently and are not ranked against one another.",
            },
          ]
        : []),
      ...describeWorkspaceDifferences(cms),
    ],
    disclaimer: FAMILY_WORKSPACE_COMPARISON_DISCLAIMER,
  };
}
