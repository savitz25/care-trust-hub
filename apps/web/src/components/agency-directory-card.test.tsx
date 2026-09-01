import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgencyDirectoryCard } from "./agency-directory-card";

describe("agency directory cards", () => {
  it("labels Home Health CMS stars and links the canonical profile", () => {
    render(
      <AgencyDirectoryCard
        provider={{
          providerClass: "home_health",
          ccn: "017013",
          providerName: "CENTERWELL HOME HEALTH",
          city: "ENTERPRISE",
          state: "AL",
          zipCode: "36330",
          telephone: null,
          href: "/home-health/cms/017013/centerwell-home-health",
          cmsQualityStar: 4,
          qualityAvailable: true,
          experienceAvailable: true,
          ownershipAvailable: true,
          serviceEvidenceAvailable: true,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "CENTERWELL HOME HEALTH" })).toHaveAttribute(
      "href",
      "/home-health/cms/017013/centerwell-home-health",
    );
    expect(screen.getByText(/CMS Quality of Patient Care star/i)).toBeInTheDocument();
    expect(screen.getByText(/HHCAHPS/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Trust Score|0 of 5 CMS stars/i);
  });

  it("does not invent a Hospice overall star", () => {
    render(
      <AgencyDirectoryCard
        provider={{
          providerClass: "hospice",
          ccn: "001513",
          providerName: "EXPERT HOSPICE CARE INC",
          city: "PHOENIX",
          state: "AZ",
          zipCode: "85016",
          telephone: null,
          href: "/hospice/cms/001513/expert-hospice-care-inc",
          cmsQualityStar: null,
          qualityAvailable: true,
          experienceAvailable: false,
          ownershipAvailable: false,
          serviceEvidenceAvailable: true,
        }}
      />,
    );
    expect(screen.getByText(/no CMS overall star/i)).toBeInTheDocument();
    expect(screen.getByText(/CAHPS Hospice Survey/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not reported in this evidence layer/).length).toBeGreaterThan(0);
  });
});
