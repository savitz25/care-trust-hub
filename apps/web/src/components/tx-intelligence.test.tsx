import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TX_PUBLIC_SNAPSHOT } from "@care/domain";
import { TxIntelligenceView } from "./tx-intelligence";

describe("Texas intelligence page", () => {
  it("separates CMS classes, HHSC directories, and TULIP and refuses ranking language", () => {
    const { container } = render(<TxIntelligenceView intel={TX_PUBLIC_SNAPSHOT} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/1,177/);
    expect(text).toMatch(/1,854/);
    expect(text).toMatch(/1,053/);
    expect(text).toMatch(/2,000/);
    expect(text).toMatch(/8,799/);
    expect(text).toMatch(/ALF != SNF|ALF is not a skilled-nursing/i);
    expect(text).toMatch(/HOME HEALTH != PERSONAL ASSISTANCE/);
    expect(text).toMatch(/TULIP/);
    expect(text).toMatch(/Search-only/);
    expect(text).toMatch(/CHILD CARE DATA != SENIOR CARE/);
    expect(text).not.toMatch(/Trust Score|best facility|worst facility/i);
    expect(text).not.toMatch(/\/texas\/[a-z-]+-county/);
    expect(text).not.toMatch(/Texas senior providers/);
  });
});
