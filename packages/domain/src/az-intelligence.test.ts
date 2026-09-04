import { describe, expect, it } from "vitest";
import {
  AZ_LOCKED,
  AZ_PUBLIC_FINGERPRINT,
  AZ_PUBLIC_PATH,
  AZ_SOURCE_CATALOG,
  assertAzIntelligence,
  azTraceMetrics,
} from "./az-intelligence";
import { AZ_PUBLIC_SNAPSHOT } from "./az-public-snapshot";

describe("AZ-SEN-001 public snapshot", () => {
  it("keeps Assisted Living Home, Center, and Adult Foster Care separate", () => {
    const snap = assertAzIntelligence();
    expect(snap.fingerprint).toBe(AZ_PUBLIC_FINGERPRINT);
    expect(snap.assistedLivingHomes.rows).toBe(1719);
    expect(snap.assistedLivingCenters.rows).toBe(328);
    expect(snap.adultFosterCare.rows).toBe(25);
    expect(snap.adultDayHealth.rows).toBe(15);
    expect(snap.assistedLivingHomes.unique_license).toBe(1719);
    expect(snap.assistedLivingHomes.unique_names).toBeLessThan(snap.assistedLivingHomes.rows);
    const combined =
      snap.assistedLivingHomes.rows +
      snap.assistedLivingCenters.rows +
      snap.adultFosterCare.rows +
      snap.cmsOverlay.nursingHomes +
      snap.cmsOverlay.homeHealth +
      snap.cmsOverlay.hospice;
    expect(JSON.stringify(snap)).not.toContain(`"arizonaSeniorProviders":${combined}`);
    expect(JSON.stringify(snap)).toContain("NO TRUST SCORE");
    expect(JSON.stringify(snap)).not.toMatch(/best facility|worst facility/i);
  });

  it("reconciles CMS Arizona overlays to live unique CCN sets", () => {
    const snap = assertAzIntelligence();
    expect(snap.cmsOverlay.nursingHomes).toBe(140);
    expect(snap.cmsOverlay.homeHealth).toBe(177);
    expect(snap.cmsOverlay.hospice).toBe(237);
    expect(snap.cmsOverlay.liveDirectoryAzUniqueCcn.nursingHomes).toBe(140);
    expect(snap.cmsOverlay.liveDirectoryAzUniqueCcn.homeHealth).toBe(177);
    expect(snap.cmsOverlay.liveDirectoryAzUniqueCcn.hospice).toBe(237);
    expect(snap.preIngestBaseline.cmsNursingHomeCcns).toBe(140);
  });

  it("joins state nursing homes to CMS only on exact MEDICARE_ID", () => {
    const snap = assertAzIntelligence();
    expect(snap.stateNursingHomes.rows).toBe(141);
    expect(snap.stateNursingHomes.unique_license).toBe(138);
    expect(snap.crosswalk.stateNhToCmsNh.exact_matches).toBe(140);
    expect(snap.crosswalk.stateNhToCmsNh.unmatched_cms).toBe(0);
    expect(snap.crosswalk.stateNhToCmsNh.unmatched_state).toBe(1);
    expect(snap.crosswalk.alHomeToCmsNh.attempted).toBe(false);
    expect(snap.crosswalk.alCenterToCmsNh.attempted).toBe(false);
    expect(AZ_PUBLIC_PATH).toBe("/arizona");
    expect(AZ_LOCKED.nhExact).toBe(140);
  });

  it("measures expansion without calling CMS records net-new organizations", () => {
    const snap = assertAzIntelligence();
    expect(snap.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS).toBe(0);
    expect(snap.expansionLedger.NET_NEW_STATE_IDENTITIES).toBe(2776);
    expect(snap.preIngestBaseline.stateAssistedLivingHome).toBe(0);
    expect(snap.publicationDecisions.ASSISTED_LIVING_HOME).toBe("STATE_DIRECTORY_ONLY");
    expect(snap.publicationDecisions.ASSISTED_LIVING_CENTER).toBe("STATE_DIRECTORY_ONLY");
    expect(snap.publicationDecisions.ADULT_FOSTER_CARE).toBe("STATE_DIRECTORY_ONLY");
    expect(snap.azCareCheck.AZ_CARE_CHECK).toBe("OPEN_SEARCH_ONLY");
    expect(snap.enforcement.state.result).toBe("NO_BULK_ACQUIRED");
    expect(snap.adhsGis.contacts.email_nonempty).toBe(0);
    expect(snap.adhsGis.contacts.provenance.phone).toBe("AZ_ADHS_FACILITY_PHONE");
    expect(snap.adhsGis.run_date).toBe("2025-02-03");
    expect(
      AZ_SOURCE_CATALOG.some(
        (row) => row.id === "az-care-check" && row.coverage === "OPEN_SEARCH_ONLY",
      ),
    ).toBe(true);
  });

  it("matches the artifact fingerprint and traces AL Home / CMS clocks", () => {
    const snap = AZ_PUBLIC_SNAPSHOT;
    expect(snap.fingerprint).toBe(AZ_PUBLIC_FINGERPRINT);
    const traces = azTraceMetrics(snap);
    expect(traces.find((row) => row.id === "al-home")?.value).toBe(1719);
    expect(traces.find((row) => row.id === "net-new-canonical")?.value).toBe(0);
  });
});
