import { describe, expect, it } from "vitest";
import {
  deriveRatingChange,
  deriveStaffingChange,
  eventFamilyForType,
  filterHistoryEvents,
  groupHistoryByYear,
  historyCoverageLabel,
  inspectionConsumerTitle,
  inspectionImportance,
  inspectionSummary,
  isMaterialStaffingChange,
  isSafeOrganizationName,
  ownershipSummary,
  penaltyEvent,
  recentChangesFallback,
  selectRecentHighlights,
  shouldPublishInspectionType,
  type HistoryEventRecord,
} from "./facility-history";

const event = (overrides: Partial<HistoryEventRecord> = {}): HistoryEventRecord => ({
  id: "1",
  eventType: "INSPECTION_COMPLETED",
  eventFamily: "inspection",
  eventDate: "2026-05-14",
  datePrecision: "day",
  dateBasis: "occurred",
  importance: "MEDIUM",
  title: "Health inspection completed",
  summary: "8 deficiencies were recorded.",
  previousValue: null,
  newValue: null,
  evidenceHref: "#inspections",
  sourceDatasetName: "Nursing Home Inspection Dates",
  sourceRecordLocator: "row:1",
  ...overrides,
});

describe("facility history derivation", () => {
  it("creates rating-change events only when both values are valid and different", () => {
    expect(deriveRatingChange({ kind: "overall", previous: 3, next: 4 })?.title).toMatch(
      /Overall CMS rating/,
    );
    expect(deriveRatingChange({ kind: "overall", previous: 3, next: 3 })).toBeNull();
    expect(deriveRatingChange({ kind: "overall", previous: null, next: 4 })).toBeNull();
    expect(deriveRatingChange({ kind: "overall", previous: 3, next: null })).toBeNull();
    expect(deriveRatingChange({ kind: "overall", previous: 0, next: 3 })).toBeNull();
  });

  it("suppresses tiny staffing movement and keeps material changes", () => {
    expect(isMaterialStaffingChange(3.5, 3.51)).toBe(false);
    expect(isMaterialStaffingChange(3.5, 3.8)).toBe(true);
    const derived = deriveStaffingChange({
      measure: "rn",
      previous: 0.8,
      next: 0.5,
      previousQuarter: "2025Q4",
      nextQuarter: "2026Q1",
    });
    expect(derived?.title).toBe("RN staffing decreased");
    expect(derived?.summary).toMatch(/declined/);
    expect(
      deriveStaffingChange({
        measure: "total",
        previous: 3.5,
        next: 3.52,
        previousQuarter: "2025Q4",
        nextQuarter: "2026Q1",
      }),
    ).toBeNull();
  });

  it("groups inspection language and excludes routine fire-safety standards", () => {
    expect(inspectionConsumerTitle("Health Standard")).toBe("Health inspection completed");
    expect(inspectionConsumerTitle("Health Complaint")).toBe("Complaint inspection recorded");
    expect(shouldPublishInspectionType("Fire Safety Standard")).toBe(false);
    expect(shouldPublishInspectionType("Health Standard")).toBe(true);
    expect(inspectionImportance("J")).toBe("HIGH");
    expect(inspectionImportance("D")).toBe("MEDIUM");
    expect(
      inspectionSummary({
        surveyType: "Health Standard",
        deficiencyCount: 8,
        higherSeverityCount: 1,
      }),
    ).toMatch(/8 deficiencies were recorded.*1 higher-severity deficiency/);
  });

  it("keeps penalty amounts and does not dramatize", () => {
    const fine = penaltyEvent({ penaltyType: "Fine", fineAmount: 24500, paymentDenialDays: null });
    expect(fine.title).toBe("Civil monetary penalty recorded");
    expect(fine.summary).toContain("$24,500");
    expect(fine.importance).toBe("HIGH");
    expect(fine.summary).not.toMatch(/dangerous|unsafe|bad/i);
  });

  it("summarizes ownership without publishing personal names", () => {
    expect(isSafeOrganizationName("ABC Healthcare LLC")).toBe(true);
    expect(isSafeOrganizationName("SMITH, JANE")).toBe(false);
    expect(ownershipSummary("ABC Healthcare LLC")).toContain(
      "New organization: ABC Healthcare LLC",
    );
    expect(ownershipSummary("SMITH, JANE")).toBe("CMS recorded a change of ownership.");
  });

  it("sorts newest first by year and does not invent a score", () => {
    const grouped = groupHistoryByYear([
      event({ id: "old", eventDate: "2025-08-19" }),
      event({ id: "new", eventDate: "2026-05-14" }),
    ]);
    expect(grouped.map((group) => group.year)).toEqual(["2026", "2025"]);
    expect(historyCoverageLabel(12)).toBe("12 historical events available");
    expect(historyCoverageLabel(0)).toMatch(/Limited historical data/);
    expect(JSON.stringify(grouped)).not.toMatch(/Trust Score|risk score|grade/i);
  });

  it("builds deterministic recent highlights and a neutral empty state", () => {
    const highlights = selectRecentHighlights(
      [
        event({
          eventFamily: "staffing",
          title: "Total nurse staffing increased",
          eventDate: "2026-03-31",
        }),
        event({
          eventFamily: "inspection",
          title: "Health inspection completed",
          eventDate: "2026-05-14",
        }),
        event({ eventFamily: "staffing", title: "RN staffing decreased", eventDate: "2026-01-01" }),
      ],
      new Date("2026-08-18T00:00:00Z"),
    );
    expect(highlights).toHaveLength(2);
    expect(highlights[0]?.title).toBe("Total nurse staffing increased");
    expect(selectRecentHighlights([], new Date("2026-08-18T00:00:00Z"))).toEqual([]);
    expect(recentChangesFallback()).toMatch(/No major recent changes/);
    expect(recentChangesFallback()).not.toMatch(/no issues/i);
  });

  it("filters families without mixing ownership into inspections", () => {
    const events = [
      event({ eventFamily: "inspection" }),
      event({
        id: "own",
        eventFamily: "ownership",
        eventType: "OWNERSHIP_CHANGED",
        title: "Ownership change recorded",
      }),
    ];
    expect(filterHistoryEvents(events, "ownership")).toHaveLength(1);
    expect(filterHistoryEvents(events, "inspection")[0]?.eventFamily).toBe("inspection");
    expect(eventFamilyForType("PENALTY_RECORDED")).toBe("enforcement");
    expect(eventFamilyForType("STATE_FINE")).toBe("state");
  });
});
