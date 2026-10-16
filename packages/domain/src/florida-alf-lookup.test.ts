import { describe, expect, it } from "vitest";
import { floridaProfilePath } from "./florida-provider-profile";
import {
  attachFloridaAlfCounties,
  buildFloridaPublishedAlfCohort,
  floridaAlfCountyOptions,
  lookupFloridaPublishedAlf,
  normalizeFloridaAlfName,
  parseFloridaAlfLookupQuery,
  type FloridaAlfManifestRow,
  type FloridaAlfNameRow,
  type FloridaPublishedAlfRecord,
} from "./florida-alf-lookup";

const daniella: FloridaPublishedAlfRecord = {
  providerId: "alf-daniella",
  ahcaFileNumber: "11966552",
  officialName: "DANIELLA'S CARE CENTER INC",
  path: "/florida/assisted-living/11966552/daniella-s-care-center-inc",
  facilityCounties: ["Miami-Dade"],
};

const aston: FloridaPublishedAlfRecord = {
  providerId: "alf-aston",
  ahcaFileNumber: "11966425",
  officialName: "ASTON GARDENS AT PELICAN POINTE",
  path: "/florida/assisted-living/11966425/aston-gardens-at-pelican-pointe",
  facilityCounties: ["Sarasota"],
};

const unrecorded: FloridaPublishedAlfRecord = {
  providerId: "alf-blank",
  ahcaFileNumber: "11900001",
  officialName: "NO COUNTY ALF",
  path: "/florida/assisted-living/11900001/no-county-alf",
  facilityCounties: [],
};

const records = [aston, unrecorded, daniella];

function manifestRow(name: string, file: string, providerId: string): FloridaAlfManifestRow {
  return {
    providerId,
    providerClass: "FL_ALF",
    profileKind: "assisted-living",
    ahcaFileNumber: file,
    futurePath: floridaProfilePath("assisted-living", file, name),
  };
}

function nameRow(row: FloridaAlfManifestRow, name: string): FloridaAlfNameRow {
  return {
    providerId: row.providerId,
    kind: "assisted-living",
    file: row.ahcaFileNumber,
    path: row.futurePath,
    name,
  };
}

describe("Florida published ALF lookup", () => {
  it("normalizes case and punctuation and keeps a partial name distinct", () => {
    expect(normalizeFloridaAlfName("  Daniella's Care Center, Inc. ")).toBe(
      "daniella s care center inc",
    );
    expect(normalizeFloridaAlfName("A & G MARVELOUS ALF, LLC")).toBe("a and g marvelous alf llc");
    expect(normalizeFloridaAlfName("Daniella")).not.toBe(
      normalizeFloridaAlfName(daniella.officialName),
    );
  });

  it("browses the cohort by name when no lookup field is set", () => {
    const result = lookupFloridaPublishedAlf(records, { name: "", file: "", county: "" });
    expect(result.status).toBe("browse");
    expect(result.records.map((row) => row.ahcaFileNumber)).toEqual([
      "11966425",
      "11966552",
      "11900001",
    ]);
  });

  it("matches an exact name or exact AHCA file number and rejects disagreement", () => {
    expect(
      lookupFloridaPublishedAlf(records, {
        name: "daniella's care center inc",
        file: "",
        county: "",
      }).records.map((row) => row.providerId),
    ).toEqual(["alf-daniella"]);
    expect(
      lookupFloridaPublishedAlf(records, {
        name: "",
        file: " 11966425 ",
        county: "",
      }).records.map((row) => row.providerId),
    ).toEqual(["alf-aston"]);
    expect(
      lookupFloridaPublishedAlf(records, {
        name: daniella.officialName,
        file: aston.ahcaFileNumber,
        county: "",
      }),
    ).toEqual({ status: "none", records: [] });
    expect(
      lookupFloridaPublishedAlf(records, { name: "Daniella", file: "", county: "" }).status,
    ).toBe("none");
    expect(
      lookupFloridaPublishedAlf(records, { name: "", file: "1196655", county: "" }).status,
    ).toBe("none");
    expect(lookupFloridaPublishedAlf(records, { name: "!!!", file: "", county: "" }).status).toBe(
      "none",
    );
  });

  it("filters only a stored canonical facility county", () => {
    expect(
      lookupFloridaPublishedAlf(records, { name: "", file: "", county: "Dade" }).records.map(
        (row) => row.providerId,
      ),
    ).toEqual(["alf-daniella"]);
    expect(
      lookupFloridaPublishedAlf(records, { name: "", file: "", county: "Sarasota" }).records,
    ).toHaveLength(1);
    expect(
      lookupFloridaPublishedAlf(records, {
        name: daniella.officialName,
        file: daniella.ahcaFileNumber,
        county: "Sarasota",
      }).status,
    ).toBe("none");
    expect(lookupFloridaPublishedAlf(records, { name: "", file: "", county: "Miami" }).status).toBe(
      "none",
    );
    expect(lookupFloridaPublishedAlf(records, { name: "", file: "", county: "dade" }).status).toBe(
      "none",
    );
    expect(
      lookupFloridaPublishedAlf(unrecorded.facilityCounties.length ? [] : records, {
        name: unrecorded.officialName,
        file: "",
        county: "Miami-Dade",
      }).status,
    ).toBe("none");
  });

  it("reads a single string query and ignores repeated parameters", () => {
    expect(
      parseFloridaAlfLookupQuery({
        name: "DANIELLA'S CARE CENTER INC",
        file: ["11966552"],
        county: undefined,
      }),
    ).toEqual({ name: "DANIELLA'S CARE CENTER INC", file: "", county: "" });
  });

  it("joins ALF rows only when class, file, path, and name agree", () => {
    const row = manifestRow("DANIELLA'S CARE CENTER INC", "11966552", "alf-daniella");
    const afch: FloridaAlfManifestRow = {
      providerId: "afch-1",
      providerClass: "FL_AFCH",
      profileKind: "adult-family-care",
      ahcaFileNumber: "10000001",
      futurePath: "/florida/adult-family-care/10000001/example-home",
    };
    const built = buildFloridaPublishedAlfCohort(
      [afch, row],
      [
        nameRow(row, "DANIELLA'S CARE CENTER INC"),
        {
          providerId: "afch-1",
          kind: "adult-family-care",
          file: "10000001",
          path: afch.futurePath,
          name: "EXAMPLE HOME",
        },
      ],
    );
    expect(built).toEqual([
      {
        providerId: "alf-daniella",
        ahcaFileNumber: "11966552",
        officialName: "DANIELLA'S CARE CENTER INC",
        path: row.futurePath,
        facilityCounties: [],
      },
    ]);
    expect(() => buildFloridaPublishedAlfCohort([row], [nameRow(row, "OTHER NAME")])).toThrow(
      /path does not match/,
    );
    expect(() =>
      buildFloridaPublishedAlfCohort([row], [{ ...nameRow(row, row.providerId), file: "1" }]),
    ).toThrow(/name does not match/);
    expect(() =>
      buildFloridaPublishedAlfCohort(
        [{ ...row, providerClass: "FL_NH_LICENSE" }],
        [nameRow(row, "DANIELLA'S CARE CENTER INC")],
      ),
    ).toThrow(/not class FL_ALF/);
  });

  it("attaches facility county for cohort ids and ignores other geography and other ids", () => {
    const attached = attachFloridaAlfCounties(
      [{ ...daniella, facilityCounties: [] }],
      [
        {
          providerId: "someone-else",
          geography: [
            { geography_kind: "facility_county", canonical: "Sarasota", raw: "Sarasota" },
          ],
        },
        {
          providerId: daniella.providerId,
          geography: [
            { geography_kind: "mailing_county", canonical: "Broward", raw: "Broward" },
            { geography_kind: "facility_county", canonical: null, raw: "Dade" },
            { geography_kind: "field_office", canonical: "Orange", raw: "Orange" },
          ],
        },
      ],
    );
    expect(attached).toHaveLength(1);
    expect(attached[0]?.facilityCounties).toEqual(["Miami-Dade"]);
    expect(floridaAlfCountyOptions(attached)).toEqual(["Miami-Dade"]);
  });
});
