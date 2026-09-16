import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OR_PUBLIC_SNAPSHOT } from "@care/domain";
import { OrIntelligenceView } from "./or-intelligence";

describe("Oregon intelligence page", () => {
  it("separates ODHS classes from CMS overlays and discloses license-condition scope", () => {
    const { container } = render(<OrIntelligenceView intel={OR_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/128/);
    expect(text).toMatch(/240/);
    expect(text).toMatch(/332/);
    expect(text).toMatch(/1,580/);
    expect(text).toMatch(/OHA Home Health licenses/);
    expect(text).toMatch(/OHA Hospice licenses/);
    expect(text).toMatch(/51/);
    expect(text).toMatch(/74/);
    expect(text).toMatch(/license conditions/i);
    expect(text).toMatch(/not a complaint/i);
    expect(text).toMatch(/No Trust Score/);
    expect(text).toMatch(/No AggregateRating/);
    expect(text).not.toMatch(/best facility|worst facility/i);
    expect(text).not.toMatch(/Oregon senior facilities total/i);
    expect(text).not.toMatch(/\/oregon\/portland/);
  });
});
