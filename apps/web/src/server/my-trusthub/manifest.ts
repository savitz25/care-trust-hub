/**
 * Shared My TrustHub profile-transfer manifest, Senior edition.
 *
 * This is the production wire used by Move and Lender ("v2-3/selected-profiles/3",
 * staged through "v2-3/parent-runtime/1"). Only the specialist identity differs.
 * The digest is the shared positional SHA-256; field order matches Ask.
 *
 * Senior identity inside the shared ProfileIdentity {hub, nativeId, profileClass},
 * exactly as Ask's contract (contracts/v2-3-profile-transfer.ts) already pins it:
 *
 *   hub          senior
 *   profileClass cms_facility
 *   nativeId     the CMS Certification Number (CCN), six letters or digits
 *   returnPath   /facility/cms/<CCN>/<slug>
 *
 * That is the CMS nursing-home profile grain and nothing else. Home health and
 * hospice agencies also carry a CCN but publish on other routes and are a
 * different class; state-licensed assisted living, Florida and Texas profiles
 * are keyed by state identifiers. None of those can be expressed here, so none
 * of them stage a parent Save. The provider UUID, name and address are never
 * identity.
 */
import { createHash } from "node:crypto";

export const TRANSFER_VERSION_V3 = "v2-3/selected-profiles/3" as const;
export const RUNTIME_VERSION = "v2-3/parent-runtime/1" as const;
export const PARENT_ORIGIN = "https://www.asktrusthub.com";
export const SENIOR_ORIGIN = "https://www.seniortrusthub.com";
export const PARENT_API_PATH = "/api/my-trusthub/profile-save";
export const PARENT_FORM_PATH = "/my/profile-save";
export const SOURCE_PATH = PARENT_API_PATH + "/source";
export const SENIOR_PROFILE_CLASS = "cms_facility" as const;
export const SENIOR_IDENTIFIER_NAMESPACE = "cms.ccn" as const;
export const SENIOR_CCN = /^[A-Z0-9]{6}$/;
/** Ask's shared slug rule; Senior slugs are lower-case and at most 80 characters. */
export const SENIOR_SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

export type SeniorProfile = {
  hub: "senior";
  nativeId: string;
  profileClass: typeof SENIOR_PROFILE_CLASS;
};
export type SeniorSaveIdentity = {
  hub: "senior";
  profileClass: typeof SENIOR_PROFILE_CLASS;
  identifierNamespace: typeof SENIOR_IDENTIFIER_NAMESPACE;
  /** The CMS CCN. */
  sourceIdentifier: string;
  canonicalSlug: string;
  returnPath: string;
};
export type SeniorManifest = {
  version: typeof TRANSFER_VERSION_V3;
  sourceHub: "senior";
  audience: "ask";
  selected: Array<{
    localItemId: string;
    revision: string;
    digest: string;
    profile: SeniorProfile;
  }>;
  returnTask: {
    kind: "profile";
    hub: "senior";
    canonicalSlug: string;
    profile: SeniorProfile;
    returnPath: string;
  };
};

export const seniorReturnPath = (ccn: string, slug: string) => `/facility/cms/${ccn}/${slug}`;

export function seniorItemDigest(nativeId: string, returnPath: string): string {
  return createHash("sha256")
    .update(JSON.stringify([nativeId, returnPath]))
    .digest("hex");
}

/** Built on the server from the publication read. Throws on anything not exact. */
export function seniorManifest(
  identity: Pick<SeniorSaveIdentity, "sourceIdentifier" | "canonicalSlug">,
): SeniorManifest {
  if (!SENIOR_CCN.test(identity.sourceIdentifier) || !SENIOR_SLUG.test(identity.canonicalSlug))
    throw new Error("invalid_identity");
  const returnPath = seniorReturnPath(identity.sourceIdentifier, identity.canonicalSlug);
  const profile: SeniorProfile = {
    hub: "senior",
    nativeId: identity.sourceIdentifier,
    profileClass: SENIOR_PROFILE_CLASS,
  };
  return {
    version: TRANSFER_VERSION_V3,
    sourceHub: "senior",
    audience: "ask",
    selected: [
      {
        localItemId: identity.sourceIdentifier,
        revision: "1",
        digest: seniorItemDigest(profile.nativeId, returnPath),
        profile,
      },
    ],
    returnTask: {
      kind: "profile",
      hub: "senior",
      canonicalSlug: identity.canonicalSlug,
      profile,
      returnPath,
    },
  };
}

/** Closed shape: exactly one selected CMS facility that is also the return task. */
export function isSeniorManifest(value: unknown): value is SeniorManifest {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const exact = (v: Record<string, unknown>, keys: string[]) =>
    Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
  const profile = (v: unknown): v is SeniorProfile =>
    object(v) &&
    exact(v, ["hub", "nativeId", "profileClass"]) &&
    v.hub === "senior" &&
    v.profileClass === SENIOR_PROFILE_CLASS &&
    typeof v.nativeId === "string" &&
    SENIOR_CCN.test(v.nativeId);
  if (
    !object(value) ||
    !exact(value, ["version", "sourceHub", "audience", "selected", "returnTask"])
  )
    return false;
  if (
    value.version !== TRANSFER_VERSION_V3 ||
    value.sourceHub !== "senior" ||
    value.audience !== "ask"
  )
    return false;
  const task = value.returnTask,
    selected = value.selected;
  if (
    !object(task) ||
    !exact(task, ["kind", "hub", "canonicalSlug", "profile", "returnPath"]) ||
    task.kind !== "profile" ||
    task.hub !== "senior" ||
    !profile(task.profile)
  )
    return false;
  if (
    typeof task.canonicalSlug !== "string" ||
    !SENIOR_SLUG.test(task.canonicalSlug) ||
    task.returnPath !== seniorReturnPath(task.profile.nativeId, task.canonicalSlug)
  )
    return false;
  if (!Array.isArray(selected) || selected.length !== 1) return false;
  const item = selected[0] as unknown;
  if (
    !object(item) ||
    !exact(item, ["localItemId", "revision", "digest", "profile"]) ||
    !profile(item.profile)
  )
    return false;
  return (
    item.localItemId === task.profile.nativeId &&
    item.revision === "1" &&
    item.profile.nativeId === task.profile.nativeId &&
    item.digest === seniorItemDigest(task.profile.nativeId, task.returnPath as string)
  );
}

/** Shared positional digest (identical to Ask's manifestDigest for version 3). */
export function manifestDigest(v: SeniorManifest): string {
  const profileKey = (p: { hub: string; nativeId: string; profileClass: string }) =>
    JSON.stringify([p.hub, p.nativeId, p.profileClass]);
  const task = [
    v.returnTask.kind,
    v.returnTask.hub,
    v.returnTask.canonicalSlug,
    v.returnTask.returnPath,
    profileKey(v.returnTask.profile),
  ];
  return createHash("sha256")
    .update(
      JSON.stringify([
        v.version,
        v.sourceHub,
        v.audience,
        v.selected.map((i) => [
          i.localItemId,
          i.revision,
          i.digest,
          i.profile.hub,
          i.profile.nativeId,
          i.profile.profileClass,
        ]),
        task,
      ]),
    )
    .digest("hex");
}
