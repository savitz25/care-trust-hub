import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssistedLivingPublicProvider, PublicProviderBusinessContact } from "@care/domain";
import { AssistedLivingProviderDetail } from "./assisted-living-provider";
import { ProviderBusinessContact } from "./provider-business-contact";

const assistedLiving: AssistedLivingPublicProvider = {
  id: "11111111-1111-4111-8111-111111111111",
  stateCode: "CA",
  regulatorCode: "CA_CDSS_CCL",
  sourceFacilityId: "015600001",
  licenseId: "015600001",
  officialName: "Example RCFE",
  officialStreet: "1 Main",
  officialCity: "Town",
  officialState: "CA",
  officialZip: "94100",
  officialType: "Residential Care Facility for the Elderly",
  consumerCategory: "residential_care",
  licensedCapacity: 6,
  memoryDesignation: "not_reported",
  consumerStatus: "LICENSED",
  licenseStatusReported: true,
  sourceDirectoryContext: "ccl_listing",
  organizations: [],
  retrievedAt: "2026-08-01T00:00:00.000Z",
  sourceLocator: "row:1",
};

const present: PublicProviderBusinessContact = {
  websiteUrl: "https://harborview.example/about",
  email: "admin@harborview.example",
  phoneOverride: "(205) 555-0199",
  sourceType: "enrichment_file",
  sourceUrls: ["https://source.example/listing"],
  verifiedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

describe("ProviderBusinessContact", () => {
  it("renders a public website and email", () => {
    render(<ProviderBusinessContact contact={present} />);
    const website = screen.getByRole("link", { name: "Visit business website" });
    expect(website).toHaveAttribute("href", "https://harborview.example/about");
    expect(website).toHaveAttribute("rel", "nofollow noopener noreferrer");
    expect(screen.getByRole("link", { name: "admin@harborview.example" })).toHaveAttribute(
      "href",
      "mailto:admin@harborview.example",
    );
    expect(screen.getByText("Recorded Oct 2026")).toBeInTheDocument();
  });

  it("renders nothing when contact is absent", () => {
    const { container } = render(<ProviderBusinessContact contact={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: "Visit business website" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("renders nothing when a non-public row was withheld", () => {
    const { container } = render(<ProviderBusinessContact contact={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("places public contact on an assisted living profile and omits it when absent", () => {
    const { rerender } = render(
      <AssistedLivingProviderDetail provider={assistedLiving} businessContact={present} />,
    );
    expect(screen.getByRole("link", { name: "Visit business website" })).toHaveAttribute(
      "rel",
      "nofollow noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: "admin@harborview.example" })).toBeInTheDocument();
    rerender(<AssistedLivingProviderDetail provider={assistedLiving} businessContact={null} />);
    expect(screen.queryByRole("link", { name: "Visit business website" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Example RCFE" })).toBeVisible();
  });
});
