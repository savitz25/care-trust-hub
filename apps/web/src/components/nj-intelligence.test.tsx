import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assertNjIntelligence, NJ_PUBLIC_SNAPSHOT } from "@care/domain";
import { NjIntelligenceView } from "./nj-intelligence";

const intel = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);

describe("New Jersey intelligence page", () => {
  it("separates All_LTC from All_Acute and refuses ranking language", () => {
    render(<NjIntelligenceView intel={intel} />);
    expect(screen.getByRole("heading", { name: /separate universes/i })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/893/);
    expect(document.body.textContent).toMatch(/1,430/);
    expect(document.body.textContent).toMatch(/Home Health Agency offices/);
    expect(document.body.textContent).toMatch(/Hospice Care Program/);
    expect(document.body.textContent).toMatch(/Hospice Care Branch/);
    expect(document.body.textContent).toMatch(/Hospice Care — Inpatient/);
    expect(document.body.textContent).toMatch(/office county is not a service area/i);
    expect(document.body.textContent).toMatch(/residents per one staff member/i);
    expect(document.body.textContent).toMatch(/not a clean history/i);
    expect(document.body.textContent).toMatch(/Unknown/);
    expect(document.body.textContent).not.toMatch(/best nursing homes|senior-care providers/);
    expect(document.body.textContent).not.toMatch(/Verified by New Jersey/);
    expect(screen.getByRole("table", { name: /official All_LTC types/i })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /official All_Acute types/i })).toBeInTheDocument();
    expect(screen.getAllByText(/trace this number/i).length).toBeGreaterThanOrEqual(8);
  });

  it("shows coverage gaps instead of silent zeros", () => {
    render(<NjIntelligenceView intel={intel} />);
    expect(document.body.textContent).toMatch(
      /Certificate of Authority roster is not in the public files/i,
    );
    expect(document.body.textContent).toMatch(/not zero/i);
    expect(document.body.textContent).toMatch(/CMS Home Health crosswalk remains incomplete/i);
    expect(document.body.textContent).toMatch(/unresolved/i);
  });
});
