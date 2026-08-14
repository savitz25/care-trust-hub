import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DevelopmentHome from "./page";

describe("experience lab home", () => {
  it("leads with independent research and labels synthetic content", () => {
    render(<DevelopmentHome />);
    expect(screen.getByRole("note")).toHaveTextContent(/synthetic demonstration data/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /research care without being sold care/i,
    );
    expect(screen.queryByText(/request pricing/i)).not.toBeInTheDocument();
  });
});
