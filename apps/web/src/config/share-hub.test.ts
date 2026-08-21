import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isForbiddenShareHost, resolveShareOrigin, SHARE_HUB } from "./share-hub";
import { siteMetadata } from "./metadata";

describe("SHARE-002 SeniorTrustHub social baseline", () => {
  it("pins the public Senior host", () => {
    expect(SHARE_HUB.id).toBe("senior");
    expect(SHARE_HUB.host).toBe("www.seniortrusthub.com");
    expect(SHARE_HUB.origin).toBe("https://www.seniortrusthub.com");
    expect(SHARE_HUB.twitterCard).toBe("summary_large_image");
    expect(SHARE_HUB.ogWidth).toBe(1200);
    expect(SHARE_HUB.ogHeight).toBe(630);
  });

  it("never returns localhost or a preview host for share origin", () => {
    expect(resolveShareOrigin()).toBe("https://www.seniortrusthub.com");
    expect(isForbiddenShareHost("localhost")).toBe(true);
    expect(isForbiddenShareHost("127.0.0.1")).toBe(true);
    expect(isForbiddenShareHost("care-trust-hub.vercel.app")).toBe(true);
    expect(isForbiddenShareHost("www.movetrusthub.com")).toBe(true);
  });

  it("uses the pinned origin as metadataBase", () => {
    expect(String(siteMetadata.metadataBase)).toContain("https://www.seniortrusthub.com");
    expect(JSON.stringify(siteMetadata)).not.toContain("localhost");
    expect(JSON.stringify(siteMetadata)).not.toContain("127.0.0.1");
  });

  it("does not blank facility OG images", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/facility/[slug]/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/images:\s*\[\]/);
  });
});
