import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TX_LOCKED,
  TX_PUBLIC_FINGERPRINT,
  TX_PUBLIC_PATH,
  TX_SOURCE_CATALOG,
  assertTxIntelligence,
  txTraceMetrics,
} from "./tx-intelligence";
import { TX_PUBLIC_SNAPSHOT } from "./tx-public-snapshot";

const dir = dirname(fileURLToPath(import.meta.url));

describe("TX-SEN-001 public snapshot", () => {
  it("reconciles CMS Texas overlays to the live unique CCN sets", () => {
    const snap = assertTxIntelligence();
    expect(snap.fingerprint).toBe(TX_PUBLIC_FINGERPRINT);
    expect(snap.cmsOverlay.nursingHomes).toBe(1177);
    expect(snap.cmsOverlay.homeHealth).toBe(1854);
    expect(snap.cmsOverlay.hospice).toBe(1053);
    expect(snap.cmsOverlay.liveDirectoryTxUniqueCcn.nursingHomes).toBe(1177);
    expect(snap.cmsOverlay.liveDirectoryTxUniqueCcn.homeHealth).toBe(1854);
    expect(snap.cmsOverlay.liveDirectoryTxUniqueCcn.hospice).toBe(1053);
    expect(snap.cmsOverlay.nursingHomes).not.toBe(snap.hhscNursingFacilities.source_row_count);
  });

  it("keeps HHSC classes uncombined and does not invent a TULIP roster", () => {
    const snap = assertTxIntelligence();
    expect(snap.hhscNursingFacilities.source_row_count).toBe(1175);
    expect(snap.hhscAssistedLiving.source_row_count).toBe(2000);
    expect(snap.hhscHcssa.source_row_count).toBe(8799);
    expect(snap.hhscHospitalBasedNf.source_row_count).toBe(6);
    expect(snap.hhscAssistedLiving.alzheimer_certificate).toBe(731);
    expect(snap.tulip.license_count_published).toBeNull();
    expect(snap.tulip.scrape).toBe("FORBIDDEN");
    expect(snap.tulip.coverage).toBe("OPEN_SEARCH_ONLY");
    const combined =
      snap.hhscNursingFacilities.source_row_count +
      snap.hhscAssistedLiving.source_row_count +
      snap.hhscHcssa.source_row_count;
    expect(JSON.stringify(snap)).not.toContain(`"texasSeniorProviders":${combined}`);
    expect(JSON.stringify(snap)).not.toMatch(/Trust Score|best facility|worst facility/i);
  });

  it("uses exact CCN matching only and refuses ALF-to-SNF attachment", () => {
    const snap = assertTxIntelligence();
    expect(snap.crosswalk.nfToCmsNh.exact_matches).toBe(1149);
    expect(snap.crosswalk.nfToCmsNh.source_native_ccns).toBe(1153);
    expect(snap.crosswalk.nfToCmsNh.unmatched_cms).toBe(28);
    expect(snap.crosswalk.nfToCmsNh.note).toMatch(/Name and city are not used/);
    expect(snap.crosswalk.alfToCmsNh.attempted).toBe(false);
    expect(TX_PUBLIC_PATH).toBe("/texas");
    expect(TX_LOCKED.hhscNfExactCms).toBe(1149);
  });

  it("excludes child-care SODA and documents partial state enforcement", () => {
    const snap = assertTxIntelligence();
    expect(snap.childCareExclusion.status).toBe("DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE");
    expect(snap.childCareExclusion.datasets["bc5r-88dy"].row_count).toBe(14982);
    expect(snap.childCareExclusion.datasets["m5q4-3y3d"].row_count).toBe(206609);
    expect(snap.enforcement.result).toBe("PARTIAL_SOURCE_COVERAGE");
    expect(snap.enforcement.inspectionFindings).toBe("SOURCE_NOT_ACQUIRED");
    expect(snap.enforcement.nfClosures.source_row_count).toBe(404);
    expect(snap.enforcement.alfClosures.source_row_count).toBe(1496);
    expect(snap.enforcement.hcssaClosures.source_row_count).toBe(22027);
    expect(JSON.stringify(snap.cmsOverlay)).not.toContain("14982");
    expect(JSON.stringify(snap.hhscAssistedLiving)).not.toContain("bc5r-88dy");
  });

  it("matches the artifact fingerprint and traces CMS and TULIP clocks", () => {
    const artifact = JSON.parse(
      readFileSync(join(dir, "../../../artifacts/tx-sen-001-public-snapshot.json"), "utf8"),
    ) as { fingerprint: string };
    expect(artifact.fingerprint).toBe(TX_PUBLIC_FINGERPRINT);
    expect(TX_PUBLIC_SNAPSHOT.fingerprint).toBe(artifact.fingerprint);
    const traces = txTraceMetrics();
    expect(traces.find((row) => row.id === "tulip-roster")?.value).toBeNull();
    expect(traces.find((row) => row.id === "tulip-roster")?.coverageState).toBe("OPEN_SEARCH_ONLY");
    expect(TX_SOURCE_CATALOG.map((row) => row.id)).toEqual([
      "cms-nh",
      "cms-hha",
      "cms-hospice",
      "hhsc-tulip",
      "tx-alf",
      "hcssa",
      "state-enforcement",
      "cms-inspection",
      "cms-ownership",
    ]);
    expect(TX_SOURCE_CATALOG.every((row) => row.identityKey && row.limitations && row.access)).toBe(
      true,
    );
    expect(TX_SOURCE_CATALOG.find((row) => row.id === "hhsc-tulip")?.rows).toBeNull();
    expect(TX_SOURCE_CATALOG.find((row) => row.id === "state-enforcement")?.rows).toBeNull();
  });
});
