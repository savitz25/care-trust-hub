import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "./brand";
import { siteMetadata } from "./metadata";
import { ASK_NETWORK_STANDARD_VERSION, CURRENT_NETWORK_HUB_ID, NETWORK_HUBS } from "./network";

describe("SeniorTrustHub public brand", () => {
  it("uses the approved public identity while retaining internal product keys", () => {
    expect(brand.publicName).toBe("SeniorTrustHub");
    expect(brand.tagline).toBe("Research senior care without being sold senior care.");
    expect(brand.philosophy).toBe("We cite. You decide.");
    expect(brand.networkName).toBe("Ask Trust Hub");
    expect(brand.productKey).toBe("care");
  });

  it("propagates the public identity into metadata", () => {
    expect(siteMetadata.applicationName).toBe("SeniorTrustHub");
    expect(siteMetadata.openGraph).toMatchObject({ siteName: "SeniorTrustHub" });
  });

  it("ships the approved bracket and four-point hub SVG assets", () => {
    const lightAssets = [
      "senior-trust-hub-icon.svg",
      "senior-trust-hub-logo.svg",
      "senior-trust-hub-logo-compact.svg",
    ];
    for (const asset of lightAssets) {
      const source = readFileSync(join(process.cwd(), "public", "brand", asset), "utf8");
      expect(source).toContain("#681860");
      expect(source).toContain("#082860");
      expect(source).toContain("#F86008");
    }
    const footer = readFileSync(
      join(process.cwd(), "public", "brand", "senior-trust-hub-footer.svg"),
      "utf8",
    );
    expect(footer).toContain("#D99AD3");
    expect(footer).toContain("#F86008");
  });

  it("ships a compact canonical lockup without slogan or padded canvas", () => {
    const desktop = readFileSync(
      join(process.cwd(), "public", "brand", "senior-trust-hub-logo.svg"),
      "utf8",
    );
    const compact = readFileSync(
      join(process.cwd(), "public", "brand", "senior-trust-hub-logo-compact.svg"),
      "utf8",
    );
    const mark = readFileSync(
      join(process.cwd(), "public", "brand", "senior-trust-hub-mark.svg"),
      "utf8",
    );
    expect(mark).toContain('viewBox="0 0 36 36"');
    expect(mark).toContain('stroke-width="2.4"');
    expect(desktop).toContain('viewBox="0 0 236 36"');
    expect(desktop).toContain('stroke-width="2.4"');
    expect(desktop.match(/<text x="46"/g)).toHaveLength(2);
    expect(desktop).not.toContain("Research senior care");
    expect(compact).toContain('viewBox="0 0 236 36"');
    expect(compact.match(/<text x="46"/g)).toHaveLength(2);
  });

  it("ships Network V2 hub IDs and canonical origins", () => {
    expect(ASK_NETWORK_STANDARD_VERSION).toBe("2026.08.18-network-v2");
    expect(CURRENT_NETWORK_HUB_ID).toBe("senior");
    expect(NETWORK_HUBS.map((hub) => hub.id)).toEqual([
      "ask",
      "move",
      "lender",
      "insurance",
      "contractor",
      "senior",
      "investor",
    ]);
    expect(NETWORK_HUBS.find((hub) => hub.id === "investor")?.href).toBe(
      "https://www.investortrusthub.com",
    );
  });
});
