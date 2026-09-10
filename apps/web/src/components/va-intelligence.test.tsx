import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VA_PUBLIC_SNAPSHOT } from "@care/domain";
import { VaIntelligenceView } from "./va-intelligence";

describe("VaIntelligenceView", () => {
  it("renders ALF, inspection, CMS, and ADC grains without combining them or ranking", () => {
    const { container } = render(<VaIntelligenceView intel={VA_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/573/);
    expect(text).toMatch(/38,010/);
    expect(text).toMatch(/7,032/);
    expect(text).toMatch(/289/);
    expect(text).toMatch(/Assisted living is not a nursing home|not a nursing home/i);
    expect(text).not.toMatch(/Trust Score/);
    expect(text).not.toMatch(/best facility/i);
    expect(text).not.toMatch(/\/virginia\/[a-z-]+-county/);
    expect(text).not.toMatch(/\/virginia\/fairfax/);
    const combined = 573 + 82 + 289 + 237 + 110;
    expect(text).not.toContain(String(combined));
  });
});
