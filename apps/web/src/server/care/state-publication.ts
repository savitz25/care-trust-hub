import "server-only";
import {
  CONSUMER_PUBLISHABLE_STATE_CLAIMS,
  isPublishableStateCode,
  selectPublishedStateIntelligence,
  type PublishedStateIntelligence,
  type ResolutionState,
} from "@care/domain";
import { getCareDatabasePool } from "./db";

interface ClaimRow {
  claim_type: string;
  resolution_state: ResolutionState;
  claim_value: unknown;
  resolved_at: Date;
}

function jsonbString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "null" ? trimmed : null;
  }
  return null;
}

export async function getPublishedStateIntelligence(
  ccn: string,
  stateCode: string,
): Promise<PublishedStateIntelligence | null> {
  const normalized = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized) || !isPublishableStateCode(stateCode)) return null;

  const result = await getCareDatabasePool().query<ClaimRow>(
    `SELECT DISTINCT ON (c.claim_type)
       c.claim_type, c.resolution_state, c.claim_value, c.resolved_at
     FROM published_state_claim c
     JOIN provider_identifier pi ON pi.provider_id = c.provider_id
       AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
     WHERE pi.identifier_value = $1
       AND c.claim_type = ANY($2::text[])
     ORDER BY c.claim_type, c.resolved_at DESC, c.created_at DESC`,
    [normalized, [...CONSUMER_PUBLISHABLE_STATE_CLAIMS]],
  );

  return selectPublishedStateIntelligence({
    stateCode,
    claims: result.rows.map((row) => ({
      claimType: row.claim_type,
      resolutionState: row.resolution_state,
      value: jsonbString(row.claim_value),
      resolvedAt: row.resolved_at.toISOString(),
    })),
  });
}
