import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DevelopmentHome from "./page";

describe("experience lab home", () => {
  it("leads with independent research and labels synthetic content", async () => {
    render(await DevelopmentHome({}));
    expect(screen.getByRole("note")).toHaveTextContent(/synthetic demonstration data/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /research senior care without being sold senior care/i,
    );
    expect(screen.queryByText(/request pricing/i)).not.toBeInTheDocument();
  });
});
