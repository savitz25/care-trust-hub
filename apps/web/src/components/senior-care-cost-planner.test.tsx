import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeniorCareCostPlanner } from "./senior-care-cost-planner";
import { mapNavigatorSettingsToPlanner, storePlannerScenarios } from "./cost-planner-bridge";

describe("senior care cost planner", () => {
  it("has no Google Places, login, or lead-capture dependency", () => {
    const source = [
      readFileSync(path.join(process.cwd(), "src/components/senior-care-cost-planner.tsx"), "utf8"),
      readFileSync(path.join(process.cwd(), "src/components/cost-planner-bridge.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(/mailto:|type="email"|lead capture/i);
  });

  it("compares light home care and assisted living with visible source year", () => {
    render(<SeniorCareCostPlanner navigatorEnabled />);
    expect(screen.getByRole("heading", { name: "Senior Care Cost Planner" })).toBeVisible();
    expect(screen.getByText(/4 hours\/day × 3 days\/week/i)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Gross monthly" })).toBeInTheDocument();
    expect(screen.getAllByText(/2025/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CareScout/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /Not sure what kind of care to compare/i }),
    ).toHaveAttribute("href", "/tools/care-needs-navigator");
  });

  it("shows the 24-hour home-care approximation warning", () => {
    render(<SeniorCareCostPlanner />);
    fireEvent.change(screen.getByLabelText("Hours per day"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("Days per week"), { target: { value: "7" } });
    expect(screen.getByText(/not simply one worker/i)).toBeInTheDocument();
  });

  it("requires an explicit memory-care amount and does not invent a directory", () => {
    render(<SeniorCareCostPlanner />);
    fireEvent.click(screen.getByLabelText("Memory care"));
    expect(screen.getByText(/will not invent a memory-care premium/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not yet have equivalent national provider-level/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Search nursing facilities near me/i }),
    ).not.toBeInTheDocument();
  });

  it("bridges skilled nursing to facility search without claiming facility prices", () => {
    render(<SeniorCareCostPlanner />);
    fireEvent.click(screen.getByLabelText("Skilled nursing"));
    expect(
      screen.getByRole("link", { name: /Search nursing facilities near me/i }),
    ).toHaveAttribute("href", "/search");
    expect(screen.getByText(/does not know each facility/i)).toBeInTheDocument();
  });

  it("applies a custom home-care rate and an LTC offset", () => {
    render(<SeniorCareCostPlanner />);
    fireEvent.click(screen.getByLabelText("Use my own hourly rate"));
    fireEvent.change(screen.getByLabelText("Custom hourly rate"), { target: { value: "32" } });
    fireEvent.change(screen.getByLabelText("Hours per day"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Days per week"), { target: { value: "5" } });
    expect(screen.getByText(/6 hours\/day × 5 days\/week × \$32\/hour/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Long-term-care insurance"), {
      target: { value: "20000" },
    });
    expect(screen.getAllByText("$0").length).toBeGreaterThan(0);
  });

  it("bridges to the interview builder with a cost concern and no dollar amounts", () => {
    render(<SeniorCareCostPlanner interviewBuilderEnabled />);
    const link = screen.getByRole("link", { name: /Questions to ask about pricing and fees/i });
    expect(link).toHaveAttribute("href", "/tools/facility-tour-interview-builder");
    fireEvent.click(link);
    const seed = sessionStorage.getItem("sth-interview-builder-v1-seed");
    expect(seed).toContain('"cost"');
    expect(seed).not.toMatch(/\$|hourly|3200|dollar/i);
  });

  it("maps navigator settings to planner scenarios without health payloads", () => {
    expect(mapNavigatorSettingsToPlanner(["memory_care", "aging_in_place"])).toEqual([
      "memory_care",
      "home_care",
    ]);
    storePlannerScenarios(["skilled_nursing"]);
    expect(sessionStorage.getItem("sth-cost-planner-v1-settings")).toBe('["skilled_nursing"]');
  });
});
