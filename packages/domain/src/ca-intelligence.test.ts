import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CA_LOCKED,
  CA_PUBLIC_FINGERPRINT,
  CA_PUBLIC_PATH,
  CA_SOURCE_CATALOG,
  assertCaIntelligence,
  caTraceMetrics,
} from "./ca-intelligence";
import { CA_PUBLIC_SNAPSHOT } from "./ca-public-snapshot";

const dir = dirname(fileURLToPath(import.meta.url));

describe("CA-SEN-001 public snapshot", () => {
  it("reconciles ELMS rows, status, types, and contact completeness", () => {
    const snap = assertCaIntelligence();
    expect(snap.fingerprint).toBe(CA_PUBLIC_FINGERPRINT);
    expect(snap.elms.source_row_count).toBe(15097);
    expect(snap.elms.activeLicenseStatus).toBe(13401);
    expect(snap.elms.openFacStatus).toBe(15097);
    expect(snap.elms.contact_fields.phone.present).toBe(13560);
    expect(snap.elms.contact_fields.email.present).toBe(12435);
    expect(snap.elms.contact_fields.address.present).toBe(15097);
    expect(snap.elms.snf).toBe(1186);
    expect(snap.elms.homeHealth).toBe(4137);
    expect(snap.elms.hospice).toBe(2114);
    expect(snap.elms.byType).toHaveLength(21);
    expect(snap.elms.byType.reduce((sum, row) => sum + row.count, 0)).toBe(15097);
    expect(snap.elms.source_as_of).toBe("2026-08-17");
  });

  it("reconciles RCFE statuses on the May 2025 clock and does not merge RCFE with SNF", () => {
    const snap = assertCaIntelligence();
    expect(snap.rcfe.source_row_count).toBe(12522);
    expect(snap.rcfe.licensed).toBe(7939);
    expect(snap.rcfe.closed).toBe(3821);
    expect(snap.rcfe.pending).toBe(739);
    expect(snap.rcfe.onProbation).toBe(23);
    expect(snap.rcfe.source_as_of).toBe("2025-05-25");
    expect(snap.elms.snf).not.toBe(snap.rcfe.licensed);
    expect(JSON.stringify(snap)).not.toMatch(/Trust Score|best providers|worst providers/i);
  });

  it("keeps HCO, HCAI, Adult Residential, and CMS overlays uncombined", () => {
    const snap = assertCaIntelligence();
    expect(snap.hco.source_row_count).toBe(3654);
    expect(snap.hco.note).toMatch(/HOME CARE ORGANIZATION != HOME HEALTH AGENCY/);
    expect(snap.hcai.source_row_count).toBe(10871);
    expect(snap.hcai.open).toBe(10856);
    expect(snap.hcai.note).toMatch(/UNIQUE NEW PROVIDER/);
    expect(snap.arf.publication_eligibility).toBe("RESEARCHED_NOT_PUBLISHED");
    expect(snap.arf.source_row_count).toBe(10498);
    expect(snap.cmsOverlay.nursingHomes).toBe(1165);
    expect(snap.cmsOverlay.homeHealth).toBe(3213);
    expect(snap.cmsOverlay.hospice).toBe(1913);
    const combined =
      snap.elms.source_row_count + snap.rcfe.source_row_count + snap.hcai.source_row_count;
    expect(JSON.stringify(snap)).not.toContain(String(combined));
  });

  it("uses exact CCN matching only and records unmatched rows", () => {
    const snap = assertCaIntelligence();
    expect(snap.crosswalk.snf.exact_matches).toBe(1152);
    expect(snap.crosswalk.snf.unmatched_cdph).toBe(11);
    expect(snap.crosswalk.snf.unmatched_cms).toBe(13);
    expect(snap.crosswalk.homeHealth.exact_matches).toBe(1449);
    expect(snap.crosswalk.hospice.exact_matches).toBe(956);
    expect(snap.crosswalk.snf.note).toMatch(/Name\/city is not used/);
    expect(snap.crosswalk.hcaiElms.exact.elms_to_multiple_hcai).toBe(0);
    expect(snap.crosswalk.hcaiElms.exact.elms_to_multiple_ccn).toBe(0);
    expect(CA_PUBLIC_PATH).toBe("/california");
    expect(CA_LOCKED.snfExact).toBe(1152);
  });

  it("matches the artifact fingerprint and traces contact and RCFE clocks", () => {
    const artifact = JSON.parse(
      readFileSync(join(dir, "../../../artifacts/ca-sen-001-public-snapshot.json"), "utf8"),
    ) as { fingerprint: string };
    expect(artifact.fingerprint).toBe(CA_PUBLIC_FINGERPRINT);
    expect(CA_PUBLIC_SNAPSHOT.fingerprint).toBe(artifact.fingerprint);
    const traces = caTraceMetrics();
    expect(traces.find((row) => row.id === "rcfe-licensed")?.sourceDate).toBe("2025-05-25");
    expect(traces.find((row) => row.id === "elms-phone")?.caveat).toMatch(/state record/i);
    expect(
      CA_SOURCE_CATALOG.some(
        (row) => row.id === "state-enforcement" && row.coverage === "NO_BULK_ACQUIRED",
      ),
    ).toBe(true);
    expect(CA_SOURCE_CATALOG.map((row) => row.id)).toEqual([
      "cdph-elms",
      "ccld-rcfe",
      "ccld-hco",
      "hcai-listing",
      "cms-nh",
      "cms-hha",
      "cms-hospice",
      "state-enforcement",
    ]);
    expect(CA_SOURCE_CATALOG.every((row) => row.identityKey && row.limitations)).toBe(true);
  });

  it("does not treat missing enforcement as zero and withholds adult residential", () => {
    const snap = assertCaIntelligence();
    expect(snap.enforcement.result).toBe("NO_BULK_ACQUIRED");
    expect(snap.enforcement.note).toMatch(/not zero/i);
    expect(snap.gaps.some((row) => /Adult Residential/i.test(row))).toBe(true);
    expect(snap.elms.contact_fields.email.note).toMatch(/Administrator names are not published/);
  });
});
