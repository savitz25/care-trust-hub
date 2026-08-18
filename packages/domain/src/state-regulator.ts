import { publicPhonesMatch, normalizeComparableName } from "./enrichment-publication";
import type { ResolutionState } from "./facility-intelligence";

/** Reusable state-regulator claim types. Not every state emits every type. */
export const STATE_CLAIM_TYPES = [
  "STATE_LICENSE_ID",
  "STATE_LICENSE_STATUS",
  "STATE_LICENSE_TYPE",
  "STATE_LICENSE_ISSUE_DATE",
  "STATE_LICENSE_EXPIRATION_DATE",
  "STATE_LICENSE_CAPACITY",
  "STATE_LICENSEE",
  "STATE_OPERATOR",
  "STATE_MANAGEMENT_ENTITY",
  "STATE_ADMINISTRATOR",
  "STATE_INSPECTION",
  "STATE_COMPLAINT",
  "STATE_ENFORCEMENT_ACTION",
  "STATE_FINE",
  "STATE_ORDER",
  "STATE_RESTRICTION",
  "STATE_CLOSURE_ACTION",
  "STATE_OWNERSHIP_CHANGE",
] as const;

export type StateClaimType = (typeof STATE_CLAIM_TYPES)[number];

export function isStateClaimType(value: string): value is StateClaimType {
  return (STATE_CLAIM_TYPES as readonly string[]).includes(value);
}

export interface StateCmsIdentity {
  cmsCcn: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  phone: string | null;
}

export interface StateLicenseIdentity {
  stateCode: string;
  stateLicenseId: string | null;
  stateCcn: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  phone: string | null;
}

export interface StateCmsResolution {
  state: ResolutionState;
  reason: string;
  matchedOn: string[];
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(
      /\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|suite|ste|unit)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeZip(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 5);
}

/**
 * Deterministic CMS ↔ state-license bridge.
 * CCN match is sufficient. Name similarity alone is never sufficient.
 */
export function resolveStateLicenseToCms(
  stateRecord: StateLicenseIdentity,
  cms: StateCmsIdentity,
): StateCmsResolution {
  const cmsCcn = cms.cmsCcn.trim().toUpperCase();
  const stateCcn = stateRecord.stateCcn?.trim().toUpperCase() ?? "";
  const sameState = stateRecord.stateCode.toUpperCase() === cms.state.toUpperCase();
  if (!sameState) {
    return {
      state: "REJECTED",
      reason: "State record is outside the CMS facility jurisdiction",
      matchedOn: [],
    };
  }
  if (stateCcn && stateCcn === cmsCcn) {
    return {
      state: "VERIFIED",
      reason: "State source supplied the same CMS CCN",
      matchedOn: ["cms_ccn"],
    };
  }

  const addressMatch =
    Boolean(normalizeAddress(stateRecord.address)) &&
    normalizeAddress(stateRecord.address) === normalizeAddress(cms.address);
  const zipMatch =
    Boolean(normalizeZip(stateRecord.zip)) &&
    normalizeZip(stateRecord.zip) === normalizeZip(cms.zip);
  const cityMatch =
    Boolean(stateRecord.city?.trim()) &&
    normalizeComparableName(stateRecord.city ?? "") === normalizeComparableName(cms.city ?? "");
  const phoneMatch = publicPhonesMatch(stateRecord.phone, cms.phone);
  const nameMatch =
    Boolean(stateRecord.name?.trim()) &&
    normalizeComparableName(stateRecord.name ?? "") === normalizeComparableName(cms.name);

  const matchedOn = [
    addressMatch ? "address" : null,
    zipMatch ? "zip" : null,
    cityMatch ? "city" : null,
    phoneMatch ? "phone" : null,
    nameMatch ? "name" : null,
  ].filter((item): item is string => Boolean(item));

  if (addressMatch && (zipMatch || cityMatch) && (phoneMatch || nameMatch)) {
    return {
      state: "VERIFIED",
      reason: "Exact address plus independent city/ZIP and name or phone corroboration",
      matchedOn,
    };
  }
  if (addressMatch && (zipMatch || cityMatch)) {
    return {
      state: "PROBABLE",
      reason: "Exact address and locality match without a second independent identifier",
      matchedOn,
    };
  }
  if (nameMatch && !addressMatch) {
    return {
      state: "REVIEW_REQUIRED",
      reason: "Name agreement without a deterministic location or CCN bridge",
      matchedOn,
    };
  }
  if (!matchedOn.length) {
    return { state: "UNRESOLVED", reason: "No overlapping identity evidence", matchedOn };
  }
  return {
    state: "REVIEW_REQUIRED",
    reason: "Partial identity overlap is not sufficient for a state-license relationship",
    matchedOn,
  };
}
