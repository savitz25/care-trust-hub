import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  HOME_PROHIBITED_LANGUAGE,
  assertSeniorHomeIntel,
  buildSeniorHomeIntel,
  fingerprintHomeIntel,
  type SeniorHomeIntel,
} from "./senior-home-intel";
import {
  assertSeniorHubIntelligence,
  type SeniorNationalIntelligence,
} from "./senior-hub-intelligence";

const dir = dirname(fileURLToPath(import.meta.url));
const national = assertSeniorHubIntelligence(
  JSON.parse(
    readFileSync(join(dir, "../../../apps/web/src/data/senior-national-intelligence.json"), "utf8"),
  ) as SeniorNationalIntelligence,
);

function build(): SeniorHomeIntel {
  return buildSeniorHomeIntel({
    national,
    floridaIdentities: 6983,
    floridaRegulatoryObservations: 77219,
    publishedAlfAfch: 25,
  });
}

describe("senior-home-intel-v1", () => {
  it("is deterministic and fingerprints identically on rerun", () => {
    const first = build();
    const second = build();
    expect(first.payloadFingerprint).toBe(second.payloadFingerprint);
    expect(first.payloadFingerprint).toBe(fingerprintHomeIntel(first));
    expect(assertSeniorHomeIntel(first).findings).toHaveLength(3);
  });

  it("keeps class universes separate and does not headline a combined total", () => {
    const intel = build();
    expect(intel.stateOfRecord.map((row) => row.id)).toEqual([
      "nh-current",
      "hh-current",
      "hospice-current",
      "ownership-orgs",
      "nh-chow",
    ]);
    expect(intel.stateOfRecord[0]?.value).toBe(14690);
    expect(intel.stateOfRecord[1]?.value).toBe(12460);
    expect(intel.stateOfRecord[2]?.value).toBe(6669);
    expect(JSON.stringify(intel)).not.toMatch(/senior-care providers/);
    expect(intel.score).toBeNull();
    expect(intel.ranking).toBeNull();
    expect(intel.changeModule.status).toBe("UNSUPPORTED");
  });

  it("uses benchmark/gap stories without ranking language", () => {
    const intel = build();
    expect(intel.findings.map((item) => item.storyType).sort()).toEqual([
      "BENCHMARK",
      "GAP",
      "GAP",
    ]);
    expect(JSON.stringify(intel)).not.toMatch(HOME_PROHIBITED_LANGUAGE);
    expect(intel.floridaPreview.href).toBe("/florida");
    expect(intel.floridaPreview.publishedAlfAfch).toBe(25);
    expect(intel.askMarket).toHaveLength(7);
    expect(intel.geography.some((row) => row.intelligenceHref === "/florida")).toBe(true);
    expect(intel.geography.some((row) => row.intelligenceHref === "/new-jersey")).toBe(true);
    expect(intel.geography.some((row) => row.intelligenceHref === "/california")).toBe(true);
    expect(intel.geography.some((row) => row.intelligenceHref === "/texas")).toBe(true);
    expect(intel.geography.some((row) => row.intelligenceHref === "/washington")).toBe(true);
    expect(
      intel.geography
        .filter(
          (row) =>
            row.state !== "FL" &&
            row.state !== "NJ" &&
            row.state !== "CA" &&
            row.state !== "TX" &&
            row.state !== "WA",
        )
        .every((row) => row.intelligenceHref === null),
    ).toBe(true);
    expect(intel.newJerseyPreview.href).toBe("/new-jersey");
    expect(intel.newJerseyPreview.ltcIdentities).toBe(893);
    expect(intel.californiaPreview.href).toBe("/california");
    expect(intel.californiaPreview.elmsRows).toBe(15097);
    expect(intel.californiaPreview.rcfeLicensed).toBe(7939);
    expect(intel.texasPreview.href).toBe("/texas");
    expect(intel.texasPreview.cmsNursingHomes).toBe(1177);
    expect(intel.texasPreview.hhscNf).toBe(1175);
    expect(intel.texasPreview.hhscAlf).toBe(2000);
    expect(intel.texasPreview.hhscHcssa).toBe(8799);
    expect(intel.washingtonPreview.href).toBe("/washington");
    expect(intel.washingtonPreview.afh).toBe(6179);
    expect(intel.washingtonPreview.alf).toBe(557);
    expect(intel.washingtonPreview.cmsNursingHomes).toBe(193);
  });
});
