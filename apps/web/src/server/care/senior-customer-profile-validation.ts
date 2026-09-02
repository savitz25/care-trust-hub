import "server-only";
import { createHash } from "node:crypto";
import { productionOrigin } from "@/config/deployment";
import { getCareDatabasePool } from "./db";
import { homeHealthHref, hospiceHref, providerHref } from "./consumer";
import type { SeniorProviderClass } from "./senior-ask-contract";

export const SENIOR_CUSTOMER_VALIDATION_CONTRACT = "senior-customer-profile-validation-v1";
export const SENIOR_CUSTOMER_VALIDATION_VERSION = "1.0.0";

const RESPONSE_SCHEMA = {
  request: ["providerClass", "cmsCcn", "nativeProfileId", "canonicalProfileUrl"],
  success: [
    "contract",
    "contractVersion",
    "schemaFingerprint",
    "contractFingerprint",
    "hub",
    "providerClass",
    "nativeProfileId",
    "cmsCcn",
    "displayName",
    "publicationState",
    "current",
    "canonicalProfileUrl",
    "provenance",
  ],
  failure: [
    "contract",
    "contractVersion",
    "schemaFingerprint",
    "contractFingerprint",
    "hub",
    "status",
    "errorCode",
    "message",
  ],
} as const;
const CONTRACT_SEMANTICS = {
  identity: "providerClass+nativeProfileId+CMS_CCN+canonicalProfileUrl",
  eligible: "exact current public canonical SeniorTrustHub profile only",
  classes: ["home_health", "hospice", "nursing_home"],
  noFuzzy: true,
  noAuthorizationClaim: true,
  noOwnershipOrChainBinding: true,
} as const;
function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export const SENIOR_CUSTOMER_VALIDATION_SCHEMA_FINGERPRINT = fingerprint(RESPONSE_SCHEMA);
export const SENIOR_CUSTOMER_VALIDATION_CONTRACT_FINGERPRINT = fingerprint(CONTRACT_SEMANTICS);

export type SeniorCustomerValidationErrorCode =
  | "invalid_request"
  | "invalid_provider_class"
  | "invalid_ccn"
  | "profile_not_found"
  | "historical_profile"
  | "profile_not_public"
  | "publication_hold"
  | "native_profile_mismatch"
  | "ccn_mismatch"
  | "provider_class_mismatch"
  | "canonical_destination_mismatch"
  | "backend_unavailable";

export class SeniorCustomerValidationError extends Error {
  constructor(
    readonly code: SeniorCustomerValidationErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SeniorCustomerValidationError";
  }
}

export type SeniorCustomerValidationRequest = {
  providerClass: SeniorProviderClass;
  cmsCcn: string;
  nativeProfileId: string;
  canonicalProfileUrl: string;
};

type CurrentProfile = SeniorCustomerValidationRequest & {
  displayName: string;
  sourceFamily: string;
  sourceAsOf: string | null;
};
const CLASSES = new Set<SeniorProviderClass>(["nursing_home", "home_health", "hospice"]);

export function normalizeSeniorCustomerValidationRequest(
  input: unknown,
): SeniorCustomerValidationRequest {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new SeniorCustomerValidationError(
      "invalid_request",
      400,
      "A complete profile identity is required.",
    );
  const row = input as Record<string, unknown>;
  const allowed = new Set(["providerClass", "cmsCcn", "nativeProfileId", "canonicalProfileUrl"]);
  if (Object.keys(row).some((key) => !allowed.has(key)))
    throw new SeniorCustomerValidationError(
      "invalid_request",
      400,
      "The request contains an unsupported field.",
    );
  if (
    typeof row.providerClass !== "string" ||
    !CLASSES.has(row.providerClass as SeniorProviderClass)
  )
    throw new SeniorCustomerValidationError(
      "invalid_provider_class",
      400,
      "Provider class must be nursing_home, home_health, or hospice.",
    );
  const cmsCcn = typeof row.cmsCcn === "string" ? row.cmsCcn.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{6}$/.test(cmsCcn))
    throw new SeniorCustomerValidationError(
      "invalid_ccn",
      400,
      "CMS CCN must contain six letters or digits.",
    );
  const nativeProfileId =
    typeof row.nativeProfileId === "string" ? row.nativeProfileId.trim().toLowerCase() : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      nativeProfileId,
    )
  )
    throw new SeniorCustomerValidationError(
      "invalid_request",
      400,
      "Native profile ID must be a valid UUID.",
    );
  let canonicalProfileUrl = "";
  try {
    const url = new URL(String(row.canonicalProfileUrl ?? ""));
    if (url.protocol !== "https:" || url.origin !== productionOrigin.origin) throw new Error();
    canonicalProfileUrl = url.href;
  } catch {
    throw new SeniorCustomerValidationError(
      "invalid_request",
      400,
      "Canonical profile URL must be a SeniorTrustHub HTTPS URL.",
    );
  }
  return {
    providerClass: row.providerClass as SeniorProviderClass,
    cmsCcn,
    nativeProfileId,
    canonicalProfileUrl,
  };
}

function publicUrl(path: string) {
  return new URL(path, productionOrigin.href).href;
}

async function currentProfile(
  providerClass: SeniorProviderClass,
  ccn: string,
  nativeProfileId?: string,
): Promise<CurrentProfile | null> {
  const pool = getCareDatabasePool();
  if (providerClass === "nursing_home") {
    const result = await pool.query<{
      provider_id: string;
      ccn: string;
      provider_name: string;
      source_modified_at: Date | null;
    }>(
      `
      WITH current_ingest AS (
        SELECT ir.id ingest_run_id,sr.id source_release_id,sr.source_modified_at
        FROM source_dataset sd JOIN source_release sr ON sr.source_dataset_id=sd.id
        JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
        WHERE sd.dataset_key='nursing-home-provider-information'
        ORDER BY sr.source_modified_at DESC NULLS LAST,ir.completed_at DESC LIMIT 1
      )
      SELECT fs.provider_id::text,pi.identifier_value ccn,fs.provider_name,ci.source_modified_at
      FROM current_ingest ci JOIN facility_snapshot fs ON fs.source_release_id=ci.source_release_id AND fs.ingest_run_id=ci.ingest_run_id
      JOIN provider_identifier pi ON pi.provider_id=fs.provider_id AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
      WHERE ${nativeProfileId ? "fs.provider_id=$1::uuid" : "pi.identifier_value=$1"} LIMIT 1`,
      [nativeProfileId ?? ccn],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      providerClass,
      cmsCcn: row.ccn,
      nativeProfileId: row.provider_id,
      displayName: row.provider_name,
      canonicalProfileUrl: publicUrl(
        providerHref({ ccn: row.ccn, providerName: row.provider_name }),
      ),
      sourceFamily: "CMS Provider Information",
      sourceAsOf: row.source_modified_at?.toISOString() ?? null,
    };
  }
  const table = providerClass === "home_health" ? "home_health_snapshot" : "hospice_snapshot";
  const result = await pool.query<{
    provider_id: string;
    cms_ccn: string;
    provider_name: string;
    source_modified_at: Date | null;
  }>(
    `
    SELECT DISTINCT ON (s.cms_ccn) s.provider_id::text,s.cms_ccn,s.provider_name,sr.source_modified_at
    FROM ${table} s JOIN source_release sr ON sr.id=s.source_release_id
    WHERE ${nativeProfileId ? "s.provider_id=$1::uuid" : "s.cms_ccn=$1"} ORDER BY s.cms_ccn,s.id DESC LIMIT 1`,
    [nativeProfileId ?? ccn],
  );
  const row = result.rows[0];
  if (!row) return null;
  const href =
    providerClass === "home_health"
      ? homeHealthHref(row.cms_ccn, row.provider_name)
      : hospiceHref(row.cms_ccn, row.provider_name);
  return {
    providerClass,
    cmsCcn: row.cms_ccn,
    nativeProfileId: row.provider_id,
    displayName: row.provider_name,
    canonicalProfileUrl: publicUrl(href),
    sourceFamily:
      providerClass === "home_health"
        ? "CMS Home Health Care Agencies"
        : "CMS Hospice General Information",
    sourceAsOf: row.source_modified_at?.toISOString() ?? null,
  };
}

async function classForCcn(ccn: string): Promise<SeniorProviderClass | null> {
  for (const providerClass of ["nursing_home", "home_health", "hospice"] as const)
    if (await currentProfile(providerClass, ccn)) return providerClass;
  return null;
}

async function isHistoricalNursingHome(ccn: string): Promise<boolean> {
  const result = await getCareDatabasePool().query<{ directory_status: string }>(
    `SELECT directory_status FROM provider_directory_status WHERE ccn=$1
     ORDER BY observed_at DESC,id DESC LIMIT 1`,
    [ccn],
  );
  return ["ABSENT_FROM_CURRENT_DIRECTORY", "TERMINATED_CONFIRMED", "HISTORICAL"].includes(
    result.rows[0]?.directory_status ?? "",
  );
}

export async function validateSeniorCustomerProfile(input: unknown) {
  const request = normalizeSeniorCustomerValidationRequest(input);
  const profile = await currentProfile(request.providerClass, request.cmsCcn);
  if (!profile) {
    const byNative = await currentProfile(
      request.providerClass,
      request.cmsCcn,
      request.nativeProfileId,
    );
    if (byNative)
      throw new SeniorCustomerValidationError(
        "ccn_mismatch",
        409,
        "The CMS CCN does not match the supplied native profile.",
      );
    const actual = await classForCcn(request.cmsCcn);
    if (actual)
      throw new SeniorCustomerValidationError(
        "provider_class_mismatch",
        409,
        "The CMS CCN belongs to a different Senior provider class.",
      );
    if (request.providerClass === "nursing_home" && (await isHistoricalNursingHome(request.cmsCcn)))
      throw new SeniorCustomerValidationError(
        "historical_profile",
        409,
        "This Nursing Home profile is historical and is not in the current public directory.",
      );
    throw new SeniorCustomerValidationError(
      "profile_not_found",
      404,
      "No current public profile matches this class and CMS CCN.",
    );
  }
  if (profile.nativeProfileId !== request.nativeProfileId) {
    const byNative = await currentProfile(
      request.providerClass,
      request.cmsCcn,
      request.nativeProfileId,
    );
    if (byNative)
      throw new SeniorCustomerValidationError(
        "ccn_mismatch",
        409,
        "The CMS CCN and native profile ID identify different current profiles.",
      );
    throw new SeniorCustomerValidationError(
      "native_profile_mismatch",
      409,
      "The native profile ID does not match the current public profile.",
    );
  }
  if (profile.cmsCcn !== request.cmsCcn)
    throw new SeniorCustomerValidationError(
      "ccn_mismatch",
      409,
      "The CMS CCN does not match the current public profile.",
    );
  if (profile.canonicalProfileUrl !== request.canonicalProfileUrl)
    throw new SeniorCustomerValidationError(
      "canonical_destination_mismatch",
      409,
      "The canonical destination does not match the current public profile.",
    );
  return {
    contract: SENIOR_CUSTOMER_VALIDATION_CONTRACT,
    contractVersion: SENIOR_CUSTOMER_VALIDATION_VERSION,
    schemaFingerprint: SENIOR_CUSTOMER_VALIDATION_SCHEMA_FINGERPRINT,
    contractFingerprint: SENIOR_CUSTOMER_VALIDATION_CONTRACT_FINGERPRINT,
    hub: "senior" as const,
    providerClass: profile.providerClass,
    nativeProfileId: profile.nativeProfileId,
    cmsCcn: profile.cmsCcn,
    displayName: profile.displayName,
    publicationState: "public" as const,
    current: true,
    canonicalProfileUrl: profile.canonicalProfileUrl,
    provenance: {
      sourceFamily: profile.sourceFamily,
      sourceAsOf: profile.sourceAsOf,
      identityMethod:
        "Exact provider class, native provider UUID, CMS CCN, and canonical public destination.",
    },
  };
}

export const SENIOR_CUSTOMER_VALIDATION_CAPABILITIES = {
  contract: SENIOR_CUSTOMER_VALIDATION_CONTRACT,
  contractVersion: SENIOR_CUSTOMER_VALIDATION_VERSION,
  schemaFingerprint: SENIOR_CUSTOMER_VALIDATION_SCHEMA_FINGERPRINT,
  contractFingerprint: SENIOR_CUSTOMER_VALIDATION_CONTRACT_FINGERPRINT,
  hub: "senior",
  providerClasses: ["nursing_home", "home_health", "hospice"],
  requiredFields: ["providerClass", "cmsCcn", "nativeProfileId", "canonicalProfileUrl"],
  publicationSemantics:
    "Exact currently public profile validation only; no publication change and no claimant authorization inference.",
} as const;
