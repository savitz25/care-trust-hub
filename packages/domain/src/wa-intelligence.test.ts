import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  WA_LOCKED,
  WA_PUBLIC_FINGERPRINT,
  WA_PUBLIC_PATH,
  WA_SOURCE_CATALOG,
  assertWaIntelligence,
  waTraceMetrics,
} from "./wa-intelligence";
import { WA_PUBLIC_SNAPSHOT } from "./wa-public-snapshot";

const dir = dirname(fileURLToPath(import.meta.url));

describe("WA-SEN-001 public snapshot", () => {
  it("reconciles DSHS GIS classes and does not combine them with CMS", () => {
    const snap = assertWaIntelligence();
    expect(snap.fingerprint).toBe(WA_PUBLIC_FINGERPRINT);
    expect(snap.dshsGis.profile.rows).toBe(6968);
    expect(snap.adultFamilyHomes.count).toBe(6179);
    expect(snap.assistedLiving.count).toBe(557);
    expect(snap.enhancedServices.count).toBe(16);
    expect(snap.adjacentExcluded.SL.count).toBe(187);
    expect(snap.adjacentExcluded.GT.count).toBe(29);
    expect(snap.adultFamilyHomes.count + snap.assistedLiving.count).not.toBe(
      snap.cmsOverlay.nursingHomes,
    );
    const combined =
      snap.adultFamilyHomes.count +
      snap.assistedLiving.count +
      snap.enhancedServices.count +
      snap.cmsOverlay.nursingHomes +
      snap.cmsOverlay.homeHealth +
      snap.cmsOverlay.hospice;
    expect(JSON.stringify(snap)).not.toContain(`"washingtonSeniorProviders":${combined}`);
    expect(JSON.stringify(snap)).toContain("NO TRUST SCORE");
    expect(JSON.stringify(snap)).not.toMatch(/best facility|worst facility/i);
  });

  it("reconciles CMS Washington overlays to live unique CCN sets", () => {
    const snap = assertWaIntelligence();
    expect(snap.cmsOverlay.nursingHomes).toBe(193);
    expect(snap.cmsOverlay.homeHealth).toBe(74);
    expect(snap.cmsOverlay.hospice).toBe(50);
    expect(snap.cmsOverlay.liveDirectoryWaUniqueCcn.nursingHomes).toBe(193);
    expect(snap.cmsOverlay.liveDirectoryWaUniqueCcn.homeHealth).toBe(74);
    expect(snap.cmsOverlay.liveDirectoryWaUniqueCcn.hospice).toBe(50);
  });

  it("joins state nursing homes to CMS only on exact federal provider number", () => {
    const snap = assertWaIntelligence();
    expect(snap.stateNursingHomeSource.acquired.current_count).toBe(198);
    expect(snap.stateNursingHomeSource.acquired.unique_ccn).toBe(196);
    expect(snap.crosswalk.stateNhToCmsNh.exact_matches).toBe(193);
    expect(snap.crosswalk.stateNhToCmsNh.unmatched_cms).toBe(0);
    expect(snap.crosswalk.stateNhToCmsNh.unmatched_state).toBe(3);
    expect(snap.crosswalk.afhToCmsNh.attempted).toBe(false);
    expect(snap.crosswalk.alfToCmsNh.attempted).toBe(false);
    expect(WA_PUBLIC_PATH).toBe("/washington");
    expect(WA_LOCKED.stateNhExactCms).toBe(193);
  });

  it("keeps SL/GT internal and documents missing state enforcement bulk", () => {
    const snap = assertWaIntelligence();
    expect(snap.adjacentExcluded.SL.directory).toBe("INTERNAL_ONLY");
    expect(snap.adjacentExcluded.GT.directory).toBe("INTERNAL_ONLY");
    expect(snap.enforcement.state.result).toBe("NO_BULK_ACQUIRED");
    expect(snap.publicationDecisions.AFH_PROFILE_PUBLICATION).toBe("STATE_DIRECTORY_ONLY");
    expect(snap.publicationDecisions.ALF_PROFILE_PUBLICATION).toBe("STATE_DIRECTORY_ONLY");
    expect(snap.publicationDecisions.ESF_PROFILE_PUBLICATION).toBe("STATE_DIRECTORY_ONLY");
    expect(snap.dshsGis.contacts.email_nonempty).toBe(0);
    expect(snap.dshsGis.contacts.provenance.phone).toBe("WA_DSHS_FACILITY_PHONE");
    expect(
      WA_SOURCE_CATALOG.some((row) => row.id === "dshs-sl" && row.coverage === "INTERNAL_ONLY"),
    ).toBe(true);
  });

  it("matches the artifact fingerprint and traces AFH/CMS clocks", () => {
    const artifact = JSON.parse(
      readFileSync(join(dir, "../../../artifacts/wa-sen-001-public-snapshot.json"), "utf8"),
    ) as { fingerprint: string };
    expect(artifact.fingerprint).toBe(WA_PUBLIC_FINGERPRINT);
    expect(WA_PUBLIC_SNAPSHOT.fingerprint).toBe(artifact.fingerprint);
    const traces = waTraceMetrics();
    expect(traces.find((row) => row.id === "afh")?.value).toBe(6179);
    expect(traces.find((row) => row.id === "cms-nh-overlay")?.value).toBe(193);
    expect(JSON.stringify(traces)).not.toMatch(/best county|worst county|safest/i);
  });
});
