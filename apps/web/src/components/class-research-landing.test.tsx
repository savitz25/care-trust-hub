import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { assertSeniorHubIntelligence, type SeniorNationalIntelligence } from "@care/domain";
import payload from "@/data/senior-national-intelligence.json";
import { ClassResearchLanding } from "./class-research-landing";

vi.mock("server-only", () => ({}));

const intel = assertSeniorHubIntelligence(payload as SeniorNationalIntelligence);

describe("class research landings", () => {
  it("states the Home Health current denominator and separates CMS stars from HHCAHPS", () => {
    render(<ClassResearchLanding classId="home_health" intel={intel} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /CMS Home Health research/i,
    );
    expect(screen.getAllByText(/12,460/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/CMS Home Health CCN/i)).toBeInTheDocument();
    expect(screen.getByText(/CMS Quality of Patient Care stars/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Understand HHCAHPS/i })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/not available/i);
    expect(document.body.textContent).toMatch(/not a verified service area/i);
    expect(document.body.textContent).not.toMatch(
      /best home health|Trust Score|0 ownership changes|aggregateRating/i,
    );
    expect(
      screen.getByRole("button", { name: /Search current Home Health/i }).closest("form"),
    ).toHaveAttribute("action", "/search");
  });

  it("keeps Hospice GI current separate from EVIDENCE_ONLY and does not invent a star", () => {
    render(<ClassResearchLanding classId="hospice" intel={intel} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/CMS Hospice research/i);
    expect(screen.getAllByText(/6,669/).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/242 additional typed Hospice identities/i);
    expect(document.body.textContent).toMatch(/not counted here as current providers/i);
    expect(document.body.textContent).toMatch(/Hospice has no overall CMS star/i);
    expect(document.body.textContent).toMatch(/CAHPS Hospice Survey/i);
    expect(document.body.textContent).not.toMatch(/closed|terminated|best hospice|Trust Score/i);
  });
});
