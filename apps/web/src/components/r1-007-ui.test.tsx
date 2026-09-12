import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { CmsStarRating } from "./real-provider";
import { SiteHeader } from "./site-header";
import { PublishedStateNavigation } from "./published-state-navigation";
import { sourceRating } from "@/lib/cms-rating";

describe("R1-007 typed ratings", () => {
  it.each([NaN, Infinity, -1, 0, 6, undefined])(
    "does not manufacture a rating from %s",
    (value) => {
      const { container } = render(<CmsStarRating value={value as number} />);
      expect(container.textContent).not.toMatch(/NaN|undefined|Infinity|\/5/);
      expect(screen.getByText("Not reported")).toBeInTheDocument();
    },
  );
  it("keeps a legitimate CMS rating", () => {
    render(<CmsStarRating value={4} />);
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });
  it("preserves QPC half stars while rejecting fractional nursing-home stars", () => {
    render(<CmsStarRating value={3.5} metric="hh_qpc" />);
    expect(screen.getByText("3.5/5")).toBeInTheDocument();
    expect(sourceRating(3.5, "nh_overall")).toBeNull();
    expect(sourceRating(3.25, "hh_qpc")).toBeNull();
    expect(sourceRating("4", "nh_overall")).toBeNull();
  });
});
describe("R1-007 shared header", () => {
  it("puts published state links under one scalable disclosure", () => {
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: "By state" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    for (const name of [
      "Florida",
      "New Jersey",
      "California",
      "Texas",
      "Washington",
      "Arizona",
      "Colorado",
      "Virginia",
      "New York",
      "Illinois",
    ])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveFocus();
  });
  it("retains an expanded fixture state list inside the disclosure", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      href: `/fixture-state-${i}`,
      label: `Fixture state ${i}`,
    }));
    render(<PublishedStateNavigation items={items} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "By state" }));
    expect(screen.getAllByRole("link")).toHaveLength(60);
  });
  it("does not leave state and hub disclosures open together", () => {
    render(<SiteHeader />);
    const state = screen.getByRole("button", { name: "By state" });
    const hub = screen.getByRole("button", { name: "Switch Hub" });
    fireEvent.click(state);
    fireEvent.click(hub);
    expect(state).toHaveAttribute("aria-expanded", "false");
    expect(hub).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(document.body);
    expect(hub).toHaveAttribute("aria-expanded", "false");
  });
});
