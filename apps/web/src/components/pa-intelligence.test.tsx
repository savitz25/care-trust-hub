import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PA_PUBLIC_SNAPSHOT } from "@care/domain";
import { PaIntelligenceView } from "./pa-intelligence";

describe("Pennsylvania intelligence page", () => {
  it("separates DOH classes from CMS overlays and keeps PCH search-only", () => {
    const { container } = render(<PaIntelligenceView intel={PA_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/659/);
    expect(text).toMatch(/4,656/);
    expect(text).toMatch(/178/);
    expect(text).toMatch(/995/);
    expect(text).toMatch(/Search only/);
    expect(text).toMatch(/656/);
    expect(text).toMatch(/Home Care/);
    expect(text).toMatch(/coincidence|not a bridge/i);
    expect(text).toMatch(/No Trust Score/);
    expect(text).toMatch(/No AggregateRating/);
    expect(text).not.toMatch(/best nursing homes/i);
    expect(text).not.toMatch(/\/pennsylvania\/philadelphia/);
    expect(text).not.toMatch(/\/pennsylvania\/pittsburgh/);
  });
});
