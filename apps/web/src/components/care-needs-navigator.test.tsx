import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ADL_ASSISTANCE_PERSONA,
  INDEPENDENT_PERSONA,
  MEMORY_SAFETY_PERSONA,
  SKILLED_MEDICAL_PERSONA,
  type CareNeedsAnswers,
} from "@care/domain";
import { CareNeedsNavigator } from "./care-needs-navigator";
import {
  NAVIGATOR_QUESTIONS,
  REQUIRED_NAVIGATOR_QUESTION_COUNT,
} from "./care-needs-navigator-questions";

function answerCurrentStep(answers: CareNeedsAnswers) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const question of NAVIGATOR_QUESTIONS) {
      const value = answers[question.id];
      if (!value) continue;
      const option = question.options.find((item) => item.value === value);
      if (!option) continue;
      const group = screen.queryByRole("group", {
        name: (name) => name.startsWith(question.prompt),
      });
      if (!group) continue;
      const radio = within(group).getByRole("radio", { name: option.label });
      if ((radio as HTMLInputElement).checked) continue;
      fireEvent.click(radio);
      progressed = true;
    }
  }
}

function completeNavigator(answers: CareNeedsAnswers) {
  render(<CareNeedsNavigator />);
  fireEvent.click(screen.getByRole("button", { name: "Start Care Needs Navigator" }));
  for (let step = 0; step < 5; step += 1) {
    answerCurrentStep(answers);
    const next = screen.getByRole("button", {
      name: step === 4 ? "See care settings to investigate" : "Continue",
    });
    expect(next).toBeEnabled();
    fireEvent.click(next);
  }
}

describe("care needs navigator", () => {
  it("asks 12-18 high-value questions and has no Google Places dependency", () => {
    expect(REQUIRED_NAVIGATOR_QUESTION_COUNT).toBeGreaterThanOrEqual(12);
    expect(REQUIRED_NAVIGATOR_QUESTION_COUNT).toBeLessThanOrEqual(18);
    const source = [
      readFileSync(path.join(process.cwd(), "src/components/care-needs-navigator.tsx"), "utf8"),
      readFileSync(
        path.join(process.cwd(), "src/components/care-needs-navigator-questions.ts"),
        "utf8",
      ),
    ].join("\n");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(/mailto:|type="email"|lead capture|GOOGLE_PLACES_API_KEY/i);
  });

  it("starts without a login or lead form and keeps a disclaimer", () => {
    render(<CareNeedsNavigator />);
    expect(
      screen.getByRole("heading", { name: /What kind of senior care should I look into/i }),
    ).toBeVisible();
    expect(screen.getAllByText(/does not diagnose/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start Care Needs Navigator" }));
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
  });

  it("shows aging-in-place results for an independent persona", () => {
    completeNavigator(INDEPENDENT_PERSONA);
    expect(screen.getByRole("heading", { name: /Aging in place/i })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /Search nursing facilities/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps assisted living off the SNF directory", () => {
    completeNavigator(ADL_ASSISTANCE_PERSONA);
    expect(screen.getByRole("heading", { name: "Assisted living" })).toBeVisible();
    expect(screen.getByText(/not assisted living or memory-care/i)).toBeInTheDocument();
  });

  it("uses memory-supportive language without a dementia diagnosis", () => {
    completeNavigator(MEMORY_SAFETY_PERSONA);
    expect(screen.getByRole("heading", { name: /Memory-supportive care/i })).toBeVisible();
    expect(screen.queryByText(/this person has dementia/i)).not.toBeInTheDocument();
  });

  it("bridges skilled-nursing results into existing facility search", () => {
    completeNavigator(SKILLED_MEDICAL_PERSONA);
    expect(
      screen.getByRole("link", { name: /Search nursing facilities near me/i }),
    ).toHaveAttribute("href", "/search");
    expect(screen.getByText(/14,693/)).toBeInTheDocument();
    expect(
      screen.getByText(/does not determine which facility is medically appropriate/i),
    ).toBeInTheDocument();
  });
});
