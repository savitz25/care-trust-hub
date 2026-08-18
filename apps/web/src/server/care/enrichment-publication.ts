import "server-only";
import {
  CONSUMER_PUBLISHABLE_CLAIM_TYPES,
  publicPhonesMatch,
  selectPublishedFacilityEnrichment,
  type FacilityClaimRecord,
  type ResolutionState,
} from "@care/domain";
import { getCareDatabasePool } from "./db";
import type { CarePublishedFacilityEnrichment, CareProviderDetail } from "./types";

interface ClaimRow {
  claim_type: string;
  resolution_state: ResolutionState;
  publication_eligible: boolean;
  claim_value: unknown;
  resolved_at: Date;
}

interface IdentityRow {
  resolution_state: ResolutionState;
}

function jsonbString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "null" ? trimmed : null;
  }
  return null;
}

function recordsFromRows(rows: ClaimRow[]): FacilityClaimRecord[] {
  return rows.map((row) => ({
    claimType: row.claim_type,
    resolutionState: row.resolution_state,
    publicationEligible: row.publication_eligible,
    value: jsonbString(row.claim_value),
    resolvedAt: row.resolved_at.toISOString(),
  }));
}

export async function getPublishedFacilityEnrichment(
  ccn: string,
  cms: Pick<CareProviderDetail, "providerName" | "telephone">,
): Promise<CarePublishedFacilityEnrichment> {
  const normalized = ccn.trim().toUpperCase();
  const empty: CarePublishedFacilityEnrichment = {
    website: null,
    phone: null,
    publicAlias: null,
    phoneMatchesCms: false,
  };
  if (!/^[A-Z0-9]{6}$/.test(normalized)) return empty;

  const pool = getCareDatabasePool();
  const [claims, identity] = await Promise.all([
    pool.query<ClaimRow>(
      `SELECT DISTINCT ON (c.claim_type)
         c.claim_type, c.resolution_state, c.publication_eligible, c.claim_value, c.resolved_at
       FROM published_facility_claim c
       JOIN provider_identifier pi ON pi.provider_id = c.provider_id
         AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
       WHERE pi.identifier_value = $1
         AND c.claim_type = ANY($2::text[])
       ORDER BY c.claim_type, c.resolved_at DESC, c.created_at DESC`,
      [normalized, [...CONSUMER_PUBLISHABLE_CLAIM_TYPES]],
    ),
    pool.query<IdentityRow>(
      `SELECT c.resolution_state
       FROM facility_claim c
       JOIN provider_identifier pi ON pi.provider_id = c.provider_id
         AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
       WHERE pi.identifier_value = $1
         AND c.claim_type = 'google_place_identity'
         AND c.effective_to IS NULL
       ORDER BY c.resolved_at DESC, c.created_at DESC
       LIMIT 1`,
      [normalized],
    ),
  ]);

  const selected = selectPublishedFacilityEnrichment({
    claims: recordsFromRows(claims.rows),
    identityState: identity.rows[0]?.resolution_state ?? null,
    cmsName: cms.providerName,
    cmsPhone: cms.telephone,
  });
  return {
    ...selected,
    phoneMatchesCms: publicPhonesMatch(selected.phone?.value ?? null, cms.telephone),
  };
}
