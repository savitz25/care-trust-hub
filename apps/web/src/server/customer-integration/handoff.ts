import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { SeniorProviderClass } from "@/server/care/senior-ask-contract";

export const HANDOFF_TTL_SECONDS = 15 * 60;
export function mintSeniorHandoff(
  secret: string,
  profile: {
    nativeProfileId: string;
    cmsCcn: string;
    providerClass: SeniorProviderClass;
    canonicalProfileUrl: string;
    displayName: string;
  },
  now = new Date(),
) {
  if (secret.length < 32) throw new Error("ATH_HANDOFF_SECRET is unavailable");
  const iat = Math.floor(now.getTime() / 1000);
  const slug = new URL(profile.canonicalProfileUrl).pathname.split("/").filter(Boolean).at(-1)!;
  const payload = {
    v: 2 as const,
    aud: "asktrusthub" as const,
    hub_id: "senior" as const,
    native_profile_id: profile.nativeProfileId,
    slug,
    external_key: profile.cmsCcn,
    source_system: "cms" as const,
    home_state: null,
    identifier_namespace: "CMS_CCN" as const,
    entity_class: profile.providerClass,
    provider_class: profile.providerClass,
    canonical_profile_url: profile.canonicalProfileUrl,
    display_name: profile.displayName,
    iat,
    exp: iat + HANDOFF_TTL_SECONDS,
    nonce: randomBytes(24).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return { token: `${body}.${signature}`, payload };
}
