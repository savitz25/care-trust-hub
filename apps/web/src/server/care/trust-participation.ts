import "server-only";
import { getCareDatabasePool } from "./db";

export const trustRequestTypes = [
  "profile_claim",
  "trusthub_correction",
  "source_data_concern",
  "provider_factual_context",
] as const;
export type TrustRequestType = (typeof trustRequestTypes)[number];

export function applyReviewedTrustHubOverride<T>(
  originalDerivedValue: T,
  override: { status: "active" | "revoked"; correctedValue: T } | null,
): T {
  return override?.status === "active" ? override.correctedValue : originalDerivedValue;
}

export interface TrustRequestInput {
  requestType: string;
  ccn?: string;
  organizationId?: string;
  submitterName: string;
  submitterRole: string;
  submitterOrganization: string;
  submitterEmail: string;
  submitterPhone?: string;
  description: string;
  evidenceLinks?: string[];
  referencedSection?: string;
  website?: string;
}
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) || null : null;
export function validateTrustRequest(input: TrustRequestInput) {
  const errors: string[] = [];
  const lengthLimits: Array<[unknown, number, string]> = [
    [input.ccn, 6, "CMS provider ID"],
    [input.organizationId, 36, "Organization reference"],
    [input.submitterName, 160, "Name"],
    [input.submitterRole, 160, "Role"],
    [input.submitterOrganization, 240, "Organization"],
    [input.submitterEmail, 320, "Email"],
    [input.submitterPhone, 40, "Phone"],
    [input.referencedSection, 120, "Evidence section"],
  ];
  for (const [value, limit, label] of lengthLimits) {
    if (typeof value === "string" && value.trim().length > limit) {
      errors.push(`${label} is too long.`);
    }
  }
  if (!trustRequestTypes.includes(input.requestType as TrustRequestType))
    errors.push("Choose a valid request type.");
  const ccn = clean(input.ccn, 6)?.toUpperCase() ?? null;
  if (ccn && !/^[A-Z0-9]{6}$/.test(ccn))
    errors.push("CMS provider ID must contain six letters or numbers.");
  const organizationId = clean(input.organizationId, 36);
  if (organizationId && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(organizationId))
    errors.push("Organization reference is invalid.");
  const name = clean(input.submitterName, 160),
    role = clean(input.submitterRole, 160),
    organization = clean(input.submitterOrganization, 240);
  const email = clean(input.submitterEmail, 320)?.toLowerCase() ?? null;
  const description = clean(input.description, 5000);
  const descriptionLimit = input.requestType === "provider_factual_context" ? 3000 : 5000;
  if (typeof input.description === "string" && input.description.trim().length > descriptionLimit) {
    errors.push(`Description must be ${descriptionLimit.toLocaleString("en-US")} characters or fewer.`);
  }
  if (!name || !role || !organization) errors.push("Name, role, and organization are required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push("Enter a valid email address.");
  if (!description || description.length < 20)
    errors.push("Provide at least 20 characters of factual detail.");
  const links = (Array.isArray(input.evidenceLinks) ? input.evidenceLinks : [])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);
  for (const link of links) {
    if (link.length > 1000) {
      errors.push("Evidence links must be 1,000 characters or fewer.");
      continue;
    }
    try {
      if (new URL(link).protocol !== "https:") errors.push("Evidence links must use HTTPS.");
    } catch {
      errors.push("Evidence links must be valid URLs.");
    }
  }
  return {
    errors,
    value: {
      requestType: input.requestType as TrustRequestType,
      ccn,
      organizationId,
      name,
      role,
      organization,
      email,
      phone: clean(input.submitterPhone, 40),
      description,
      links,
      referencedSection: clean(input.referencedSection, 120),
    },
    honeypot: Boolean(clean(input.website, 100)),
  };
}

export async function submitTrustRequest(input: TrustRequestInput): Promise<{ id: string }> {
  const parsed = validateTrustRequest(input);
  if (parsed.honeypot) return { id: "received" };
  if (parsed.errors.length) throw new RangeError(parsed.errors.join(" "));
  const value = parsed.value;
  const client = await getCareDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const recent = await client.query(
      `SELECT count(*)::int count FROM trust_request WHERE submitter_email=$1 AND submitted_at>now()-interval '1 hour'`,
      [value.email],
    );
    if (Number(recent.rows[0].count) >= 5)
      throw new RangeError("Too many recent requests. Please try again later.");
    const provider = value.ccn
      ? await client.query(
          `SELECT provider_id FROM provider_identifier WHERE issuer='CMS' AND identifier_type='CCN' AND identifier_value=$1 AND valid_from IS NULL LIMIT 1`,
          [value.ccn],
        )
      : { rows: [] };
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO trust_request(request_type,provider_id,organization_id,cms_ccn,submitter_name,submitter_role,submitter_organization,submitter_email,submitter_phone,factual_description,evidence_links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING id`,
      [
        value.requestType,
        provider.rows[0]?.provider_id ?? null,
        value.organizationId,
        value.ccn,
        value.name,
        value.role,
        value.organization,
        value.email,
        value.phone,
        value.description,
        JSON.stringify(value.links),
      ],
    );
    const id = inserted.rows[0].id;
    for (const link of value.links)
      await client.query(
        `INSERT INTO trust_request_evidence(trust_request_id,evidence_url,is_private) VALUES($1,$2,true)`,
        [id, link],
      );
    if (value.requestType === "provider_factual_context")
      await client.query(
        `INSERT INTO provider_context_submission(trust_request_id,provider_id,organization_id,referenced_section,public_text) VALUES($1,$2,$3,$4,$5)`,
        [
          id,
          provider.rows[0]?.provider_id ?? null,
          value.organizationId,
          value.referencedSection,
          value.description,
        ],
      );
    await client.query("COMMIT");
    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getApprovedProviderContext(ccn: string) {
  if (!/^[A-Z0-9]{6}$/.test(ccn)) return [];
  const result = await getCareDatabasePool().query<{
    id: string;
    public_text: string;
    submitted_at: Date;
    approved_at: Date;
    referenced_section: string | null;
  }>(
    `SELECT pcs.id,pcs.public_text,pcs.submitted_at,pcs.approved_at,pcs.referenced_section FROM provider_context_submission pcs JOIN provider_identifier pi ON pi.provider_id=pcs.provider_id WHERE pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.identifier_value=$1 AND pi.valid_from IS NULL AND pcs.moderation_status='approved' ORDER BY pcs.approved_at DESC LIMIT 10`,
    [ccn],
  );
  return result.rows.map((row) => ({
    id: row.id,
    text: row.public_text,
    submittedAt: row.submitted_at.toISOString(),
    approvedAt: row.approved_at.toISOString(),
    referencedSection: row.referenced_section,
  }));
}
