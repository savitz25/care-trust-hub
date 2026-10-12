import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("Maine senior publication", () => {
  it("keeps source classes distinct and the missing extract explicit", () => {
    const page = fs.readFileSync("apps/web/src/app/maine/page.tsx", "utf8");
    expect(page).toContain('canonicalUrl("/maine")');
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("Nursing facilities");
    expect(page).toContain("Adult day");
    expect(page).toContain("Personal care agencies");
    expect(page).toContain("Home health and hospice");
    expect(page).toContain("separate Assisted Housing");
    expect(page).toContain("CMS");
    expect(page).not.toContain("total facilities");
    expect(page).not.toContain("facility count:");
  });
});
