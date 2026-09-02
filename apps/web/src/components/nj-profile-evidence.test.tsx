import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { selectNjProfileEvidence } from "@care/domain";
import { NjProfileEvidenceModule, NjProfileEvidenceView } from "./nj-profile-evidence";

describe("New Jersey profile evidence module", () => {
  it("does not render when there is no exact identity join", () => {
    const { container } = render(<NjProfileEvidenceModule ccn="315000" state="NJ" />);
    expect(container).toBeEmptyDOMElement();
    expect(container.textContent).not.toMatch(/Verified by New Jersey|enforcement ranking/i);
  });

  it("withholds unresolved evidence and may attach only exact approved rows", () => {
    const empty = selectNjProfileEvidence({ ccn: "315000", state: "NJ" });
    expect(empty.render).toBe(false);
    expect(empty.attachments).toEqual([]);
    const { container } = render(
      <NjProfileEvidenceView
        evidence={{
          match: "EXACT",
          render: true,
          withheldReviewOrUnresolved: 479,
          attachments: [
            {
              match: "EXACT",
              kind: "license_identity",
              facId: "ABC123",
              licenseNumber: "LIC1",
              label: "NJDOH FacID ABC123",
              detail: "Exact FacID join from All_LTC.",
              adverse: false,
            },
          ],
        }}
      />,
    );
    expect(container.textContent).toMatch(/NJDOH FacID ABC123/);
    expect(container.textContent).not.toMatch(/Verified by New Jersey/);
  });
});
