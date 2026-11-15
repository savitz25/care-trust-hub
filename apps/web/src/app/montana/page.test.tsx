import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// StateIndexContent is an async Server Component that loads the CMS state index
// from Postgres through a "server-only" module (added to this page in #113). The
// static publication copy under test does not depend on it, so stub it here.
vi.mock("@/components/state-index-content", () => ({ StateIndexContent: () => null }));
import MontanaSeniorPage from "./page";

describe("Montana senior-care licensing publication", () => {
  it("keeps the acquired LTC location list distinct from license counts", () => {
    render(<MontanaSeniorPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Montana senior-care facility licensing evidence/i,
    );
    expect(screen.getByText("61 location rows")).toBeInTheDocument();
    expect(screen.getByText(/61 exact-distinct displayed names/)).toBeInTheDocument();
    expect(screen.getByText(/not a verified active-license count/)).toBeInTheDocument();
  });

  it("keeps source-defined facility classes and federal evidence separate", () => {
    render(<MontanaSeniorPage />);
    for (const label of [
      "Nursing-facility license roster",
      "Assisted Living Facility",
      "Adult Foster Care Home",
      "Home Health Agency",
      "Hospice",
      "Intermediate Care Facility for Developmentally Disabled",
      "Adult Day Care",
      "Retirement Homes and other BOUNDS classes",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/a survey is not enforcement/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CMS Care Compare data/ })).toHaveAttribute(
      "href",
      "https://data.cms.gov/provider-data/",
    );
    expect(screen.queryByText(/AggregateRating|Trust Score/)).not.toBeInTheDocument();
  });
});
