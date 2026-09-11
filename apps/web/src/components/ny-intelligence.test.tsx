import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NY_PUBLIC_SNAPSHOT } from "@care/domain";
import { NyIntelligenceView } from "./ny-intelligence";

describe("NyIntelligenceView", () => {
  it("renders ACF, NH, DNR, and CMS grains without combining them or ranking", () => {
    const { container } = render(<NyIntelligenceView intel={NY_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/527/);
    expect(text).toMatch(/597/);
    expect(text).toMatch(/6,036/);
    expect(text).toMatch(/117/);
    expect(text).toMatch(/100/);
    expect(text).toMatch(/39/);
    expect(text).toMatch(/Adult Care Facility is not a nursing home|not a nursing home/i);
    expect(text).toMatch(/Do Not Refer/);
    expect(text).toMatch(/No Trust Score/);
    expect(text).not.toMatch(/best (?:nursing home|facility)/i);
    expect(text).not.toMatch(/\/new-york\/manhattan/);
    const combined = 527 + 597 + 100 + 39;
    expect(text).not.toContain(String(combined));
  });
});
