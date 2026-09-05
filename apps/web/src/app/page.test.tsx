import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentHome from "./page";

vi.mock("server-only", () => ({}));

describe("experience lab home", () => {
  it("leads with independent research and labels synthetic content", async () => {
    render(await DevelopmentHome({}));
    expect(screen.getByRole("note")).toHaveTextContent(/synthetic demonstration data/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /research the provider.*research the evidence around them/i,
    );
    expect(
      screen.getByRole("heading", { name: /what is in the research universe/i }),
    ).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/current nursing homes/i);
    expect(document.body).toHaveTextContent(/current home health agencies/i);
    expect(document.body).toHaveTextContent(/current hospice providers/i);
    expect(document.body).toHaveTextContent(/evidence depth by source-native grain/i);
    expect(document.body).toHaveTextContent("14,690");
    expect(document.body).toHaveTextContent("12,460");
    expect(document.body).toHaveTextContent("6,669");
    expect(document.body).toHaveTextContent("1,248,650");
    expect(document.body).toHaveTextContent("200,327");
    expect(document.body).toHaveTextContent("149,978");
    expect(document.body.textContent).not.toMatch(
      /best nursing homes|Trust Score|250 indexed|33,819|1\.6M\+/i,
    );
    expect(screen.queryByText(/request pricing/i)).not.toBeInTheDocument();
  });
});
