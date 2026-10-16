import { normalizeFloridaCounty } from "./florida-county";
import { floridaProfilePath } from "./florida-provider-profile";

/** Discovery route for the published Phase 1 assisted-living cohort. */
export const FLORIDA_ALF_LOOKUP_PATH = "/florida/assisted-living";

export const FLORIDA_ALF_COUNTY_UNRECORDED = "Not recorded in acquired AHCA sources";

export interface FloridaPublishedAlfRecord {
  providerId: string;
  ahcaFileNumber: string;
  officialName: string;
  path: string;
  facilityCounties: readonly string[];
}

export interface FloridaAlfManifestRow {
  providerId: string;
  providerClass: string;
  profileKind: string;
  ahcaFileNumber: string;
  futurePath: string;
}

export interface FloridaAlfNameRow {
  providerId: string;
  kind: string;
  file: string;
  path: string;
  name: string;
}

export interface FloridaAlfLookupQuery {
  name: string;
  file: string;
  county: string;
}

export interface FloridaAlfLookupResult {
  status: "browse" | "match" | "none";
  records: FloridaPublishedAlfRecord[];
}

export function normalizeFloridaAlfName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseFloridaAlfLookupQuery(input: {
  name?: string | string[];
  file?: string | string[];
  county?: string | string[];
}): FloridaAlfLookupQuery {
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  return { name: one(input.name), file: one(input.file), county: one(input.county) };
}

function compareRecords(left: FloridaPublishedAlfRecord, right: FloridaPublishedAlfRecord): number {
  const byName = normalizeFloridaAlfName(left.officialName).localeCompare(
    normalizeFloridaAlfName(right.officialName),
    "en",
  );
  if (byName !== 0) return byName;
  return left.ahcaFileNumber.localeCompare(right.ahcaFileNumber, "en");
}

/**
 * Builds the published assisted-living cohort from the manifest identity and the
 * publication name record. A row is included only when provider id, AHCA file
 * number, path, and class agree. Other classes are ignored.
 */
export function buildFloridaPublishedAlfCohort(
  manifestRows: readonly FloridaAlfManifestRow[],
  nameRows: readonly FloridaAlfNameRow[],
): FloridaPublishedAlfRecord[] {
  const alfRows = manifestRows.filter((row) => row.profileKind === "assisted-living");
  if (alfRows.length === 0) throw new Error("Florida ALF publication cohort is empty");
  const seenProviders = new Set<string>();
  const seenFiles = new Set<string>();
  const records: FloridaPublishedAlfRecord[] = [];
  for (const row of alfRows) {
    if (row.providerClass !== "FL_ALF") {
      throw new Error("Florida ALF publication row is not class FL_ALF");
    }
    const providerId = row.providerId.trim();
    const fileNumber = row.ahcaFileNumber.trim();
    if (!providerId || seenProviders.has(providerId)) {
      throw new Error("Florida ALF publication provider id is missing or duplicated");
    }
    if (!fileNumber || seenFiles.has(fileNumber)) {
      throw new Error("Florida ALF publication file number is missing or duplicated");
    }
    const matches = nameRows.filter(
      (name) =>
        name.kind === "assisted-living" &&
        name.providerId === providerId &&
        name.file === fileNumber &&
        name.path === row.futurePath,
    );
    if (matches.length !== 1) {
      throw new Error("Florida ALF publication name does not match the manifest identity");
    }
    const officialName = matches[0]?.name.trim() ?? "";
    if (!officialName) throw new Error("Florida ALF publication name is empty");
    const path = floridaProfilePath("assisted-living", fileNumber, officialName);
    if (path !== row.futurePath) {
      throw new Error("Florida ALF publication path does not match the official name");
    }
    seenProviders.add(providerId);
    seenFiles.add(fileNumber);
    records.push({
      providerId,
      ahcaFileNumber: fileNumber,
      officialName,
      path,
      facilityCounties: [],
    });
  }
  return records;
}

function facilityCountiesFromGeography(geography: unknown): string[] {
  if (!Array.isArray(geography)) return [];
  const counties: string[] = [];
  for (const item of geography) {
    if (!item || typeof item !== "object") continue;
    const row = item as { geography_kind?: unknown; canonical?: unknown; raw?: unknown };
    if (row.geography_kind !== "facility_county") continue;
    const source =
      typeof row.canonical === "string" && row.canonical.trim()
        ? row.canonical
        : typeof row.raw === "string"
          ? row.raw
          : "";
    const canonical = normalizeFloridaCounty(source).canonical;
    if (canonical && !counties.includes(canonical)) counties.push(canonical);
  }
  return counties;
}

/** Fills facility county on existing cohort records. Unknown provider ids are ignored. */
export function attachFloridaAlfCounties(
  records: readonly FloridaPublishedAlfRecord[],
  rows: readonly { providerId: string; geography: unknown }[],
): FloridaPublishedAlfRecord[] {
  const byId = new Map<string, readonly string[]>();
  for (const row of rows) byId.set(row.providerId, facilityCountiesFromGeography(row.geography));
  return records.map((record) => ({
    ...record,
    facilityCounties: byId.get(record.providerId) ?? record.facilityCounties,
  }));
}

export function floridaAlfCountyOptions(records: readonly FloridaPublishedAlfRecord[]): string[] {
  return [...new Set(records.flatMap((record) => record.facilityCounties))].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

/**
 * Exact facility name, exact AHCA file number, and stored facility county.
 * A partial name does not match. A name and file that disagree match nothing.
 */
export function lookupFloridaPublishedAlf(
  records: readonly FloridaPublishedAlfRecord[],
  query: FloridaAlfLookupQuery,
): FloridaAlfLookupResult {
  const nameRaw = query.name.trim();
  const fileRaw = query.file.trim();
  const countyRaw = query.county.trim();
  const browsing = nameRaw === "" && fileRaw === "" && countyRaw === "";
  const nameKey = normalizeFloridaAlfName(nameRaw);
  const county = countyRaw ? normalizeFloridaCounty(countyRaw) : null;
  const filtered = records.filter((record) => {
    if (nameRaw && normalizeFloridaAlfName(record.officialName) !== nameKey) return false;
    if (fileRaw && record.ahcaFileNumber !== fileRaw) return false;
    if (countyRaw) {
      if (!county?.canonical) return false;
      if (!record.facilityCounties.includes(county.canonical)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort(compareRecords);
  if (browsing) return { status: "browse", records: sorted };
  if (sorted.length === 0) return { status: "none", records: [] };
  return { status: "match", records: sorted };
}
