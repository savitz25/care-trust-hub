import "server-only";
import {
  normalizeProviderBusinessContactKey,
  selectPublicProviderBusinessContact,
  type ProviderBusinessContactType,
  type PublicProviderBusinessContact,
} from "@care/domain";
import { getCareDatabasePool } from "./db";

interface ContactQueryRow {
  provider_type: string;
  provider_key: string;
  website_url: string | null;
  email: string | null;
  phone_override: string | null;
  source_urls: string[] | null;
  source_type: string;
  verified_at: Date | string | null;
  is_public: boolean;
  updated_at: Date | string | null;
}

function isUndefinedTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Public business contact for one provider. Missing table, missing row, and
 * is_public false all return null so the page renders nothing.
 */
export async function getPublicProviderBusinessContact(
  providerType: ProviderBusinessContactType,
  providerKey: string,
): Promise<PublicProviderBusinessContact | null> {
  const identity = normalizeProviderBusinessContactKey(providerType, providerKey);
  if (!identity) return null;
  try {
    const result = await getCareDatabasePool().query<ContactQueryRow>(
      `SELECT provider_type, provider_key, website_url, email, phone_override,
              source_urls, source_type, verified_at, is_public, updated_at
         FROM provider_business_contact
        WHERE provider_type = $1
          AND provider_key = $2
          AND is_public
        LIMIT 1`,
      [identity.providerType, identity.providerKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return selectPublicProviderBusinessContact({
      providerType: row.provider_type,
      providerKey: row.provider_key,
      websiteUrl: row.website_url,
      email: row.email,
      phoneOverride: row.phone_override,
      sourceUrls: row.source_urls ?? [],
      sourceType: row.source_type,
      confidence: null,
      verifiedAt: iso(row.verified_at),
      isPublic: row.is_public,
      updatedAt: iso(row.updated_at),
    });
  } catch (error) {
    if (isUndefinedTable(error)) return null;
    throw error;
  }
}
