import "server-only";
import { getCareDatabasePool } from "./db";

export const TX_HHSC_BATCH = "TH-ENRICH-TX-SENIOR-2026-09-30-IDR2";
export const TX_HHSC_CLASSES = {
  TX_ICF_IID: "ICF/IID regulated location",
  TX_DAHS: "Adult Day Health / DAHS regulated location",
  TX_DAHS_ISS_ONLY: "In-home-only regulated provider/location",
} as const;
export type TxHhscClass = keyof typeof TX_HHSC_CLASSES;
export type TxHhscLocation = {
  namespaced_key: string;
  provider_class: TxHhscClass;
  facility_id: string;
  official_name: string;
  program_type: string;
  facility_licensed_raw: string;
  facility_certified_raw: string;
  county: string | null;
  physical_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  license_number: string | null;
  license_effective_date: string | null;
  license_expiration_date: string | null;
};

const HASHES: Record<TxHhscClass, string> = {
  TX_ICF_IID: "20548d8398104d2a882cd018fff31786ccc77c4412b6874d5e1fada31ca02ab1",
  TX_DAHS: "ec962e57112d6600b4deec292eaee5e0620e70b5413eea71d52078a3c4dcba8f",
  TX_DAHS_ISS_ONLY: "1de6e81addd37ea016be4c2cdbd50a08648f2348c694ef0e4d9eee0eee1bd381",
};
const URLS: Record<TxHhscClass, string> = {
  TX_ICF_IID: "https://apps.hhs.texas.gov/providers/directories/ICFIID.xlsx",
  TX_DAHS: "https://apps.hhs.texas.gov/providers/directories/DAHS.xlsx",
  TX_DAHS_ISS_ONLY: "https://apps.hhs.texas.gov/providers/directories/dahs_issonly.xlsx",
};

export function txHhscGate(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  // This exact PR preview is protected by Vercel SSO. Production and other preview
  // branches never use the certified fixture.
  if (
    environment.VERCEL_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === "th-tx-senior-publish-p1" &&
    environment.VERCEL_GIT_REPO_OWNER === "savitz25" &&
    environment.VERCEL_GIT_REPO_SLUG === "care-trust-hub"
  )
    return "local-preview" as const;
  if (environment.NODE_ENV === "development" && environment.CARE_TX_HHSC_SIMULATE_BATCH === "true")
    return "local-preview" as const;
  if (
    environment.CARE_ENABLE_REAL_PROVIDER_UI === "true" &&
    environment.CARE_ENABLE_TX_HHSC_LOCATION_BATCH === TX_HHSC_BATCH
  )
    return "live" as const;
  return "off" as const;
}

export function txHhscHref(row: Pick<TxHhscLocation, "provider_class" | "facility_id">) {
  return `/texas/regulated-locations/${row.provider_class}/${encodeURIComponent(row.facility_id)}`;
}

export function txHhscSource(row: TxHhscLocation) {
  return {
    regulator: "Texas Health and Human Services Commission (HHSC)",
    url: URLS[row.provider_class],
    asOf: "2026-09-29",
    sha256: HASHES[row.provider_class],
  };
}

export function validateTxHhscBatch(rows: TxHhscLocation[]): boolean {
  if (rows.length !== 1840) return false;
  const counts: Record<TxHhscClass, number> = { TX_ICF_IID: 0, TX_DAHS: 0, TX_DAHS_ISS_ONLY: 0 };
  const keys = new Set<string>();
  let licenses = 0;
  for (const row of rows) {
    if (!(row.provider_class in counts) || !/^\d+$/.test(row.facility_id)) return false;
    if (
      row.namespaced_key !== `TX|HHSC|${row.provider_class}|${row.facility_id}` ||
      keys.has(row.namespaced_key)
    )
      return false;
    keys.add(row.namespaced_key);
    counts[row.provider_class]++;
    if (row.license_number) licenses++;
  }
  return (
    counts.TX_ICF_IID === 708 &&
    counts.TX_DAHS === 389 &&
    counts.TX_DAHS_ISS_ONLY === 743 &&
    licenses === 1786
  );
}

export async function loadTxHhscLocations(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<TxHhscLocation[]> {
  const gate = txHhscGate(environment);
  if (gate === "off") return [];
  let rows: TxHhscLocation[];
  if (gate === "local-preview") {
    rows = (await import("@/data/tx-hhsc-location-preview.json")).default as TxHhscLocation[];
  } else {
    const result = await getCareDatabasePool().query<
      TxHhscLocation & {
        source_sha256: string;
        source_url: string;
        source_as_of: string;
        organization_id: string | null;
        public_eligible: boolean;
        license_batch_id: string | null;
        license_source_sha256: string | null;
      }
    >(
      `SELECT p.namespaced_key,p.provider_class,p.facility_id,p.official_name,p.program_type,
        p.facility_licensed_raw,p.facility_certified_raw,p.county,p.physical_address,p.city,p.state,p.zip,
        p.source_sha256,p.source_url,p.source_as_of::text AS source_as_of,p.organization_id,p.public_eligible,
        l.credential_number AS license_number,l.license_effective_date::text AS license_effective_date,l.license_expiration_date::text AS license_expiration_date,
        l.batch_id AS license_batch_id,l.source_sha256 AS license_source_sha256
       FROM public.tx_hhsc_location p
       LEFT JOIN public.tx_hhsc_location_license_observation l
         ON l.location_id=p.id AND l.batch_id=$1
       WHERE p.batch_id=$1 ORDER BY p.namespaced_key`,
      [TX_HHSC_BATCH],
    );
    if (
      result.rows.some(
        (row) =>
          row.organization_id !== null ||
          row.public_eligible ||
          row.source_sha256 !== HASHES[row.provider_class] ||
          row.source_url !== URLS[row.provider_class] ||
          String(row.source_as_of).slice(0, 10) !== "2026-09-29" ||
          (row.license_number &&
            (row.license_batch_id !== TX_HHSC_BATCH ||
              row.license_source_sha256 !== row.source_sha256)),
      )
    )
      return [];
    rows = result.rows;
  }
  return validateTxHhscBatch(rows) ? rows : [];
}

export function searchTxHhscLocations(
  rows: TxHhscLocation[],
  input: {
    q?: string;
    providerClass?: string;
    city?: string;
    county?: string;
    zip?: string;
    page?: number;
  },
) {
  const q = input.q?.trim().toLocaleLowerCase() ?? "";
  const filtered = rows.filter(
    (row) =>
      (!input.providerClass || row.provider_class === input.providerClass) &&
      (!input.city || row.city?.toLocaleLowerCase() === input.city.trim().toLocaleLowerCase()) &&
      (!input.county ||
        row.county?.toLocaleLowerCase().includes(input.county.trim().toLocaleLowerCase())) &&
      (!input.zip || row.zip?.startsWith(input.zip.trim())) &&
      (!q ||
        row.official_name.toLocaleLowerCase().includes(q) ||
        row.facility_id === input.q?.trim() ||
        row.namespaced_key.toLocaleLowerCase() === q),
  );
  const page = Math.max(1, Math.min(92, input.page || 1));
  return { count: filtered.length, rows: filtered.slice((page - 1) * 20, page * 20), page };
}

export function isTxHhscAskQuery(q: string, selectedClass?: string): boolean {
  return (
    selectedClass === "tx_hhsc_location" ||
    (/\b(?:texas|TX|HHSC)\b/i.test(q) &&
      /\b(?:ICF\/IID|ICF|DAHS|adult day health|in.home.only|facility ID|regulated provider)\b/i.test(
        q,
      ))
  );
}

export function txHhscAskSearch(q: string) {
  const providerClass = /\b(?:in.home.only|ISS.only)\b/i.test(q)
    ? "TX_DAHS_ISS_ONLY"
    : /\b(?:ICF\/IID|ICF)\b/i.test(q)
      ? "TX_ICF_IID"
      : /\b(?:DAHS|adult day health)\b/i.test(q)
        ? "TX_DAHS"
        : undefined;
  const facilityId = q.match(/\b(?:facility\s*(?:ID|number|#)\s*)?(\d{3,8})\b/i)?.[1];
  const name = facilityId
    ? facilityId
    : q
        .replace(
          /\b(?:Texas|TX|HHSC|ICF\/IID|ICF|DAHS|adult day health|in.home.only|regulated provider|location|facilities|providers|find|show|me|near)\b/gi,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim();
  return { providerClass, q: name.length > 2 ? name : "" };
}
