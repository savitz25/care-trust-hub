import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  HOME_PROHIBITED_LANGUAGE,
  assertSeniorHomeIntel,
  buildSeniorHomeIntel,
  type SeniorNationalIntelligence,
} from "@care/domain";
import payload from "@/data/senior-national-intelligence.json";
import { SeniorHomeIntelligence } from "./senior-home-intelligence";

const intel = assertSeniorHomeIntel(
  buildSeniorHomeIntel({
    national: payload as SeniorNationalIntelligence,
    floridaIdentities: 6983,
    floridaRegulatoryObservations: 77219,
    publishedAlfAfch: 25,
  }),
);

describe("senior homepage intelligence", () => {
  it("leads with intelligence and keeps classes separate", () => {
    render(
      <SeniorHomeIntelligence
        intel={intel}
        tools={{ navigator: true, planner: true, workspace: true }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /understand senior care through public evidence/i,
    );
    expect(document.body.textContent).toMatch(
      /Research senior care without being sold senior care/i,
    );
    expect(screen.getAllByText("14,690").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12,460").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6,669").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("heading", { name: /three national evidence stories/i }),
    ).toHaveLength(1);
    expect(screen.getAllByText(/explain this chart/i)).toHaveLength(3);
    expect(screen.getAllByText(/trace this number/i).length).toBeGreaterThanOrEqual(5);
    expect(document.body.textContent).toMatch(/where the record is incomplete/i);
    expect(document.body.textContent).toMatch(/does not encode quality/i);
    expect(screen.getByRole("link", { name: /explore florida intelligence/i })).toHaveAttribute(
      "href",
      "/florida",
    );
    expect(screen.getByRole("link", { name: /explore new jersey intelligence/i })).toHaveAttribute(
      "href",
      "/new-jersey",
    );
    expect(screen.getByRole("link", { name: /save research to your shortlist/i })).toHaveAttribute(
      "href",
      "/shortlist",
    );
    expect(document.body.textContent).not.toMatch(HOME_PROHIBITED_LANGUAGE);
    expect(document.body.textContent).not.toMatch(/senior-care providers/);
    expect(document.body.textContent).not.toMatch(/Loading intelligence/i);
  });
});
