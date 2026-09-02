import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import rateRows from "@/data/nj-medicaid-rate-rows.json";
import { NjMedicaidRates } from "./nj-medicaid-rates";

const rows = rateRows as Array<{ name: string; subtype: string; rate: number }>;

describe("New Jersey Medicaid listed rates", () => {
  it("shows listed rows without implying participation or quality", () => {
    render(
      <NjMedicaidRates listedRows={236} minRate={81.1} maxRate={126.1} effectiveOn="2025-07-01" />,
    );
    expect(rows).toHaveLength(236);
    expect(Math.min(...rows.map((row) => row.rate))).toBe(81.1);
    expect(Math.max(...rows.map((row) => row.rate))).toBe(126.1);
    expect(screen.getAllByRole("row").length).toBeGreaterThan(20);
    expect(document.body.textContent).toMatch(/not inferred Medicaid participation/i);
    expect(document.body.textContent).toMatch(/not a quality score/i);
    expect(document.body.textContent).toMatch(/not profile-attached/i);
  });
});
