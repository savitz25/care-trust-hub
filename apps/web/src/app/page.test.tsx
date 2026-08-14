import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DevelopmentHome from "./page";

describe("development landing page", () => {
  it("labels the environment and avoids real provider claims", () => {
    render(<DevelopmentHome />);
    expect(screen.getByText(/synthetic content only/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /care intelligence platform/i,
    );
  });
});
