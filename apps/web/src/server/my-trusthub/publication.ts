/**
 * Senior's publication authority for a My TrustHub Save.
 *
 * Source: the same production read the customer-profile validation contract
 * uses — the current succeeded CMS Provider Information release joined to the
 * provider's CMS CCN (getSeniorClaimProfile("nursing_home", ccn)). Nothing is
 * copied or registered separately.
 * Grain: one current CMS nursing-home profile, identified by its CCN.
 *
 * A CCN that belongs to a home health agency or hospice, a historical or
 * terminated facility, a held profile, or no profile at all resolves to nothing
 * here. The browser's only input is the CCN of the page it is on; a name,
 * address, provider UUID or slug is never accepted as identity.
 */
import {
  SENIOR_CCN,
  SENIOR_IDENTIFIER_NAMESPACE,
  SENIOR_PROFILE_CLASS,
  SENIOR_SLUG,
  seniorReturnPath,
  type SeniorSaveIdentity,
} from "./manifest";

export type PublishedNursingHome = { ccn: string; canonicalPath: string };
export type ProfileReader = {
  /** The current, public CMS nursing-home profile for this CCN, or null. */
  nursingHomeByCcn(ccn: string): Promise<PublishedNursingHome | null>;
};
export type NotEligibleReason =
  | "invalid_ccn"
  | "not_public"
  | "not_canonical"
  | "source_unavailable";
export type Resolution =
  | { eligible: true; identity: SeniorSaveIdentity }
  | { eligible: false; reason: NotEligibleReason };

export async function resolveByCcn(reader: ProfileReader, ccn: unknown): Promise<Resolution> {
  if (typeof ccn !== "string" || !SENIOR_CCN.test(ccn))
    return { eligible: false, reason: "invalid_ccn" };
  try {
    const profile = await reader.nursingHomeByCcn(ccn);
    if (!profile || profile.ccn !== ccn) return { eligible: false, reason: "not_public" };
    // The canonical route must be exactly /facility/cms/<CCN>/<slug>.
    const match = /^\/facility\/cms\/([A-Z0-9]{6})\/([^/]+)$/.exec(profile.canonicalPath);
    if (!match || match[1] !== ccn || !SENIOR_SLUG.test(match[2]!))
      return { eligible: false, reason: "not_canonical" };
    return {
      eligible: true,
      identity: {
        hub: "senior",
        profileClass: SENIOR_PROFILE_CLASS,
        identifierNamespace: SENIOR_IDENTIFIER_NAMESPACE,
        sourceIdentifier: ccn,
        canonicalSlug: match[2]!,
        returnPath: seniorReturnPath(ccn, match[2]!),
      },
    };
  } catch {
    return { eligible: false, reason: "source_unavailable" };
  }
}

/** The parent asks about one exact profile identity in the shared shape
 * { hub, nativeId, profileClass }. Returns the identity with its canonical
 * slug, or null. */
export async function resolveByProfile(
  reader: ProfileReader,
  input: unknown,
): Promise<SeniorSaveIdentity | null> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const profile = input as Record<string, unknown>;
  if (
    Object.keys(profile).sort().join() !== "hub,nativeId,profileClass" ||
    profile.hub !== "senior" ||
    profile.profileClass !== SENIOR_PROFILE_CLASS
  )
    return null;
  const resolved = await resolveByCcn(reader, profile.nativeId);
  return resolved.eligible ? resolved.identity : null;
}
