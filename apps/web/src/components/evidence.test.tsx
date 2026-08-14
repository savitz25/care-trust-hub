import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceDisclosure, SyntheticDataNotice } from "./evidence";

describe("evidence UI", () => {
  it("identifies fictional data in a status-neutral notice", () => {
    render(<SyntheticDataNotice />);
    expect(screen.getByRole("note")).toHaveTextContent(/every facility.*fictional/i);
  });

  it("uses a native disclosure for source provenance", () => {
    render(
      <SourceDisclosure
        source={{
          dataset: "Synthetic source",
          release: "Demo release",
          observed: "July 2026",
          record: "Fictional record",
        }}
      />,
    );
    expect(screen.getByText("View source details").closest("details")).toBeInTheDocument();
    expect(screen.getByText("Synthetic source")).toBeInTheDocument();
  });
});
