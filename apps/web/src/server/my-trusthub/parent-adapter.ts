/**
 * My TrustHub — Senior parent adapter (server side). PARENT SYNC IS OFF.
 *
 * Senior speaks the shared production hand-off protocol used by Move and
 * Lender. Only the specialist identity differs.
 *
 *   1. The device Save happens first and never waits for anything.
 *   2. This server proves the profile is a current public CMS nursing-home
 *      profile and derives its identity (publication.ts). The browser supplies
 *      only the CCN of the page it is on and an intent.
 *   3. This server builds the shared v3 manifest (manifest.ts) and stages it
 *      with My TrustHub in two signed calls:
 *        prepareGuestProfileTransfer    -> transferRef, manifestDigest
 *        prepareProfileSaveContinuation -> continuationRef
 *      each a POST of { version, operation, input } to the parent API carrying
 *      a Senior service assertion (senior-assertion.ts, scope transfer:stage,
 *      bound to this browser's hand-off binding).
 *   4. The browser posts { continuationRef, intent } to the parent form at
 *      https://www.asktrusthub.com/my/profile-save (top-level navigation).
 *   5. The parent calls back over the signed source channel
 *      (source-callback.ts): resolve, source, acknowledge.
 *   6. An account Save or Unsave is reported only when the acknowledgement for
 *      that hand-off and this browser is held (ack-store.ts).
 *
 * GATE. Release exposure comes from the deployment environment, as on Lender:
 *
 *   NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED       "1" = master switch
 *   MTH_SENIOR_PARENT_SAVE_MODE                  "production" = server side on
 *   NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS   comma-separated CCNs; empty = broad
 *
 * None is set anywhere today. Master off, a missing or different mode, or a
 * malformed canary list all mean OFF: nothing is read, built, signed or sent,
 * and no request ever goes to Ask.
 */
import { ASSERTION_HEADER, signSeniorAssertion, type AssertionKey } from "./senior-assertion";
import type { AckStore } from "./ack-store";
import {
  PARENT_API_PATH,
  PARENT_FORM_PATH,
  PARENT_ORIGIN,
  RUNTIME_VERSION,
  SENIOR_CCN,
  manifestDigest,
  seniorManifest,
  type SeniorManifest,
} from "./manifest";
import { resolveByCcn, type NotEligibleReason, type ProfileReader } from "./publication";

/** Real published CMS nursing-home profiles proposed for the first live proof.
 * Listing them here activates nothing; the canary is whatever the environment names. */
export const SENIOR_CANARIES = [
  { ccn: "015009", slug: "burns-nursing-home-inc" },
  { ccn: "055223", slug: "san-jacinto-valley-post-acute" },
  { ccn: "155805", slug: "addison-pointe-health-and-rehabilitation-center" },
] as const;

export type ParentGate = {
  enabled: boolean;
  broad: boolean;
  canary: boolean;
  ccns: readonly string[];
};
export type ReleaseEnv = {
  NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED?: string;
  NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS?: string;
  MTH_SENIOR_PARENT_SAVE_MODE?: string;
};
const GATE_OFF: ParentGate = { enabled: false, broad: false, canary: false, ccns: [] };

/** A well-formed, duplicate-free CCN list, [] when unset, null when malformed. */
export function canaryCcnList(raw: string | undefined): readonly string[] | null {
  if (raw === undefined || raw.trim() === "") return [];
  const ccns: string[] = [];
  for (const part of raw.split(",")) {
    const ccn = part.trim();
    if (!ccn) continue;
    if (!SENIOR_CCN.test(ccn) || ccns.includes(ccn)) return null;
    ccns.push(ccn);
  }
  return ccns;
}

/** Master off, or any malformed mode or canary list, stays off. */
export function productionParentGate(env?: ReleaseEnv): ParentGate {
  const source: ReleaseEnv = env ?? {
    NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED: process.env.NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED,
    NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS:
      process.env.NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS,
    MTH_SENIOR_PARENT_SAVE_MODE: process.env.MTH_SENIOR_PARENT_SAVE_MODE,
  };
  const ccns = canaryCcnList(source.NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS);
  if (
    ccns === null ||
    source.NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED !== "1" ||
    (source.MTH_SENIOR_PARENT_SAVE_MODE ?? "").trim() !== "production"
  )
    return GATE_OFF;
  return ccns.length === 0
    ? { enabled: true, broad: true, canary: false, ccns }
    : { enabled: true, broad: false, canary: true, ccns };
}
/** A profile may hand off only when the gate admits it. */
export function gateAllows(ccn: string, gate: ParentGate): boolean {
  if (!gate.enabled) return false;
  return gate.broad || (gate.canary && gate.ccns.includes(ccn));
}
export type ParentSyncMode = "off" | "gated";
export const parentSyncMode = (gate: ParentGate): ParentSyncMode =>
  gate.enabled ? "gated" : "off";

export type HandoffIntent = "save" | "save_signin" | "unsave";
const INTENTS: readonly string[] = ["save", "save_signin", "unsave"];
export type ParentResult = {
  transferRef?: string;
  manifestDigest?: string;
  continuationRef?: string;
  expiresAt?: number;
};
export type ParentResponse = { ok: true; operation: string; result: ParentResult } | { ok: false };
export type ParentTransport = (call: {
  operation: string;
  body: string;
  assertion: string;
}) => Promise<ParentResponse>;

/** Production signer and transport, from dedicated Senior values. Returns
 * nothing usable unless the key is present and the parent origin, if set, is
 * exactly the pinned Ask origin. Only called when the gate is open. */
export function productionHandoffDeps(env: Record<string, string | undefined> = process.env): {
  key: AssertionKey | null;
  parent: ParentTransport | null;
} {
  const kid = env.MY_TRUSTHUB_V23_SENIOR_KEY_ID?.trim() ?? "";
  const pem = env.MY_TRUSTHUB_V23_SENIOR_SIGNING_PRIVATE_KEY_PEM ?? "";
  const configured = env.MY_TRUSTHUB_V23_PARENT_ORIGIN?.trim();
  if (configured && configured !== PARENT_ORIGIN) return { key: null, parent: null };
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid) || !pem.includes("PRIVATE KEY"))
    return { key: null, parent: null };
  return {
    key: { kid, pem },
    parent: async (call) => {
      const response = await fetch(PARENT_ORIGIN + PARENT_API_PATH, {
        method: "POST",
        body: call.body,
        headers: { "content-type": "application/json", [ASSERTION_HEADER]: call.assertion },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { ok: false };
      const body = (await response.json()) as {
        ok?: boolean;
        operation?: string;
        result?: ParentResult;
      };
      if (!body || body.ok !== true || typeof body.operation !== "string" || !body.result)
        return { ok: false };
      return { ok: true, operation: body.operation, result: body.result };
    },
  };
}

export type PrepareResult =
  | { state: "unavailable"; localCopy: "keep" }
  | {
      state: "local_only";
      reason: NotEligibleReason | "sync_off" | "unsigned" | "parent_declined";
      localCopy: "keep";
    }
  | {
      state: "continue";
      target: string;
      continuationRef: string;
      intent: HandoffIntent;
      localCopy: "keep";
    };

export type AdapterDeps = {
  gate: ParentGate;
  reader: ProfileReader;
  key: AssertionKey | null;
  parent: ParentTransport | null;
  acks: AckStore | null;
  now(): number;
};

const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const keep = { localCopy: "keep" } as const;

async function postParent(
  deps: AdapterDeps,
  operation: "prepareGuestProfileTransfer" | "prepareProfileSaveContinuation",
  input:
    | SeniorManifest
    | { sourceHub: "senior"; audience: "ask"; transferRef: string; manifestDigest: string },
  browser: string,
  now: number,
): Promise<ParentResult | null> {
  if (!deps.key || !deps.parent) return null;
  const body = JSON.stringify({ version: RUNTIME_VERSION, operation, input });
  const assertion = signSeniorAssertion(
    deps.key,
    "senior",
    PARENT_ORIGIN + PARENT_API_PATH,
    "transfer:stage",
    Buffer.from(body),
    browser,
    null,
    null,
    now,
  );
  const response = await deps.parent({ operation, body, assertion });
  if (!response.ok || response.operation !== operation) return null;
  return response.result;
}

/** Prepare one Save or Unsave for the nursing-home profile with this CCN. The
 * device copy is never affected by the outcome. `browserBinding` is this
 * browser's HttpOnly hand-off binding; it is the assertion's browser claim. */
export async function prepareParentSave(
  deps: AdapterDeps,
  ccn: unknown,
  intent: unknown,
  browserBinding: string,
): Promise<PrepareResult> {
  if (!deps.gate.enabled) return { state: "unavailable", ...keep };
  if (typeof intent !== "string" || !INTENTS.includes(intent) || !OPAQUE.test(browserBinding))
    return { state: "unavailable", ...keep };
  // The gate is checked before anything is read: a profile outside the canary costs no lookup.
  if (typeof ccn !== "string" || !SENIOR_CCN.test(ccn))
    return { state: "local_only", reason: "invalid_ccn", ...keep };
  if (!gateAllows(ccn, deps.gate)) return { state: "local_only", reason: "sync_off", ...keep };
  const resolved = await resolveByCcn(deps.reader, ccn);
  if (!resolved.eligible) return { state: "local_only", reason: resolved.reason, ...keep };
  if (!deps.key || !deps.parent) return { state: "local_only", reason: "unsigned", ...keep };
  const manifest = seniorManifest(resolved.identity),
    now = deps.now();
  try {
    const staged = await postParent(
      deps,
      "prepareGuestProfileTransfer",
      manifest,
      browserBinding,
      now,
    );
    // The parent stages nothing unless it holds exactly one accepted binding for this identity.
    if (!staged) return { state: "local_only", reason: "parent_declined", ...keep };
    if (
      staged.manifestDigest !== manifestDigest(manifest) ||
      !OPAQUE.test(String(staged.transferRef)) ||
      !Number.isFinite(staged.expiresAt) ||
      (staged.expiresAt ?? 0) <= now
    )
      return { state: "unavailable", ...keep };
    const continuation = await postParent(
      deps,
      "prepareProfileSaveContinuation",
      {
        sourceHub: "senior",
        audience: "ask",
        transferRef: staged.transferRef!,
        manifestDigest: staged.manifestDigest!,
      },
      browserBinding,
      now,
    );
    if (
      !continuation ||
      !OPAQUE.test(String(continuation.continuationRef)) ||
      !Number.isFinite(continuation.expiresAt) ||
      (continuation.expiresAt ?? 0) <= now ||
      (continuation.expiresAt ?? 0) > (staged.expiresAt ?? 0)
    )
      return { state: "unavailable", ...keep };
    return {
      state: "continue",
      target: PARENT_ORIGIN + PARENT_FORM_PATH,
      continuationRef: continuation.continuationRef!,
      intent: intent as HandoffIntent,
      ...keep,
    };
  } catch {
    // Parent unreachable or misbehaving: fail closed, the device Save stands.
    return { state: "unavailable", ...keep };
  }
}

/** Presentation only: what the parent acknowledged for one hand-off staged for
 * this browser. `unavailable` when it cannot be read; never a guess. */
export async function parentStatus(
  deps: AdapterDeps,
  continuationRef: unknown,
  browserBinding: string,
): Promise<"parent_acknowledged" | "pending" | "unavailable"> {
  if (
    !deps.gate.enabled ||
    typeof continuationRef !== "string" ||
    !OPAQUE.test(continuationRef) ||
    !OPAQUE.test(browserBinding) ||
    !deps.acks
  )
    return "unavailable";
  try {
    return (await deps.acks.read(continuationRef, browserBinding, deps.now()))
      ? "parent_acknowledged"
      : "pending";
  } catch {
    return "unavailable";
  }
}
