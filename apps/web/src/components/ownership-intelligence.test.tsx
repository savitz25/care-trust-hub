import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CareOwnershipIntelligence } from "@/server/care/types";
import { OwnershipIntelligence } from "./ownership-intelligence";

const source = {
  sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
  datasetName: "Skilled Nursing Facility All Owners",
  cmsDatasetIdentifier: "afe44b85-cc6d-40d7-b5df-00ae8910d1d2",
  officialSourceUrl: "https://data.cms.gov/owners",
  releaseIdentifier: "2026-07-27",
  sourceModifiedAt: "2026-07-27T00:00:00.000Z",
  retrievedAt: "2026-08-15T00:00:00.000Z",
};
const intelligence: CareOwnershipIntelligence = {
  totalPartyCount: 2,
  parties: [
    {
      id: "party-1",
      kind: "organization",
      displayName: "EXAMPLE MANAGEMENT LLC",
      roleCode: "72",
      roleText: "MANAGERIAL CONTROL",
      associationDate: "2024-01-01",
      ownershipPercentage: 25,
      classifications: { management_services_company: true, reit: false },
      connectedProviderCount: 3,
      connectedStates: ["AL", "GA"],
      source,
    },
    {
      id: "party-2",
      kind: "individual",
      displayName: "PUBLIC, JANE",
      roleCode: "34",
      roleText: "5% OR GREATER DIRECT OWNERSHIP INTEREST",
      associationDate: null,
      ownershipPercentage: 10,
      classifications: {},
      connectedProviderCount: null,
      connectedStates: [],
      source,
    },
  ],
  changes: [
    {
      id: "change-1",
      effectiveDate: "2025-01-01",
      changeTypeCode: "CH",
      changeTypeText: "CHANGE OF OWNERSHIP",
      buyerName: "BUYER LLC",
      sellerName: "SELLER LLC",
      source: { ...source, datasetName: "Skilled Nursing Facility Change of Ownership" },
    },
  ],
};

describe("ownership intelligence", () => {
  it("uses source-qualified neutral language and preserves parties, roles, flags, and portfolio facts", () => {
    const { container } = render(<OwnershipIntelligence intelligence={intelligence} />);
    expect(screen.getByRole("heading", { name: /Who CMS records show/ })).toBeVisible();
    expect(screen.getByText(/self-reported|reported by enrolled providers/i)).toBeVisible();
    expect(screen.getByText("EXAMPLE MANAGEMENT LLC")).toBeVisible();
    expect(screen.getByText(/Published ownership percentage: 25%/)).toBeVisible();
    expect(screen.getByText(/Management services company/)).toBeVisible();
    expect(screen.getByText(/exact CMS organization identity: 2/)).toBeVisible();
    expect(screen.getByText(/SELLER LLC to BUYER LLC/)).toBeVisible();
    expect(container.textContent).not.toMatch(/ownership score|ranking|good owner|bad owner/i);
    expect(container.textContent).not.toMatch(/subscription|billing|entitlement|claim status/i);
  });
});
