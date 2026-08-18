import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { HistoryEventRecord } from "./facility-history";
import { STATE_HISTORY_REGULATORS } from "./facility-history";
import {
  FAMILY_WORKSPACE_COMPARISON_VERSION,
  USER_ENTERED_QUOTE_LABEL,
  buildFamilyWorkspaceComparison,
  staffingDirectionFromHistory,
  type PublishedWorkspaceFacilityInput,
} from "./family-workspace-comparison";

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

function input(
  overrides: Partial<PublishedWorkspaceFacilityInput> = {},
): PublishedWorkspaceFacilityInput {
  return {
    ccn: "015009",
    facilityName: "Example Manor",
    city: "Example",
    state: "AL",
    facilityHref: "/facility/cms/015009/example-manor",
    ratings: { overall: 3, staffing: 3, healthInspection: 3, qualityMeasure: 3 },
    cmsOwnershipType: "For profit - Corporation",
    staffingQuarter: "2026Q1",
    totalNurseHprd: 3.8,
    rnHprd: 0.6,
    latestInspectionDate: "2026-01-15",
    latestInspectionDeficiencyCount: 2,
    latestPenaltyType: null,
    latestFineAmount: null,
    chainName: null,
    chainFacilityCount: null,
    organizationName: null,
    organizationHref: null,
    organizationFacilityCount: null,
    historyEvents: [],
    historyTotalCount: 0,
    stateIntelligence: null,
    ...overrides,
  };
}

describe("family workspace comparison", () => {
  it("builds a one-facility snapshot without inventing missing ratings or a score", () => {
    const comparison = buildFamilyWorkspaceComparison(
      [
        input({
          ratings: { overall: null, staffing: 4, healthInspection: null, qualityMeasure: 2 },
        }),
      ],
      NOW,
    );
    expect(comparison.version).toBe(FAMILY_WORKSPACE_COMPARISON_VERSION);
    expect(comparison.facilities).toHaveLength(1);
    expect(comparison.facilities[0]?.ratings.overall).toBeNull();
    expect(comparison.facilities[0]?.ratings.staffing).toBe(4);
    expect(comparison.facilities[0]?.ratings.overall).not.toBe(0);
    expect(comparison.differences).toEqual([]);
    expect(JSON.stringify(comparison)).not.toMatch(
      /workspace score|best facility|winner|risk score/i,
    );
  });

  it("labels staffing direction from published history only", () => {
    expect(
      staffingDirectionFromHistory(
        [
          event({
            eventType: "STAFFING_TOTAL_CHANGED",
            eventFamily: "staffing",
            previousValue: "4.10",
            newValue: "3.40",
          }),
        ],
        NOW,
      ),
    ).toBe("decreased");
    expect(staffingDirectionFromHistory([], NOW)).toBe("insufficient comparable history");
  });

  it("compares three and five facilities and describes differences without ranking", () => {
    const three = buildFamilyWorkspaceComparison(
      [
        input({
          ccn: "015009",
          ratings: { overall: 2, staffing: 2, healthInspection: 3, qualityMeasure: 3 },
          historyEvents: [
            event({
              eventType: "STAFFING_TOTAL_CHANGED",
              eventFamily: "staffing",
              previousValue: "4.10",
              newValue: "3.20",
            }),
            event({
              eventType: "PENALTY_RECORDED",
              eventFamily: "enforcement",
              importance: "HIGH",
            }),
          ],
        }),
        input({
          ccn: "015010",
          facilityName: "Second",
          ratings: { overall: 4, staffing: 4, healthInspection: 4, qualityMeasure: 4 },
          organizationName: "Other Org",
          organizationHref: "/ownership/aaaaaaa1-bbbb-4ccc-8ddd-eeeeeeeeeee1/other",
        }),
        input({
          ccn: "015012",
          facilityName: "Third",
          ratings: { overall: 4, staffing: 5, healthInspection: 3, qualityMeasure: 3 },
          historyEvents: [
            event({ eventType: "OWNERSHIP_CHANGED", eventFamily: "ownership", importance: "HIGH" }),
          ],
          organizationName: "Example Org",
        }),
      ],
      NOW,
    );
    expect(three.facilities).toHaveLength(3);
    expect(three.differences.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "overall_rating",
        "staffing_rating",
        "staffing_direction",
        "recent_penalty",
        "ownership_change",
        "ownership_org",
      ]),
    );
    expect(
      three.differences.every((item) => !/better|worse|winner|safest|best choice/i.test(item.text)),
    ).toBe(true);

    const five = buildFamilyWorkspaceComparison(
      ["015009", "015010", "015012", "055001", "335004"].map((ccn, index) =>
        input({
          ccn,
          facilityName: `Facility ${index}`,
          ratings: { overall: index + 1, staffing: 3, healthInspection: 3, qualityMeasure: 3 },
        }),
      ),
      NOW,
    );
    expect(five.facilities).toHaveLength(5);
    expect(five.differences.some((item) => item.id === "overall_rating")).toBe(true);
  });

  it("uses published CA/NY state enforcement and keeps Texas fields unpublished", () => {
    const comparison = buildFamilyWorkspaceComparison(
      [
        input({
          ccn: "055001",
          state: "CA",
          stateIntelligence: {
            stateCode: "CA",
            regulator: "California Department of Public Health",
            datasetName: "Licensed and Certified Healthcare Facility Listing",
            officialUrl: "https://example.test",
            licenseLabel: "State license",
            licenseId: {
              value: "220000001",
              resolvedAt: "2026-01-01T00:00:00.000Z",
              claimType: "STATE_LICENSE_ID",
            },
            licenseStatus: null,
            licenseType: null,
            licensedCapacity: null,
            licensee: null,
            operator: null,
            administrator: null,
            managementCompany: null,
            checkedAt: "2026-01-01T00:00:00.000Z",
            checkedLabel: "State regulatory data",
          },
          historyEvents: [
            event({
              eventType: "STATE_FINE",
              eventFamily: "state",
              regulator: STATE_HISTORY_REGULATORS.CA,
              importance: "HIGH",
              summary: "CDPH recorded a state fine.",
            }),
          ],
        }),
        input({
          ccn: "675001",
          state: "TX",
          facilityName: "Texas Example",
          historyEvents: [
            event({
              eventType: "STATE_FINE",
              eventFamily: "state",
              regulator: STATE_HISTORY_REGULATORS.TX,
              importance: "HIGH",
            }),
          ],
        }),
      ],
      NOW,
    );
    const ca = comparison.facilities.find((item) => item.ccn === "055001");
    const tx = comparison.facilities.find((item) => item.ccn === "675001");
    expect(ca?.stateEvidence.hasPublishedStateEnforcement).toBe(true);
    expect(tx?.stateEvidence.hasPublishedStateEnforcement).toBe(false);
    expect(comparison.differences.some((item) => item.id === "state_enforcement_CA")).toBe(true);
    expect(JSON.stringify(comparison)).not.toMatch(/REVIEW_REQUIRED|PROBABLE|unresolved/i);
  });

  it("does not create a Google or score path", () => {
    const source = readFileSync(path.join(__dirname, "family-workspace-comparison.ts"), "utf8");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(/workspace score|best facility|family match/i);
    expect(USER_ENTERED_QUOTE_LABEL).toBe("User-entered quote");
  });
});
