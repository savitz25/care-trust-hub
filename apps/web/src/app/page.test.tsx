import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentHome from "./page";

vi.mock("server-only", () => ({}));

describe("experience lab home", () => {
  it("leads with independent research and labels synthetic content", async () => {
    render(await DevelopmentHome({}));
    expect(screen.getByRole("note")).toHaveTextContent(/synthetic demonstration data/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /understand senior care through public evidence/i,
    );
    expect(
      screen.getByRole("heading", { name: /what is in the research universe/i }),
    ).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/current nursing homes/i);
    expect(document.body).toHaveTextContent(/current home health agencies/i);
    expect(document.body).toHaveTextContent(/current hospice providers/i);
    expect(document.body.textContent).not.toMatch(/best nursing homes|Trust Score|250 indexed/i);
    expect(screen.queryByText(/request pricing/i)).not.toBeInTheDocument();
  });
});
