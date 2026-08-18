import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { HistoryEventRecord } from "./facility-history";
import { HISTORY_READ_CAP, STATE_HISTORY_REGULATORS } from "./facility-history";
import {
  ASSISTED_LIVING_MEMORY_TRANSPARENCY,
  HOME_CARE_TRANSPARENCY,
  INTERVIEW_BUILDER_VERSION,
  INTERVIEW_MAX_QUESTIONS,
  INTERVIEW_MIN_QUESTIONS,
  INTERVIEW_QUESTION_LIBRARY,
  buildInterviewChecklist,
  deriveFacilityInterviewEvidence,
  firedEvidenceTriggers,
  type PublishedFacilityInterviewEvidence,
} from "./interview-builder";

const NOW = new Date("2026-08-18T12:00:00.000Z");

function event(
  partial: Partial<HistoryEventRecord> & Pick<HistoryEventRecord, "eventType" | "eventFamily">,
): HistoryEventRecord {
  return {
    id: partial.id ?? `${partial.eventType}-1`,
    eventType: partial.eventType,
    eventFamily: partial.eventFamily,
    eventDate: partial.eventDate ?? "2026-03-01",
    datePrecision: partial.datePrecision ?? "day",
    dateBasis: partial.dateBasis ?? "occurred",
    importance: partial.importance ?? "MEDIUM",
    title: partial.title ?? "Published event",
    summary: partial.summary ?? "Published summary.",
    previousValue: partial.previousValue ?? null,
    newValue: partial.newValue ?? null,
    evidenceHref: partial.evidenceHref ?? "#history",
    sourceDatasetName: partial.sourceDatasetName ?? "published_facility_history_event",
    sourceRecordLocator: partial.sourceRecordLocator ?? "row-1",
    sourceLabel: partial.sourceLabel ?? "CMS",
    regulator: partial.regulator ?? null,
  };
}

function evidence(
  overrides: Partial<PublishedFacilityInterviewEvidence> = {},
): PublishedFacilityInterviewEvidence {
  return {
    facilityName: "Example Skilled Nursing",
    ccn: "01A193",
    cmsStaffingRating: 4,
    latestStaffingChangeDirection: null,
    hasRecentInspectionDeficiencies: false,
    recentInspectionCount: 0,
    hasRecentCmsPenalty: false,
    recentPenaltyCount: 0,
    hasRecentOwnershipChange: false,
    isMultiFacilityOrganization: false,
    organizationFacilityCount: 1,
    hasPublishedStateEnforcement: false,
    stateEnforcementRegulator: null,
    hasPublishedNyComplaintInspection: false,
    ...overrides,
  };
}

const BANNED_COPY =
  /red flag|dangerous facility|bad owner|suspicious facility|understaffed|don't choose|do not choose|avoid this facility|risk score|tour score|interview score/i;

describe("facility interview builder v1", () => {
  it("A: generic SNF checklist stays in range without facility evidence or a score", () => {
    const checklist = buildInterviewChecklist({ careSetting: "skilled_nursing" });
    expect(checklist.version).toBe(INTERVIEW_BUILDER_VERSION);
    expect(checklist.mode).toBe("general");
    expect(checklist.questions.length).toBeGreaterThanOrEqual(INTERVIEW_MIN_QUESTIONS);
    expect(checklist.questions.length).toBeLessThanOrEqual(INTERVIEW_MAX_QUESTIONS);
    expect(checklist.mustAsk.length).toBeGreaterThan(0);
    expect(checklist.mustAsk.length).toBeLessThanOrEqual(8);
    expect(checklist.firedEvidenceTriggers).toEqual([]);
    expect(checklist.transparencyNote).toBeNull();
    expect(checklist).not.toHaveProperty("score");
    expect(JSON.stringify(checklist)).not.toMatch(
      /best facility|tour score|interview score|risk score/i,
    );
    expect(checklist.questions.every((question) => !question.evidenceBasis)).toBe(true);
  });

  it("B: SNF staffing concerns raise staffing questions without transferring diagnoses", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      concernTags: ["staffing"],
    });
    const staffing = checklist.questions.filter((question) => question.category === "staffing");
    expect(staffing.length).toBeGreaterThan(0);
    expect(staffing.some((question) => question.priority === "MUST_ASK")).toBe(true);
    expect(JSON.stringify(checklist)).not.toMatch(
      /this person has dementia|diagnosed with|alzheimer's disease/i,
    );
  });

  it("C: assisted living stays general and discloses missing national evidence", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "assisted_living",
      concernTags: ["cost", "personal_care"],
      facilityEvidence: evidence({ hasRecentCmsPenalty: true }),
    });
    expect(checklist.mode).toBe("general");
    expect(checklist.firedEvidenceTriggers).toEqual([]);
    expect(checklist.transparencyNote).toBe(ASSISTED_LIVING_MEMORY_TRANSPARENCY);
    expect(checklist.questions.some((question) => question.id.startsWith("ev-"))).toBe(false);
    expect(
      checklist.questions.some((question) => /level-of-care|rate change/i.test(question.text)),
    ).toBe(true);
  });

  it("D: memory care is general guidance without a provider directory claim", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "memory_care",
      concernTags: ["memory"],
    });
    expect(checklist.transparencyNote).toBe(ASSISTED_LIVING_MEMORY_TRANSPARENCY);
    expect(checklist.questions.some((question) => question.category === "memory")).toBe(true);
    expect(JSON.stringify(checklist)).not.toMatch(
      /verified memory-care directory|national provider evidence is complete/i,
    );
  });

  it("E: home-care agency interviews stay general and do not invent a directory", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "home_care",
      concernTags: ["staffing", "cost"],
    });
    expect(checklist.questions.length).toBeGreaterThanOrEqual(INTERVIEW_MIN_QUESTIONS);
    expect(checklist.transparencyNote).toBe(HOME_CARE_TRANSPARENCY);
    expect(checklist.mode).toBe("general");
    expect(JSON.stringify(checklist)).not.toMatch(
      /we confirmed this agency|verified this agency|home-care directory lists/i,
    );
  });

  it("F: staffing decline adds one evidence question with a public-record basis", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      facilityEvidence: evidence({ latestStaffingChangeDirection: "decrease" }),
    });
    const staffing = checklist.questions.filter(
      (question) => question.id === "ev-staffing-decline",
    );
    expect(staffing).toHaveLength(1);
    expect(staffing[0]?.evidenceBasis?.trigger).toBe("staffing_decline");
    expect(staffing[0]?.evidenceBasis?.summary).toMatch(/CMS data shows nurse staffing declined/i);
    expect(staffing[0]?.evidenceBasis?.evidencePathHint).toBe("staffing");
    expect(
      checklist.questions.filter(
        (question) => question.evidenceBasis?.trigger === "staffing_decline",
      ),
    ).toHaveLength(1);
  });

  it("G: a recent penalty adds a penalty question without accusing the owner", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      facilityEvidence: evidence({ hasRecentCmsPenalty: true, recentPenaltyCount: 1 }),
    });
    const penalty = checklist.questions.find((question) => question.id === "ev-recent-penalty");
    expect(penalty?.evidenceBasis?.evidencePathHint).toBe("penalties");
    expect(penalty?.text).toMatch(/public record/i);
    expect(`${penalty?.text} ${penalty?.whyAsk}`).not.toMatch(BANNED_COPY);
  });

  it("H: ownership change and multi-facility org add at most two ownership evidence questions", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      facilityEvidence: evidence({
        hasRecentOwnershipChange: true,
        isMultiFacilityOrganization: true,
        organizationFacilityCount: 12,
      }),
    });
    const ownershipEvidence = checklist.questions.filter(
      (question) =>
        question.evidenceBasis?.trigger === "ownership_change" ||
        question.evidenceBasis?.trigger === "multi_facility_org",
    );
    expect(ownershipEvidence.length).toBeGreaterThan(0);
    expect(ownershipEvidence.length).toBeLessThanOrEqual(2);
    expect(
      ownershipEvidence.every(
        (question) => question.evidenceBasis?.evidencePathHint === "ownership",
      ),
    ).toBe(true);
  });

  it("I: published CA/NY state enforcement adds a state question", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      facilityEvidence: evidence({
        hasPublishedStateEnforcement: true,
        stateEnforcementRegulator: "CA_CDPH",
      }),
    });
    const stateQuestion = checklist.questions.find(
      (question) => question.id === "ev-state-enforcement",
    );
    expect(stateQuestion?.evidenceBasis?.evidencePathHint).toBe("state");
    expect(checklist.firedEvidenceTriggers).toContain("state_enforcement");
  });

  it("J: a facility with little recent concern evidence still returns useful general questions", () => {
    const derived = deriveFacilityInterviewEvidence({
      facilityName: "Quiet Facility",
      ccn: "22A000",
      cmsStaffingRating: 4,
      historyEvents: [
        event({
          eventType: "OVERALL_RATING_CHANGED",
          eventFamily: "rating",
          eventDate: "2026-01-15",
          previousValue: "3",
          newValue: "4",
        }),
      ],
      currentOrganizationFacilityCount: 1,
      now: NOW,
    });
    expect(firedEvidenceTriggers(derived)).toEqual([]);
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      facilityEvidence: derived,
    });
    expect(checklist.mode).toBe("facility");
    expect(checklist.questions.length).toBeGreaterThanOrEqual(INTERVIEW_MIN_QUESTIONS);
    expect(checklist.questions.some((question) => question.evidenceBasis)).toBe(false);
    expect(checklist.mustAsk.length).toBeGreaterThan(0);
  });
});

describe("published evidence derivation safety", () => {
  it("treats a material staffing decrease as a decline and ignores an increase", () => {
    const decline = deriveFacilityInterviewEvidence({
      facilityName: "Example",
      ccn: "01A193",
      cmsStaffingRating: 3,
      historyEvents: [
        event({
          eventType: "STAFFING_TOTAL_CHANGED",
          eventFamily: "staffing",
          eventDate: "2026-04-01",
          previousValue: "4.10",
          newValue: "3.40",
        }),
      ],
      now: NOW,
    });
    expect(decline.latestStaffingChangeDirection).toBe("decrease");
    expect(firedEvidenceTriggers(decline)).toContain("staffing_decline");

    const increase = deriveFacilityInterviewEvidence({
      facilityName: "Example",
      ccn: "01A193",
      cmsStaffingRating: 3,
      historyEvents: [
        event({
          eventType: "STAFFING_TOTAL_CHANGED",
          eventFamily: "staffing",
          eventDate: "2026-04-01",
          previousValue: "3.40",
          newValue: "4.10",
        }),
      ],
      now: NOW,
    });
    expect(increase.latestStaffingChangeDirection).toBe("increase");
    expect(firedEvidenceTriggers(increase)).not.toContain("staffing_decline");
  });

  it("does not treat a clean inspection or a missing staffing rating as a concern", () => {
    const derived = deriveFacilityInterviewEvidence({
      facilityName: "Example",
      ccn: "01A193",
      cmsStaffingRating: null,
      historyEvents: [
        event({
          eventType: "INSPECTION_COMPLETED",
          eventFamily: "inspection",
          eventDate: "2026-02-01",
          summary: "No linked health-deficiency findings were recorded for this survey.",
        }),
      ],
      now: NOW,
    });
    expect(derived.hasRecentInspectionDeficiencies).toBe(false);
    expect(derived.cmsStaffingRating).toBeNull();
    expect(firedEvidenceTriggers(derived)).toEqual([]);
  });

  it("ignores Texas and unpublished-looking state events", () => {
    const derived = deriveFacilityInterviewEvidence({
      facilityName: "Example",
      ccn: "01A193",
      cmsStaffingRating: 3,
      historyEvents: [
        event({
          eventType: "STATE_FINE",
          eventFamily: "state",
          eventDate: "2026-05-01",
          regulator: STATE_HISTORY_REGULATORS.TX,
        }),
        event({
          eventType: "STATE_ENFORCEMENT",
          eventFamily: "state",
          eventDate: "2026-05-02",
          regulator: null,
        }),
      ],
      now: NOW,
    });
    expect(derived.hasPublishedStateEnforcement).toBe(false);
    expect(derived.stateEnforcementRegulator).toBeNull();
    expect(firedEvidenceTriggers(derived)).not.toContain("state_enforcement");
  });

  it("fires NY complaint inspections and CA published enforcement only", () => {
    const ny = deriveFacilityInterviewEvidence({
      facilityName: "NY Example",
      ccn: "33A000",
      cmsStaffingRating: 3,
      historyEvents: [
        event({
          eventType: "STATE_COMPLAINT_INSPECTION",
          eventFamily: "state",
          eventDate: "2026-06-01",
          regulator: STATE_HISTORY_REGULATORS.NY,
        }),
      ],
      now: NOW,
    });
    expect(ny.hasPublishedNyComplaintInspection).toBe(true);
    expect(firedEvidenceTriggers(ny)).toContain("state_enforcement");

    const ca = deriveFacilityInterviewEvidence({
      facilityName: "CA Example",
      ccn: "05A000",
      cmsStaffingRating: 3,
      historyEvents: [
        event({
          eventType: "STATE_FINE",
          eventFamily: "state",
          eventDate: "2026-06-01",
          regulator: STATE_HISTORY_REGULATORS.CA,
        }),
      ],
      now: NOW,
    });
    expect(ca.hasPublishedStateEnforcement).toBe(true);
    expect(ca.stateEnforcementRegulator).toBe("CA_CDPH");
  });

  it("caps history input and does not invent a multi-facility concern from a missing count", () => {
    const many = Array.from({ length: HISTORY_READ_CAP + 20 }, (_, index) =>
      event({
        id: `extra-${index}`,
        eventType: "OVERALL_RATING_CHANGED",
        eventFamily: "rating",
        eventDate: "2026-01-01",
      }),
    );
    const derived = deriveFacilityInterviewEvidence({
      facilityName: "Example",
      ccn: "01A193",
      cmsStaffingRating: 3,
      historyEvents: many,
      currentOrganizationFacilityCount: null,
      now: NOW,
    });
    expect(derived.isMultiFacilityOrganization).toBe(false);
    expect(derived.organizationFacilityCount).toBeNull();
  });

  it("does not create a low-staffing trigger from a 3-star or higher rating", () => {
    expect(firedEvidenceTriggers(evidence({ cmsStaffingRating: 3 }))).not.toContain(
      "low_staffing_rating",
    );
    expect(firedEvidenceTriggers(evidence({ cmsStaffingRating: 2 }))).toContain(
      "low_staffing_rating",
    );
  });
});

describe("library and copy safety", () => {
  it("keeps every library question free of scores, Google, and fear-based copy", () => {
    const source = [
      readFileSync(path.join(__dirname, "interview-questions.ts"), "utf8"),
      readFileSync(path.join(__dirname, "interview-builder.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(BANNED_COPY);
    expect(
      INTERVIEW_QUESTION_LIBRARY.every(
        (question) => question.id && question.text && question.whyAsk,
      ),
    ).toBe(true);
    expect(
      INTERVIEW_QUESTION_LIBRARY.filter((question) => question.evidenceTrigger).every((question) =>
        question.careSettings.every(
          (setting) => setting === "skilled_nursing" || setting === "short_term_rehab",
        ),
      ),
    ).toBe(true);
  });

  it("does not dump one inspection into many what-went-wrong questions", () => {
    const checklist = buildInterviewChecklist({
      careSetting: "skilled_nursing",
      facilityEvidence: evidence({
        hasRecentInspectionDeficiencies: true,
        recentInspectionCount: 8,
      }),
    });
    expect(
      checklist.questions.filter(
        (question) => question.evidenceBasis?.trigger === "recent_inspection",
      ),
    ).toHaveLength(1);
  });
});
