import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentHome from "./page";

vi.mock("server-only", () => ({}));

describe("experience lab home", () => {
  it("leads with independent research and labels synthetic content", async () => {
    render(await DevelopmentHome({}));
    expect(screen.getByRole("note")).toHaveTextContent(/synthetic demonstration data/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /research cms nursing homes, home health, and hospice/i,
    );
    expect(screen.getByRole("heading", { name: /three provider classes/i })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/best nursing homes|Trust Score|250 indexed/i);
    expect(screen.queryByText(/request pricing/i)).not.toBeInTheDocument();
  });
});
