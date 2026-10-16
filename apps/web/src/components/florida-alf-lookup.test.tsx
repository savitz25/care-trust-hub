import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloridaAlfLookup } from "./florida-alf-lookup";

const daniella = {
  providerId: "alf-daniella",
  ahcaFileNumber: "11966552",
  officialName: "DANIELLA'S CARE CENTER INC",
  path: "/florida/assisted-living/11966552/daniella-s-care-center-inc",
  facilityCounties: ["Miami-Dade"],
};

const blank = {
  providerId: "alf-blank",
  ahcaFileNumber: "11900001",
  officialName: "NO COUNTY ALF",
  path: "/florida/assisted-living/11900001/no-county-alf",
  facilityCounties: [] as string[],
};

describe("Florida assisted-living lookup", () => {
  it("links an exact record and shows the stored facility county", () => {
    render(
      <FloridaAlfLookup
        query={{ name: daniella.officialName, file: "", county: "" }}
        result={{ status: "match", records: [daniella] }}
        cohortCount={20}
        countyState="ready"
        countyOptions={["Miami-Dade", "Sarasota"]}
        countyBlocked={false}
      />,
    );
    expect(screen.getByRole("link", { name: daniella.officialName })).toHaveAttribute(
      "href",
      daniella.path,
    );
    expect(screen.getByRole("cell", { name: "11966552" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Miami-Dade" })).toBeInTheDocument();
    expect(screen.getByLabelText("Facility county")).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/does not mean good standing/i);
    expect(document.body.textContent).toMatch(/not a clean record/i);
    expect(document.body.textContent).toMatch(/does not establish a substantiated violation/i);
    expect(document.body.textContent).toMatch(/not a ranking/i);
    expect(document.body.textContent).not.toMatch(/nursing home results|good standing license/i);
  });

  it("states an empty match and an unrecorded facility county without offering a county filter", () => {
    render(
      <FloridaAlfLookup
        query={{ name: "missing", file: "11999999", county: "" }}
        result={{ status: "none", records: [] }}
        cohortCount={20}
        countyState="unrecorded"
        countyOptions={[]}
        countyBlocked={false}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /no published assisted-living record matched/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Facility county")).not.toBeInTheDocument();
    expect(document.body.textContent).toMatch(/No facility county was recorded/i);
  });

  it("does not present records when a requested county could not be loaded", () => {
    render(
      <FloridaAlfLookup
        query={{ name: "", file: "", county: "Miami-Dade" }}
        result={{ status: "browse", records: [daniella, blank] }}
        cohortCount={20}
        countyState="unavailable"
        countyOptions={[]}
        countyBlocked
      />,
    );
    expect(screen.queryByRole("link", { name: daniella.officialName })).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /facility county is unavailable/i }),
    ).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Facility county could not be loaded/i);
  });

  it("shows the unrecorded county sentence on a record that has no facility county", () => {
    render(
      <FloridaAlfLookup
        query={{ name: "", file: "", county: "" }}
        result={{ status: "browse", records: [blank] }}
        cohortCount={1}
        countyState="ready"
        countyOptions={["Sarasota"]}
        countyBlocked={false}
      />,
    );
    expect(
      screen.getByRole("cell", { name: "Not recorded in acquired AHCA sources" }),
    ).toBeInTheDocument();
  });
});
