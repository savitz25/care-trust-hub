import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assertFloridaIntelligence, type FloridaIntelligence } from "@care/domain";
import payload from "@/data/florida-intelligence.json";
import { FloridaIntelligenceView } from "./florida-intelligence";

const intel = assertFloridaIntelligence(payload as FloridaIntelligence);

describe("Florida intelligence page", () => {
  it("separates observations from providers and refuses ranking language", () => {
    render(<FloridaIntelligenceView intel={intel} />);
    expect(screen.getAllByText(/6,983/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/77,219/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5,317/).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/no connected Florida regulatory event observed/i);
    expect(document.body.textContent).toMatch(/not a clean record/i);
    expect(document.body.textContent).toMatch(/Active\/Open locator/i);
    expect(document.body.textContent).toMatch(/not Memory Care/i);
    expect(document.body.textContent).toMatch(/federal CMS reposts/i);
    expect(document.body.textContent).toMatch(/0 CONFIRMED/i);
    expect(document.body.textContent).not.toMatch(
      /best nursing homes|2971 Medicare|Florida Memory Care Facilities =/i,
    );
    expect(document.body.textContent).toMatch(/not “no violations,”/i);
    expect(screen.getByRole("table", { name: /observations vs distinct/i })).toBeInTheDocument();
  });
});
