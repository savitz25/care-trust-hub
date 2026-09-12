import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IL_PUBLIC_SNAPSHOT } from "@care/domain";
import { IlIntelligenceView } from "./il-intelligence";

describe("Illinois intelligence page", () => {
  it("separates CMS, IDPH, and HFS classes and refuses ranking language", () => {
    const { container } = render(<IlIntelligenceView intel={IL_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/666/);
    expect(text).toMatch(/595/);
    expect(text).toMatch(/169/);
    expect(text).toMatch(/Search-only/);
    expect(text).toMatch(/Supportive Living != nursing home/);
    expect(text).toMatch(/NHA != facility/);
    expect(text).toMatch(/not a current roster/i);
    expect(text).toMatch(/complaint is not a substantiated deficiency/i);
    expect(text).toMatch(/No Trust Score/);
    expect(text).toMatch(/No AggregateRating/);
    expect(text).not.toMatch(/best facility|worst facility/i);
    expect(text).not.toMatch(/\/illinois\/[a-z-]+-county/);
    expect(text).not.toMatch(/Chicago county/);
    expect(text).not.toMatch(/Illinois senior providers/);
  });
});
