import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NC_PUBLIC_SNAPSHOT } from "@care/domain";
import { NcIntelligenceView } from "./nc-intelligence";

describe("North Carolina intelligence page", () => {
  it("separates ACH, FCH, nursing home, and CMS overlays and labels NC DHSR Star Rating", () => {
    const { container } = render(<NcIntelligenceView intel={NC_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/568/);
    expect(text).toMatch(/515/);
    expect(text).toMatch(/423/);
    expect(text).toMatch(/3,336/);
    expect(text).toMatch(/NC DHSR Star Rating/);
    expect(text).toMatch(/not a TrustHub score/i);
    expect(text).toMatch(/Home Care All/);
    expect(text).toMatch(/Not a Home Care agency census/);
    expect(text).toMatch(/419/);
    expect(text).toMatch(/not a bridge/i);
    expect(text).toMatch(/No Trust Score/);
    expect(text).toMatch(/No AggregateRating/);
    expect(text).not.toMatch(/best nursing homes/i);
    expect(text).not.toMatch(/top-rated assisted living/i);
    expect(text).not.toMatch(/\/north-carolina\/charlotte/);
    expect(text).not.toMatch(/\/north-carolina\/raleigh/);
  });
});
