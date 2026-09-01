import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assertSeniorHubIntelligence, type SeniorNationalIntelligence } from "@care/domain";
import payload from "@/data/senior-national-intelligence.json";
import { NationalHubIntelligence } from "./national-hub-intelligence";

const intel = assertSeniorHubIntelligence(payload as SeniorNationalIntelligence);

describe("national hub intelligence", () => {
  it("separates provider classes and does not rank quality", () => {
    render(<NationalHubIntelligence intel={intel} />);
    expect(screen.getAllByText(/14,690/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12,460/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6,669/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not available/i).length).toBe(2);
    expect(document.body.textContent).toMatch(/UNKNOWN is not a former owner/i);
    expect(document.body.textContent).not.toMatch(
      /best nursing homes|worst nursing homes|250 indexed|aggregateRating|Trust Score/i,
    );
    expect(screen.getByRole("table", { name: /current cms nursing home/i })).toBeInTheDocument();
  });
});
