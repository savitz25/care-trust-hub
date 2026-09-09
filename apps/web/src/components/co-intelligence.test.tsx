import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CO_PUBLIC_SNAPSHOT } from "@care/domain";
import { CoIntelligenceView } from "./co-intelligence";

describe("Colorado intelligence page", () => {
  it("separates CMS classes from CDPHE search and refuses ranking language", () => {
    const { container } = render(<CoIntelligenceView intel={CO_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/210/);
    expect(text).toMatch(/222/);
    expect(text).toMatch(/88/);
    expect(text).toMatch(/Search-only/);
    expect(text).toMatch(/ALR != Nursing Home/);
    expect(text).toMatch(/NHA != facility/);
    expect(text).toMatch(/2017/);
    expect(text).toMatch(/not a current roster/i);
    expect(text).toMatch(/citation is not a penalty/i);
    expect(text).toMatch(/occurrence is not a violation/i);
    expect(text).toMatch(/complaint-intake process is not a complaint dataset/i);
    expect(text).toMatch(/No Trust Score/);
    expect(text).toMatch(/No AggregateRating/);
    expect(text).not.toMatch(/best facility|worst facility/i);
    expect(text).not.toMatch(/\/colorado\/[a-z-]+-county/);
    expect(text).not.toMatch(/Denver county/);
    expect(text).not.toMatch(/Colorado senior providers/);
    expect(text).not.toMatch(/\b675\b/);
  });
});
