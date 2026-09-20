import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OH_PUBLIC_SNAPSHOT } from "@care/domain";
import { OhIntelligenceView } from "./oh-intelligence";

describe("Ohio intelligence page", () => {
  it("separates nursing homes from RCFs and does not rank", () => {
    const { container } = render(<OhIntelligenceView intel={OH_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/923/);
    expect(text).toMatch(/812/);
    expect(text).toMatch(/922/);
    expect(text).toMatch(/Residential Care Facility/);
    expect(text).toMatch(/not a TrustHub rating/i);
    expect(text).toMatch(/No Trust Score/);
    expect(text).toMatch(/No AggregateRating/);
    expect(text).not.toMatch(/best nursing home/i);
    expect(text).not.toMatch(/\/ohio\/cleveland/);
    expect(text).not.toMatch(/\/ohio\/columbus/);
    expect(text).toMatch(/Inspection is not a complaint/);
    expect(text).toMatch(/does not pick a winner/i);
    expect(text).toMatch(/Search only/);
  });
});
