import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CA_PUBLIC_SNAPSHOT } from "@care/domain";
import { CaIntelligenceView } from "./ca-intelligence";

describe("California intelligence page", () => {
  it("separates ELMS, RCFE, HCAI, and CMS and refuses ranking language", () => {
    const { container } = render(<CaIntelligenceView intel={CA_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/15,097/);
    expect(text).toMatch(/7,939/);
    expect(text).toMatch(/2025-05-25/);
    expect(text).toMatch(/RCFE is not SNF/);
    expect(text).toMatch(/HOME CARE ORGANIZATION != HOME HEALTH AGENCY/);
    expect(text).toMatch(/Facility contact from California state record/);
    expect(text).not.toMatch(/Trust Score|best providers|worst providers/i);
    expect(text).not.toMatch(/\/california\/[a-z-]+-county/);
  });
});
