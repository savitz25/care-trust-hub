import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONSUMER_PUBLISHABLE_CLAIM_TYPES,
  isConsumerPublishableClaim,
} from "./enrichment-publication";
import {
  CO_LOCKED,
  CO_PUBLIC_FINGERPRINT,
  CO_PUBLIC_PATH,
  CO_SOURCE_CATALOG,
  assertCoIntelligence,
  coTraceMetrics,
} from "./co-intelligence";
import { CO_PUBLIC_SNAPSHOT } from "./co-public-snapshot";

const dir = dirname(fileURLToPath(import.meta.url));

describe("CO-SEN-001 public snapshot", () => {
  it("keeps Nursing Home, Home Health, and Hospice as separate CMS overlays", () => {
    const snap = assertCoIntelligence();
    expect(snap.cmsOverlay.nursingHomes).toBe(210);
    expect(snap.cmsOverlay.homeHealth).toBe(222);
    expect(snap.cmsOverlay.hospice).toBe(88);
    expect(snap.cmsOverlay.nursingHomes).not.toBe(snap.cmsOverlay.homeHealth);
    expect(snap.cmsOverlay.homeHealth).not.toBe(snap.cmsOverlay.hospice);
    expect(snap.cmsOverlay.nursingHomes).not.toBe(snap.cmsOverlay.hospice);
    expect(snap.cmsOverlay.liveDirectoryCoUniqueCcn.nursingHomes).toBe(210);
    expect(snap.cmsOverlay.liveDirectoryCoUniqueCcn.homeHealth).toBe(222);
    expect(snap.cmsOverlay.liveDirectoryCoUniqueCcn.hospice).toBe(88);
    expect(JSON.stringify(snap.guardrails)).toMatch(/NURSING HOME != HOME HEALTH != HOSPICE/);
  });

  it("keeps Assisted Living Residence separate from Nursing Home", () => {
    const snap = assertCoIntelligence();
    expect(snap.assistedLiving.officialName).toBe("Assisted Living Residence");
    expect(snap.assistedLiving.count).toBeNull();
    expect(snap.crosswalk.alrToCmsNh.attempted).toBe(false);
    expect(JSON.stringify(snap.guardrails)).toMatch(/ALR != NURSING HOME/);
    const nf = snap.regulatorMap.classes.find((row) => row.code === "NF");
    const alr = snap.regulatorMap.classes.find((row) => row.code === "ALR");
    expect(nf?.officialName).toBe("Nursing Care Facility");
    expect(alr?.officialName).toBe("Assisted Living Residence");
    expect(nf?.count).not.toBe(alr?.count);
  });

  it("treats Nursing Home Administrator as person-grain, not a facility", () => {
    const snap = assertCoIntelligence();
    expect(snap.nursingHomeAdministrator.grain).toBe("PERSON");
    expect(snap.nursingHomeAdministrator.notAFacilityCount).toBe(true);
    expect(snap.nursingHomeAdministrator.countPublished).toBeNull();
    expect(snap.nursingHomeAdministrator.publication).toBe("NO_PERSON_PAGES");
    expect(JSON.stringify(snap.guardrails)).toMatch(/NHA != FACILITY/);
  });

  it("preserves CMS CCN and refuses state-license equals CCN unless exact", () => {
    const snap = assertCoIntelligence();
    expect(snap.crosswalk.cmsCcnPreserved).toBe(true);
    expect(snap.crosswalk.policy).toMatch(/EXACT_OFFICIAL_ID/);
    expect(snap.crosswalk.stateNfToCmsNh.attempted).toBe(false);
    expect(JSON.stringify(snap.guardrails)).toMatch(/STATE LICENSE != CMS CCN UNLESS EXACT/);
  });

  it("does not publish a combined Colorado provider denominator", () => {
    const snap = assertCoIntelligence();
    const combined =
      snap.cmsOverlay.nursingHomes + snap.cmsOverlay.homeHealth + snap.cmsOverlay.hospice;
    expect(snap.noCombinedDenominator).toBe(true);
    expect(JSON.stringify(snap)).not.toContain(`"coloradoSeniorProviders":${combined}`);
    expect(JSON.stringify(snap)).not.toMatch(/Colorado senior providers/i);
    expect(CO_SOURCE_CATALOG.some((row) => /combined/i.test(row.id))).toBe(false);
  });

  it("keeps CDPHE live verification as search/path and does not treat search-only as zero", () => {
    const snap = assertCoIntelligence();
    expect(snap.cdpheVerification.coverage).toBe("OPEN_SEARCH_ONLY");
    expect(snap.cdpheVerification.completeCurrentUniverse).toBe("UNKNOWN_SEARCH_ONLY");
    expect(snap.cdpheVerification.searchOnlyIsNotZero).toBe(true);
    expect(snap.cdpheVerification.scrape).toBe("FORBIDDEN");
    const traces = coTraceMetrics(snap);
    expect(traces.find((row) => row.id === "cdphe-universe")?.value).toBeNull();
    expect(traces.find((row) => row.id === "cdphe-universe")?.coverageState).toBe(
      "OPEN_SEARCH_ONLY",
    );
    expect(JSON.stringify(snap.guardrails)).toMatch(/SEARCH-ONLY != ZERO/);
  });

  it("blocks 2017 GIS promotion to current identity or current roster", () => {
    const snap = assertCoIntelligence();
    expect(snap.staleGis2017.id).toBe("98pp-s4r4");
    expect(snap.staleGis2017.coverage).toBe("HISTORICAL_STALE");
    expect(snap.staleGis2017.cannotPromoteToCurrentIdentity).toBe(true);
    expect(snap.staleGis2017.cannotUseAsCurrentRoster).toBe(true);
    expect(snap.staleGis2017.agencyClock).toBe("January 2017");
    expect(JSON.stringify(snap.guardrails)).toMatch(/2017 GIS IS NOT A CURRENT ROSTER/);
  });

  it("rejects approximate assisted-living press counts as network metrics", () => {
    const snap = assertCoIntelligence();
    expect(snap.assistedLiving.pressCountUsed).toBe(false);
    expect(snap.assistedLiving.pressCountRejected).toBe(675);
    expect(snap.assistedLiving.count).toBeNull();
    expect(CO_LOCKED.pressAlrRejected).toBe(675);
    expect(JSON.stringify(snap.cmsOverlay)).not.toContain("675");
  });

  it("keeps complaint process, occurrence, citation, and name-only attach distinct", () => {
    const snap = assertCoIntelligence();
    expect(snap.complaints.coverage).toBe("PUBLIC_RESEARCH_PATH");
    expect(snap.complaints.bulk).toBe("NOT_ACQUIRED");
    expect(snap.complaints.complaintProcessIsNotComplaintDataset).toBe(true);
    expect(snap.inspections.occurrenceIsNotViolation).toBe(true);
    expect(snap.inspections.citationIsNotPenalty).toBe(true);
    expect(snap.inspections.planOfCorrectionIsNotAdmission).toBe(true);
    expect(snap.inspections.nameOnlyAdverseAttach).toBe("UNSAFE");
    expect(JSON.stringify(snap.guardrails)).toMatch(/COMPLAINT PROCESS != COMPLAINT DATASET/);
    expect(JSON.stringify(snap.guardrails)).toMatch(/OCCURRENCE != VIOLATION/);
    expect(JSON.stringify(snap.guardrails)).toMatch(/CITATION != PENALTY/);
    expect(JSON.stringify(snap.guardrails)).toMatch(/NO NAME-ONLY ADVERSE ATTACHMENT/);
  });

  it("publishes /colorado statewide only, with no Trust Score, ranking, or AggregateRating", () => {
    const snap = assertCoIntelligence();
    expect(CO_PUBLIC_PATH).toBe("/colorado");
    expect(snap.publicationPath).toBe("/colorado");
    expect(snap.noCountyRoutes).toBe(true);
    expect(snap.noCityRoutes).toBe(true);
    expect(snap.noDenverPage).toBe(true);
    expect(snap.statewideOnly).toBe(true);
    expect(snap.noTrustScore).toBe(true);
    expect(snap.noRanking).toBe(true);
    expect(snap.noAggregateRating).toBe(true);
    expect(JSON.stringify(snap)).toContain("NO TRUST SCORE");
    expect(JSON.stringify(snap)).toContain("NO AGGREGATE RATING");
    expect(JSON.stringify(snap)).not.toMatch(/best facility|worst facility/i);
    expect(JSON.stringify(snap)).not.toMatch(/"@type"\s*:\s*"AggregateRating"/);
  });

  it("does not broaden claim eligibility: search != eligibility and claimed != verified", () => {
    const snap = assertCoIntelligence();
    expect(snap.claimEligibility.broadened).toBe(false);
    expect(snap.claimEligibility.searchResultIsNotEligibility).toBe(true);
    expect(snap.claimEligibility.claimedIsNotVerified).toBe(true);
    expect(CONSUMER_PUBLISHABLE_CLAIM_TYPES).toEqual([
      "google_official_website",
      "google_public_phone",
      "google_public_name",
    ]);
    expect(
      isConsumerPublishableClaim({
        claimType: "google_official_website",
        resolutionState: "UNRESOLVED",
        publicationEligible: true,
        value: "https://example.com",
        resolvedAt: "2026-09-09T00:00:00Z",
      }),
    ).toBe(false);
  });

  it("does not create state-only ALR profiles without safe identity", () => {
    const snap = assertCoIntelligence();
    expect(snap.publicationDecisions.ASSISTED_LIVING_RESIDENCE).toBe(
      "NO_STATE_ONLY_PROFILES_WITHOUT_SAFE_IDENTITY",
    );
    expect(snap.assistedLiving.profilePublication).toBe(
      "NO_STATE_ONLY_PROFILES_WITHOUT_SAFE_IDENTITY",
    );
    expect(snap.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS).toBe(0);
    expect(snap.expansionLedger.NET_NEW_STATE_IDENTITIES).toBe(0);
  });

  it("matches the artifact fingerprint and traces CMS and CDPHE clocks", () => {
    const artifact = JSON.parse(
      readFileSync(join(dir, "../../../artifacts/co-sen-001-public-snapshot.json"), "utf8"),
    ) as { fingerprint: string; version: string };
    expect(artifact.fingerprint).toBe(CO_PUBLIC_FINGERPRINT);
    expect(CO_PUBLIC_SNAPSHOT.fingerprint).toBe(artifact.fingerprint);
    expect(artifact.version).toBe("senior-co-state-intel-v1");
    const traces = coTraceMetrics();
    expect(traces.find((row) => row.id === "cms-nh-overlay")?.value).toBe(210);
    expect(traces.find((row) => row.id === "alr-count")?.value).toBeNull();
    expect(CO_SOURCE_CATALOG.map((row) => row.id)).toEqual([
      "cms-nh",
      "cms-hha",
      "cms-hospice",
      "cdphe-find-and-compare",
      "cdphe-alr",
      "cdphe-hca",
      "stale-gis-2017",
      "complaints",
      "dora-nha",
      "cms-inspection",
      "cms-ownership",
    ]);
    expect(CO_SOURCE_CATALOG.find((row) => row.id === "cdphe-find-and-compare")?.rows).toBeNull();
    expect(CO_SOURCE_CATALOG.find((row) => row.id === "stale-gis-2017")?.coverage).toBe(
      "HISTORICAL_STALE",
    );
  });
});
