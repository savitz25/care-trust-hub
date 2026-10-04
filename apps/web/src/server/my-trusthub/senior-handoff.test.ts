// @vitest-environment node
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { memoryAckStore } from "./ack-store";
import {
  PARENT_API_PATH,
  PARENT_FORM_PATH,
  PARENT_ORIGIN,
  RUNTIME_VERSION,
  SENIOR_ORIGIN,
  SOURCE_PATH,
  TRANSFER_VERSION_V3,
  isSeniorManifest,
  manifestDigest,
  seniorManifest,
  type SeniorManifest,
} from "./manifest";
import {
  SENIOR_CANARIES,
  canaryCcnList,
  gateAllows,
  parentStatus,
  parentSyncMode,
  prepareParentSave,
  productionHandoffDeps,
  productionParentGate,
  type AdapterDeps,
  type ParentGate,
  type ParentTransport,
} from "./parent-adapter";
import { COOKIE_NAME, ENDPOINT_PATH, handleSeniorProfileSave } from "./profile-save-http";
import { resolveByCcn, resolveByProfile, type ProfileReader } from "./publication";
import {
  ASSERTION_HEADER,
  ASSERTION_TTL_SECONDS,
  SENIOR_PRODUCTION_PINS,
  signSeniorAssertion,
  verifySeniorAssertion,
  type AssertionKey,
  type NonceStore,
} from "./senior-assertion";
import { handleSeniorSource, seniorPublication } from "./source-callback";
import {
  handoffTargetAllowed,
  parentSync,
  resumeDirect,
  startDirect,
  type DirectIntent,
  type DirectPorts,
} from "@/lib/my-trusthub/direct-save-client";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const ref = () => randomBytes(32).toString("base64url");
const UUID = "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b";

// Real published CMS nursing-home profiles (production, 2026-10-04) plus the
// classes that must never reach the parent.
const CANARY = [
  { ccn: "015009", slug: "burns-nursing-home-inc" },
  { ccn: "055223", slug: "san-jacinto-valley-post-acute" },
  { ccn: "155805", slug: "addison-pointe-health-and-rehabilitation-center" },
] as const;
const OTHER_NURSING_HOME = { ccn: "105001", slug: "unrelated-nursing-home" };
const NURSING_HOMES: Record<string, string> = Object.fromEntries(
  [...CANARY, OTHER_NURSING_HOME].map((c) => [c.ccn, `/facility/cms/${c.ccn}/${c.slug}`]),
);
// A home health agency and a hospice also carry CCNs; they are a different class.
const OTHER_CLASS_CCNS = ["017000", "011500"];
function source() {
  const reads: string[] = [];
  const reader: ProfileReader = {
    nursingHomeByCcn: async (ccn) => {
      reads.push(ccn);
      return NURSING_HOMES[ccn] ? { ccn, canonicalPath: NURSING_HOMES[ccn]! } : null;
    },
  };
  return { reader, reads };
}
const keypair = (kid: string) => {
  const pair = generateKeyPairSync("ed25519");
  return {
    priv: {
      kid,
      pem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    } as AssertionKey,
    pub: {
      kid,
      pem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    } as AssertionKey,
  };
};
const memoryNonces = (): NonceStore => {
  const seen = new Set<string>();
  return { claim: async (k) => (seen.has(k) ? false : (seen.add(k), true)) };
};
const CANARY_GATE: ParentGate = {
  enabled: true,
  broad: false,
  canary: true,
  ccns: CANARY.map((c) => c.ccn),
};
const OFF_GATE = productionParentGate({});
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/**
 * The pair, simulated end to end with the real Senior modules. `ask` behaves as
 * My TrustHub does for Move and Lender: it verifies the hub's service assertion
 * on the parent API, stages a transfer and a continuation, and when the browser
 * arrives on the form it calls the hub's signed source callback (source,
 * resolve, acknowledge). It acts on an account only under a session.
 */
function pair(gate: ParentGate = CANARY_GATE) {
  const seniorKey = keypair("senior-v23-test"),
    askKey = keypair("ask-v23-test");
  const { reader, reads } = source();
  const acks = memoryAckStore();
  const seniorNonces = memoryNonces(),
    askNonces = memoryNonces();
  const ask = {
    session: null as string | null,
    bindings: new Set<string>([...CANARY.map((c) => c.ccn), OTHER_NURSING_HOME.ccn]),
    saved: new Set<string>(),
    watches: [] as string[],
    transfers: new Map<string, { manifest: SeniorManifest; browser: string; expiresAt: number }>(),
    continuations: new Map<string, string>(),
    apiCalls: [] as Array<{
      operation: string;
      claims: Record<string, unknown>;
      envelope: Record<string, unknown>;
    }>,
    forms: [] as Array<{ target: string; fields: Record<string, string> }>,
    abandon: false,
    down: false,
    sourceStatuses: [] as number[],
  };
  const parent: ParentTransport = async (call) => {
    if (ask.down) throw new Error("ECONNREFUSED");
    const url = PARENT_ORIGIN + PARENT_API_PATH,
      bytes = Buffer.from(call.body);
    const request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", [ASSERTION_HEADER]: call.assertion },
      body: bytes,
    });
    let claims;
    try {
      claims = await verifySeniorAssertion(
        request,
        bytes,
        seniorKey.pub,
        "senior",
        "transfer:stage",
        askNonces,
      );
    } catch {
      return { ok: false };
    }
    const envelope = JSON.parse(call.body) as {
      version: string;
      operation: string;
      input: Record<string, unknown>;
    };
    ask.apiCalls.push({
      operation: envelope.operation,
      claims: claims as unknown as Record<string, unknown>,
      envelope: envelope as unknown as Record<string, unknown>,
    });
    if (
      Object.keys(envelope).sort().join() !== "input,operation,version" ||
      envelope.version !== RUNTIME_VERSION
    )
      return { ok: false };
    if (envelope.operation === "prepareGuestProfileTransfer") {
      const manifest = envelope.input as unknown as SeniorManifest;
      if (!isSeniorManifest(manifest) || !ask.bindings.has(manifest.returnTask.profile.nativeId))
        return { ok: false };
      const transferRef = ref(),
        expiresAt = Date.now() + 600_000;
      ask.transfers.set(transferRef, { manifest, browser: claims.browser, expiresAt });
      return {
        ok: true,
        operation: envelope.operation,
        result: { transferRef, manifestDigest: manifestDigest(manifest), expiresAt },
      };
    }
    if (envelope.operation === "prepareProfileSaveContinuation") {
      const input = envelope.input as {
        sourceHub: string;
        audience: string;
        transferRef: string;
        manifestDigest: string;
      };
      const transfer = ask.transfers.get(input.transferRef);
      if (
        !transfer ||
        transfer.browser !== claims.browser ||
        input.sourceHub !== "senior" ||
        input.audience !== "ask" ||
        input.manifestDigest !== manifestDigest(transfer.manifest)
      )
        return { ok: false };
      const continuationRef = ref();
      ask.continuations.set(continuationRef, input.transferRef);
      return {
        ok: true,
        operation: envelope.operation,
        result: { continuationRef, expiresAt: transfer.expiresAt },
      };
    }
    return { ok: false };
  };
  const sourceOptions = {
    reader,
    key: askKey.pub as AssertionKey | null,
    nonces: seniorNonces,
    acks: acks as AdapterDeps["acks"],
  };
  const callSource = async (
    body: unknown,
    scope: "source:read" | "source:ack",
    browser: string,
    signer: AssertionKey = askKey.priv,
  ) => {
    const bytes = Buffer.from(JSON.stringify(body)),
      url = SENIOR_ORIGIN + SOURCE_PATH;
    const response = await handleSeniorSource(
      new Request(url, {
        method: "POST",
        body: bytes,
        headers: {
          "content-type": "application/json",
          [ASSERTION_HEADER]: signSeniorAssertion(signer, "ask", url, scope, bytes, browser),
        },
      }),
      sourceOptions,
    );
    ask.sourceStatuses.push(response.status);
    return {
      status: response.status,
      body: (await response.json()) as { ok: boolean; result?: Record<string, unknown> },
    };
  };
  /** The browser's top-level form POST arriving at the parent. */
  const arrive = async (target: string, fields: Record<string, string>) => {
    ask.forms.push({ target, fields });
    if (ask.abandon) return; // the user left mid-chain
    const transferRef = ask.continuations.get(fields.continuationRef!);
    const transfer = transferRef ? ask.transfers.get(transferRef) : null;
    if (!transfer || !transferRef) return;
    const snapshot = await callSource(
      {
        action: "source",
        continuationRef: fields.continuationRef,
        transferRef,
        manifest: transfer.manifest,
        manifestDigest: manifestDigest(transfer.manifest),
        expiresAt: transfer.expiresAt,
      },
      "source:read",
      transfer.browser,
    );
    if (snapshot.status !== 200 || snapshot.body.result!.browserProof !== transfer.browser) return;
    if (fields.intent === "save_signin" && !ask.session) ask.session = "owner-a"; // signs in on My TrustHub
    if (!ask.session) return; // signed out: return without asking
    const profile = transfer.manifest.returnTask.profile,
      row = ask.session + ":" + profile.nativeId;
    if (
      (await callSource({ action: "resolve", profile }, "source:read", transfer.browser)).status !==
      200
    )
      return;
    let outcome: string;
    if (fields.intent === "unsave") {
      ask.saved.delete(row);
      outcome = "local_only";
    } else {
      outcome = ask.saved.has(row) ? "already_saved" : "saved";
      ask.saved.add(row);
    }
    await callSource(
      {
        action: "acknowledge",
        continuationRef: fields.continuationRef,
        receipts: [
          {
            receiptRef: ref(),
            requestKey: snapshot.body.result!.requestPrefix + ":0",
            accountContextRef: ref(),
            manifestDigest: manifestDigest(transfer.manifest),
            item: transfer.manifest.selected[0],
            parent: { outcome },
            project: { outcome: "not_requested" },
            localCopy: "keep",
          },
        ],
      },
      "source:ack",
      transfer.browser,
    );
  };
  const deps: AdapterDeps = { gate, reader, key: seniorKey.priv, parent, acks, now: Date.now };
  let cookie = "";
  const origin = SENIOR_ORIGIN,
    bff: Array<{ action: string; status: number }> = [],
    pending: Promise<void>[] = [];
  const local = memoryStorage();
  const ports: DirectPorts = {
    async post(body, csrf) {
      const response = await handleSeniorProfileSave(
        new Request(origin + ENDPOINT_PATH, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            origin,
            "sec-fetch-site": "same-origin",
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
            ...(csrf ? { "x-sth-csrf": csrf } : {}),
          },
        }),
        deps,
        origin,
      );
      bff.push({ action: (body as { action: string }).action, status: response.status });
      const set = response.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0]!;
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    },
    submit(target, fields) {
      pending.push(arrive(target, fields));
    },
    local,
  };
  const click = async (ccn: string, intent: DirectIntent) => {
    const result = await startDirect(ports, ccn, intent);
    await Promise.all(pending.splice(0));
    return result;
  };
  return {
    ask,
    deps,
    ports,
    click,
    reads,
    acks,
    seniorKey,
    askKey,
    callSource,
    bff,
    local,
    browserBinding: () => cookie.split("=")[1]!,
    sourceOptions,
  };
}

describe("identity: the CMS nursing-home CCN is the identity", () => {
  it("resolves the three canaries to the exact shared identity", async () => {
    const { reader } = source();
    for (const c of CANARY) {
      expect(await resolveByCcn(reader, c.ccn)).toEqual({
        eligible: true,
        identity: {
          hub: "senior",
          profileClass: "cms_facility",
          identifierNamespace: "cms.ccn",
          sourceIdentifier: c.ccn,
          canonicalSlug: c.slug,
          returnPath: `/facility/cms/${c.ccn}/${c.slug}`,
        },
      });
      expect(
        await resolveByProfile(reader, {
          hub: "senior",
          nativeId: c.ccn,
          profileClass: "cms_facility",
        }),
      ).toMatchObject({ sourceIdentifier: c.ccn, canonicalSlug: c.slug });
    }
  });
  it("never accepts a name, address, UUID, slug or another class as identity", async () => {
    const { reader, reads } = source();
    for (const bad of [
      "BURNS NURSING HOME, INC.",
      "701 MONROE STREET NW",
      UUID,
      "burns-nursing-home-inc",
      "15009",
      "0150090",
      "01500g",
      "",
      null,
      15009,
      { ccn: "015009" },
    ])
      expect(await resolveByCcn(reader, bad)).toEqual({ eligible: false, reason: "invalid_ccn" });
    expect(reads).toEqual([]);
    for (const ccn of OTHER_CLASS_CCNS)
      expect(await resolveByCcn(reader, ccn)).toEqual({ eligible: false, reason: "not_public" });
    for (const bad of [
      { hub: "senior", nativeId: "015009", profileClass: "home_health" },
      { hub: "senior", nativeId: "015009", profileClass: "nursing_home" },
      { hub: "move", nativeId: "015009", profileClass: "cms_facility" },
      { hub: "senior", nativeId: UUID, profileClass: "cms_facility" },
      { hub: "senior", nativeId: "cms.ccn:015009", profileClass: "cms_facility" },
      { hub: "senior", nativeId: "015009", profileClass: "cms_facility", providerId: UUID },
      "015009",
      null,
    ])
      expect(await resolveByProfile(reader, bad)).toBeNull();
    // A read that returns another CCN, a non-canonical route or fails is not eligible.
    const wrong = (
      value: Awaited<ReturnType<ProfileReader["nursingHomeByCcn"]>> | Error,
    ): ProfileReader => ({
      nursingHomeByCcn: async () => {
        if (value instanceof Error) throw value;
        return value;
      },
    });
    expect(
      await resolveByCcn(
        wrong({ ccn: "055223", canonicalPath: "/facility/cms/055223/x" }),
        "015009",
      ),
    ).toEqual({ eligible: false, reason: "not_public" });
    for (const path of [
      "/home-health/cms/015009/burns",
      "/hospice/cms/015009/burns",
      "/facility/cms/055223/burns",
      "/facility/cms/015009/Burns Home",
      "/facility/cms/015009/a/b",
      "/facility/burns",
    ])
      expect(await resolveByCcn(wrong({ ccn: "015009", canonicalPath: path }), "015009")).toEqual({
        eligible: false,
        reason: "not_canonical",
      });
    expect(await resolveByCcn(wrong(new Error("db")), "015009")).toEqual({
      eligible: false,
      reason: "source_unavailable",
    });
  });
  it("builds the shared v3 manifest Ask's contract already expects for Senior", () => {
    for (const c of CANARY) {
      const m = seniorManifest({ sourceIdentifier: c.ccn, canonicalSlug: c.slug });
      const profile = { hub: "senior", nativeId: c.ccn, profileClass: "cms_facility" },
        returnPath = `/facility/cms/${c.ccn}/${c.slug}`;
      expect(m).toEqual({
        version: "v2-3/selected-profiles/3",
        sourceHub: "senior",
        audience: "ask",
        selected: [
          {
            localItemId: c.ccn,
            revision: "1",
            digest: sha(JSON.stringify([c.ccn, returnPath])),
            profile,
          },
        ],
        returnTask: { kind: "profile", hub: "senior", canonicalSlug: c.slug, profile, returnPath },
      });
      expect(isSeniorManifest(m)).toBe(true);
      expect(JSON.stringify(m)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-|providerName|address|email/i);
    }
    // Golden: Ask's manifestDigest (Conumers-Trust-Hub main 14f50a5) for these exact manifests.
    expect(
      CANARY.map((c) =>
        manifestDigest(seniorManifest({ sourceIdentifier: c.ccn, canonicalSlug: c.slug })),
      ),
    ).toEqual(GOLDEN_DIGESTS);
    expect([TRANSFER_VERSION_V3, RUNTIME_VERSION]).toEqual([
      "v2-3/selected-profiles/3",
      "v2-3/parent-runtime/1",
    ]);
    expect([
      PARENT_ORIGIN + PARENT_API_PATH,
      PARENT_ORIGIN + PARENT_FORM_PATH,
      SENIOR_ORIGIN + SOURCE_PATH,
    ]).toEqual([
      "https://www.asktrusthub.com/api/my-trusthub/profile-save",
      "https://www.asktrusthub.com/my/profile-save",
      "https://www.seniortrusthub.com/api/my-trusthub/profile-save/source",
    ]);
    const clone = () =>
      JSON.parse(
        JSON.stringify(
          seniorManifest({ sourceIdentifier: "015009", canonicalSlug: "burns-nursing-home-inc" }),
        ),
      ) as SeniorManifest;
    const tampered: Array<(x: SeniorManifest) => void> = [
      (x) => {
        x.returnTask.profile.nativeId = "055223";
      },
      (x) => {
        x.selected[0]!.profile.nativeId = "055223";
      },
      (x) => {
        (x.returnTask.profile as { profileClass: string }).profileClass = "home_health";
      },
      (x) => {
        x.returnTask.returnPath = "/home-health/cms/015009/burns-nursing-home-inc";
      },
      (x) => {
        x.returnTask.canonicalSlug = "another";
      },
      (x) => {
        (x as { sourceHub: string }).sourceHub = "lender";
      },
      (x) => {
        x.selected.push(x.selected[0]!);
      },
      (x) => {
        (x.returnTask as unknown as Record<string, unknown>).providerId = UUID;
      },
      (x) => {
        x.returnTask.profile.nativeId = UUID;
        x.selected[0]!.profile.nativeId = UUID;
      },
    ];
    for (const [i, change] of tampered.entries()) {
      const x = clone();
      change(x);
      expect(isSeniorManifest(x), "tamper " + i).toBe(false);
    }
    expect(() => seniorManifest({ sourceIdentifier: "15009", canonicalSlug: "x" })).toThrow();
    expect(() =>
      seniorManifest({ sourceIdentifier: "015009", canonicalSlug: "Bad Slug" }),
    ).toThrow();
  });
});
const GOLDEN_DIGESTS = [
  "cbf1999b7d5861da81192e0a4e56c1d557210449c8416a2db052e2e18b9af19e",
  "8023305a6b5764204a971ffaf79076e084645473d4f0bee90f913e5eae9c6188",
  "ec93113fc4e5d3addc75d0e6a1119189e6e253289d3dcdbe37dd5548615a9557",
];

describe("E/F. signed assertion", () => {
  const k = keypair("senior-v23-test"),
    now = 1_800_000_000_000;
  const url = PARENT_ORIGIN + PARENT_API_PATH,
    body = Buffer.from(
      JSON.stringify({
        version: RUNTIME_VERSION,
        operation: "prepareGuestProfileTransfer",
        input: {},
      }),
    ),
    browser = "b".repeat(43);
  const request = (t: string, b = body, target = url) =>
    new Request(target, { method: "POST", headers: { [ASSERTION_HEADER]: t }, body: b });
  const fresh = () =>
    signSeniorAssertion(k.priv, "senior", url, "transfer:stage", body, browser, null, null, now);
  it("E. is the shared v23 service assertion with a senior_origin claim", async () => {
    const token = fresh();
    const [h, c] = token
      .split(".")
      .slice(0, 2)
      .map(
        (part) =>
          JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>,
      );
    expect(h).toEqual({ alg: "EdDSA", typ: "trusthub-v23+jws", kid: "senior-v23-test" });
    expect(Object.keys(c!).sort().join()).toBe(
      "ask_origin,aud,body_sha256,browser,exp,grant,iat,iss,jti,method,path,scope,senior_origin,session,sub,v",
    );
    expect({ ...c, jti: "" }).toEqual({
      v: 1,
      iss: "urn:trusthub:v23:qvvxvbcdmbjzrgvwjatw:senior",
      sub: "svc:trusthub:senior:v23:production",
      aud: url,
      scope: "transfer:stage",
      method: "POST",
      path: "/api/my-trusthub/profile-save",
      body_sha256: sha(body.toString()),
      iat: 1_800_000_000,
      exp: 1_800_000_030,
      jti: "",
      ask_origin: "https://www.asktrusthub.com",
      senior_origin: "https://www.seniortrusthub.com",
      browser,
      session: null,
      grant: null,
    });
    expect([ASSERTION_HEADER, ASSERTION_TTL_SECONDS]).toEqual(["x-trusthub-v23-assertion", 30]);
    expect(SENIOR_PRODUCTION_PINS).toEqual({
      parentOrigin: "https://www.asktrusthub.com",
      seniorOrigin: "https://www.seniortrusthub.com",
      project: "qvvxvbcdmbjzrgvwjatw",
      assertionEnvironment: "production",
    });
    expect(
      (
        await verifySeniorAssertion(
          request(token),
          body,
          k.pub,
          "senior",
          "transfer:stage",
          memoryNonces(),
          now,
        )
      ).browser,
    ).toBe(browser);
  });
  it("F. a tampered, replayed, expired, mis-scoped or wrong-hub assertion is denied", async () => {
    const nonces = memoryNonces(),
      token = fresh();
    await verifySeniorAssertion(
      request(token),
      body,
      k.pub,
      "senior",
      "transfer:stage",
      nonces,
      now,
    );
    await expect(
      verifySeniorAssertion(request(token), body, k.pub, "senior", "transfer:stage", nonces, now),
    ).rejects.toThrow("unauthorized"); // replay
    const other = Buffer.from("{}");
    await expect(
      verifySeniorAssertion(
        request(fresh(), other),
        other,
        k.pub,
        "senior",
        "transfer:stage",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow(); // body
    await expect(
      verifySeniorAssertion(
        request(fresh()),
        body,
        keypair("senior-v23-test").pub,
        "senior",
        "transfer:stage",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow(); // key
    await expect(
      verifySeniorAssertion(
        request(fresh()),
        body,
        { ...k.pub, kid: "other" },
        "senior",
        "transfer:stage",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow(); // kid
    await expect(
      verifySeniorAssertion(
        request(fresh()),
        body,
        k.pub,
        "senior",
        "source:ack",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow(); // scope
    await expect(
      verifySeniorAssertion(
        request(fresh()),
        body,
        k.pub,
        "ask",
        "transfer:stage",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow(); // service
    await expect(
      verifySeniorAssertion(
        request(fresh()),
        body,
        k.pub,
        "senior",
        "transfer:stage",
        memoryNonces(),
        now + 31_000,
      ),
    ).rejects.toThrow(); // expired
    await expect(
      verifySeniorAssertion(
        request(fresh(), body, PARENT_ORIGIN + "/api/other"),
        body,
        k.pub,
        "senior",
        "transfer:stage",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow(); // audience
    // A flipped signature byte and a payload edited after signing.
    const parts = fresh().split(".");
    const flipped = Buffer.from(parts[2]!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    await expect(
      verifySeniorAssertion(
        request([parts[0], parts[1], flipped.toString("base64url")].join(".")),
        body,
        k.pub,
        "senior",
        "transfer:stage",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow();
    const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    const edited = Buffer.from(JSON.stringify({ ...claims, scope: "source:ack" })).toString(
      "base64url",
    );
    await expect(
      verifySeniorAssertion(
        request([parts[0], edited, parts[2]].join(".")),
        body,
        k.pub,
        "senior",
        "source:ack",
        memoryNonces(),
        now,
      ),
    ).rejects.toThrow();
    // A correctly signed token in another hub's claim shape never verifies as Senior.
    for (const hubClaim of ["lender_origin", "move_origin", "contractor_origin"]) {
      const forgedClaims = { ...claims, jti: ref() } as Record<string, unknown>;
      forgedClaims[hubClaim] = forgedClaims.senior_origin;
      delete forgedClaims.senior_origin;
      const unsigned =
        parts[0] + "." + Buffer.from(JSON.stringify(forgedClaims)).toString("base64url");
      const forged =
        unsigned +
        "." +
        sign(null, Buffer.from(unsigned), createPrivateKey(k.priv.pem)).toString("base64url");
      await expect(
        verifySeniorAssertion(
          request(forged),
          body,
          k.pub,
          "senior",
          "transfer:stage",
          memoryNonces(),
          now,
        ),
        hubClaim,
      ).rejects.toThrow();
    }
    expect(() =>
      signSeniorAssertion(
        k.priv,
        "senior",
        "https://evil.example/api/my-trusthub/profile-save",
        "transfer:stage",
        body,
        browser,
      ),
    ).toThrow();
    expect(() => signSeniorAssertion(k.priv, "ask", url, "source:read", body, browser)).toThrow();
  });
});

describe("signed hand-off chain", () => {
  it("G/H. Save and Unsave are reported only on the parent's acknowledgement, for all three canaries", async () => {
    const p = pair();
    p.ask.session = "owner-a";
    for (const c of CANARY) {
      expect(await p.click(c.ccn, "save")).toBe("navigating");
      const staged = p.ask.apiCalls.at(-2)!,
        continued = p.ask.apiCalls.at(-1)!;
      expect([staged.operation, continued.operation]).toEqual([
        "prepareGuestProfileTransfer",
        "prepareProfileSaveContinuation",
      ]);
      const manifest = staged.envelope.input as unknown as SeniorManifest;
      expect(manifest.returnTask.profile).toEqual({
        hub: "senior",
        nativeId: c.ccn,
        profileClass: "cms_facility",
      });
      expect(manifest.returnTask.returnPath).toBe(`/facility/cms/${c.ccn}/${c.slug}`);
      expect([
        staged.claims.browser,
        staged.claims.scope,
        staged.claims.session,
        staged.claims.grant,
      ]).toEqual([p.browserBinding(), "transfer:stage", null, null]);
      expect(Object.keys(continued.envelope.input as object).sort()).toEqual([
        "audience",
        "manifestDigest",
        "sourceHub",
        "transferRef",
      ]);
      expect([
        p.ask.forms.at(-1)!.target,
        Object.keys(p.ask.forms.at(-1)!.fields).sort().join(),
        p.ask.forms.at(-1)!.fields.intent,
      ]).toEqual(["https://www.asktrusthub.com/my/profile-save", "continuationRef,intent", "save"]);
      expect(await resumeDirect(p.ports, c.ccn)).toEqual({ intent: "save", outcome: "confirmed" });
      expect(parentSync(p.local, c.ccn)).toBe("synced");
    }
    expect([...p.ask.saved].sort()).toEqual(CANARY.map((c) => "owner-a:" + c.ccn).sort());
    // Repeated Save: acknowledged as already saved, still one parent row.
    expect(await p.click("015009", "save")).toBe("navigating");
    expect((await resumeDirect(p.ports, "015009"))!.outcome).toBe("confirmed");
    expect(p.ask.saved.size).toBe(3);
    for (const c of CANARY) {
      expect(await p.click(c.ccn, "unsave")).toBe("navigating");
      expect(p.ask.forms.at(-1)!.fields.intent).toBe("unsave");
      expect(await resumeDirect(p.ports, c.ccn)).toEqual({
        intent: "unsave",
        outcome: "confirmed",
      });
      expect(parentSync(p.local, c.ccn)).toBeNull();
    }
    expect(p.ask.saved.size).toBe(0);
    expect(p.ask.sourceStatuses.every((status) => status === 200)).toBe(true);
    // L. Save never creates a Watch.
    expect(p.ask.watches).toEqual([]);
  });

  it("G/H. the acknowledgement contract: wrong browser, Watch-bearing, unknown outcome and other identities are refused", async () => {
    const p = pair();
    p.ask.session = "owner-a";
    await p.click("015009", "save");
    await resumeDirect(p.ports, "015009");
    const browser = p.browserBinding(),
      good = seniorManifest({
        sourceIdentifier: "015009",
        canonicalSlug: "burns-nursing-home-inc",
      }),
      before = p.acks.size();
    const receipt = (patch: Record<string, unknown> = {}, prefix = browser) => ({
      receiptRef: ref(),
      requestKey: prefix + ":0",
      accountContextRef: ref(),
      manifestDigest: manifestDigest(good),
      item: good.selected[0],
      parent: { outcome: "saved" },
      project: { outcome: "not_requested" },
      localCopy: "keep",
      ...patch,
    });
    const ack = (r: unknown) =>
      p.callSource(
        { action: "acknowledge", continuationRef: ref(), receipts: [r] },
        "source:ack",
        browser,
      );
    expect((await ack(receipt({}, "x".repeat(43)))).status).toBe(403);
    expect((await ack(receipt({ watchCreated: true }))).status).toBe(403);
    expect((await ack(receipt({ watch: { id: 1 } }))).status).toBe(403);
    expect((await ack(receipt({ parent: { outcome: "failed" } }))).status).toBe(403);
    expect((await ack(receipt({ localCopy: "delete" }))).status).toBe(403);
    expect(
      (
        await ack(
          receipt({
            item: {
              ...good.selected[0],
              profile: { ...good.selected[0]!.profile, nativeId: "017000" },
            },
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await p.callSource(
          { action: "acknowledge", continuationRef: ref(), receipts: [receipt()] },
          "source:read",
          browser,
        )
      ).status,
    ).toBe(403); // wrong scope
    expect(
      (
        await p.callSource(
          { action: "acknowledge", continuationRef: ref(), receipts: [receipt()] },
          "source:ack",
          browser,
          p.seniorKey.priv,
        )
      ).status,
    ).toBe(403); // not Ask's key
    expect(p.acks.size()).toBe(before);
    for (const outcome of ["saved", "already_saved", "local_only"]) {
      const answer = await ack(receipt({ parent: { outcome } }));
      expect([answer.status, answer.body.result]).toEqual([200, { watchCreated: false }]);
    }
    expect(p.acks.size()).toBe(before + 3);
    // Held for the browser it was staged for and nobody else.
    const held = p.ask.forms[0]!.fields.continuationRef!;
    expect(await parentStatus(p.deps, held, browser)).toBe("parent_acknowledged");
    expect(await parentStatus(p.deps, held, "z".repeat(43))).toBe("pending");
    expect(await parentStatus(p.deps, ref(), browser)).toBe("pending");
    expect(await parentStatus({ ...p.deps, acks: null }, held, browser)).toBe("unavailable");
  });

  it("server-side source re-proof: a tampered CCN, class, route or digest is refused", async () => {
    const p = pair();
    p.ask.session = "owner-a";
    await p.click("015009", "save");
    const browser = p.browserBinding(),
      good = seniorManifest({
        sourceIdentifier: "015009",
        canonicalSlug: "burns-nursing-home-inc",
      });
    const rebuild = (
      ccn: string,
      slug: string,
      path = `/facility/cms/${ccn}/${slug}`,
    ): SeniorManifest => {
      const profile = {
        hub: "senior" as const,
        nativeId: ccn,
        profileClass: "cms_facility" as const,
      };
      return {
        version: TRANSFER_VERSION_V3,
        sourceHub: "senior",
        audience: "ask",
        selected: [
          { localItemId: ccn, revision: "1", digest: sha(JSON.stringify([ccn, path])), profile },
        ],
        returnTask: {
          kind: "profile",
          hub: "senior",
          canonicalSlug: slug,
          profile,
          returnPath: path,
        },
      };
    };
    const sourceCall = (manifest: SeniorManifest, digest = manifestDigest(manifest)) =>
      p.callSource(
        {
          action: "source",
          continuationRef: ref(),
          transferRef: ref(),
          manifest,
          manifestDigest: digest,
          expiresAt: Date.now() + 60_000,
        },
        "source:read",
        browser,
      );
    const ok = await sourceCall(good);
    expect(ok.status).toBe(200);
    expect(ok.body.result).toMatchObject({
      manifest: good,
      manifestDigest: manifestDigest(good),
      browserProof: browser,
      requestPrefix: browser,
    });
    expect((await sourceCall(rebuild("015009", "another-name"))).status).toBe(403); // this CCN under another slug
    expect((await sourceCall(rebuild("017000", "burns-nursing-home-inc"))).status).toBe(403); // a home health CCN
    expect((await sourceCall(rebuild("999999", "burns-nursing-home-inc"))).status).toBe(403); // no such facility
    expect(
      (
        await sourceCall(
          rebuild(
            "015009",
            "burns-nursing-home-inc",
            "/home-health/cms/015009/burns-nursing-home-inc",
          ),
        )
      ).status,
    ).toBe(403);
    expect((await sourceCall(good, "0".repeat(64))).status).toBe(403);
    for (const profile of [
      { hub: "senior", nativeId: "017000", profileClass: "cms_facility" },
      { hub: "senior", nativeId: "015009", profileClass: "home_health" },
      { hub: "senior", nativeId: UUID, profileClass: "cms_facility" },
      { hub: "lender", nativeId: "015009", profileClass: "cms_facility" },
    ])
      expect(
        (await p.callSource({ action: "resolve", profile }, "source:read", browser)).status,
      ).toBe(503);
    expect(await seniorPublication(p.deps.reader, good.returnTask.profile, 5)).toEqual({
      identity: good.returnTask.profile,
      canonicalSlug: "burns-nursing-home-inc",
      publicationState: "PUBLISHABLE",
      reviewedClass: "cms_facility",
      checkedAt: 5,
    });
    // A body changed after signing, and a replay.
    const url = SENIOR_ORIGIN + SOURCE_PATH,
      signedBody = Buffer.from(
        JSON.stringify({ action: "resolve", profile: good.returnTask.profile }),
      );
    const token = signSeniorAssertion(
      p.askKey.priv,
      "ask",
      url,
      "source:read",
      signedBody,
      browser,
    );
    const raw = (body: Buffer, assertion: string) =>
      handleSeniorSource(
        new Request(url, {
          method: "POST",
          body: new Uint8Array(body),
          headers: { "content-type": "application/json", [ASSERTION_HEADER]: assertion },
        }),
        p.sourceOptions,
      );
    expect(
      (
        await raw(
          Buffer.from(
            JSON.stringify({
              action: "resolve",
              profile: { ...good.returnTask.profile, nativeId: "055223" },
            }),
          ),
          token,
        )
      ).status,
    ).toBe(403);
    expect((await raw(signedBody, token)).status).toBe(200);
    expect((await raw(signedBody, token)).status).toBe(403);
  });

  it("D. an unrelated profile is denied from the parent path", async () => {
    const p = pair();
    p.ask.session = "owner-a";
    // A real, eligible nursing home that is not in the canary: the gate refuses before any lookup.
    expect(await prepareParentSave(p.deps, OTHER_NURSING_HOME.ccn, "save", "b".repeat(43))).toEqual(
      { state: "local_only", reason: "sync_off", localCopy: "keep" },
    );
    expect(await p.click(OTHER_NURSING_HOME.ccn, "save")).toBe("not_eligible");
    expect(p.reads).toEqual([]);
    // Other classes and unknown CCNs: not eligible even under a broad gate.
    const broad = pair({ enabled: true, broad: true, canary: false, ccns: [] });
    broad.ask.session = "owner-a";
    for (const ccn of [...OTHER_CLASS_CCNS, "999999"])
      expect(await prepareParentSave(broad.deps, ccn, "save", "b".repeat(43))).toEqual({
        state: "local_only",
        reason: "not_public",
        localCopy: "keep",
      });
    for (const bad of [UUID, "burns-nursing-home-inc", "BURNS NURSING HOME, INC."])
      expect(await prepareParentSave(broad.deps, bad, "save", "b".repeat(43))).toEqual({
        state: "local_only",
        reason: "invalid_ccn",
        localCopy: "keep",
      });
    expect(broad.ask.apiCalls).toEqual([]);
    // The browser may send only { ccn, intent }.
    const csrfHolder = pair();
    await csrfHolder.click("015009", "save");
    const csrf = csrfHolder.browserBinding(),
      calls = csrfHolder.ask.apiCalls.length;
    const post = (body: unknown) =>
      handleSeniorProfileSave(
        new Request(SENIOR_ORIGIN + ENDPOINT_PATH, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            origin: SENIOR_ORIGIN,
            "sec-fetch-site": "same-origin",
            "content-type": "application/json",
            cookie: `${COOKIE_NAME}=${csrf}`,
            "x-sth-csrf": csrf,
          },
        }),
        csrfHolder.deps,
        SENIOR_ORIGIN,
      );
    for (const extra of [
      { providerId: UUID },
      { nativeProfileId: UUID },
      { networkEntityId: UUID },
      { name: "BURNS NURSING HOME, INC." },
      { address: "701 MONROE ST" },
      { slug: "burns-nursing-home-inc" },
      { profileClass: "cms_facility" },
      { identifierNamespace: "cms.ccn" },
      { returnPath: "/facility/cms/015009/x" },
      { nativeId: "055223" },
    ])
      expect(
        (await post({ action: "prepare", ccn: "015009", intent: "save", ...extra })).status,
        JSON.stringify(extra),
      ).toBe(400);
    expect(
      (
        (await (await post({ action: "prepare", ccn: "015009", intent: "watch" })).json()) as {
          state: string;
        }
      ).state,
    ).toBe("unavailable");
    expect(csrfHolder.ask.apiCalls.length).toBe(calls);
    // Cross-site, missing CSRF and wrong method are refused.
    const base = {
      origin: SENIOR_ORIGIN,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
    };
    const rawPost = (headers: Record<string, string>) =>
      handleSeniorProfileSave(
        new Request(SENIOR_ORIGIN + ENDPOINT_PATH, {
          method: "POST",
          body: JSON.stringify({ action: "prepare", ccn: "015009", intent: "save" }),
          headers,
        }),
        csrfHolder.deps,
        SENIOR_ORIGIN,
      );
    expect((await rawPost({ ...base, origin: "https://evil.example" })).status).toBe(403);
    expect((await rawPost({ ...base, "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await rawPost({ ...base, cookie: `${COOKIE_NAME}=${csrf}` })).status).toBe(403);
    expect(
      (await rawPost({ ...base, cookie: `${COOKIE_NAME}=${csrf}`, "x-sth-csrf": "y".repeat(43) }))
        .status,
    ).toBe(403);
  });

  it("I. signed-out continuation: the Save stays on the device, then sign-in finishes it with no second Save", async () => {
    const p = pair();
    expect(await p.click("015009", "save")).toBe("navigating");
    expect(await resumeDirect(p.ports, "015009")).toEqual({
      intent: "save",
      outcome: "not_confirmed",
    });
    expect([p.ask.saved.size, parentSync(p.local, "015009")]).toEqual([0, null]);
    expect(await p.click("015009", "save_signin")).toBe("navigating");
    expect(p.ask.forms.at(-1)!.fields.intent).toBe("save_signin");
    expect(await resumeDirect(p.ports, "015009")).toEqual({
      intent: "save_signin",
      outcome: "confirmed",
    });
    expect([[...p.ask.saved], parentSync(p.local, "015009")]).toEqual([
      ["owner-a:015009"],
      "synced",
    ]);
  });

  it("J. abandoned hand-off recovery: nothing is claimed, the belief is kept, a retry completes it", async () => {
    const p = pair();
    p.ask.session = "owner-a";
    await p.click("015009", "save");
    await resumeDirect(p.ports, "015009");
    p.ask.abandon = true;
    expect(await p.click("015009", "unsave")).toBe("navigating");
    expect(p.local.map.has("sth-mth-direct:015009")).toBe(true); // pending marker is on the device
    expect(await resumeDirect(p.ports, "015009")).toEqual({
      intent: "unsave",
      outcome: "not_confirmed",
    });
    expect([p.ask.saved.size, parentSync(p.local, "015009")]).toEqual([1, "synced"]);
    expect(await resumeDirect(p.ports, "015009")).toBeNull(); // consumed once
    p.ask.abandon = false;
    expect(await p.click("015009", "unsave")).toBe("navigating");
    expect(await resumeDirect(p.ports, "015009")).toEqual({
      intent: "unsave",
      outcome: "confirmed",
    });
    expect([p.ask.saved.size, parentSync(p.local, "015009")]).toEqual([0, null]);
    p.ask.abandon = true;
    await p.click("015009", "save");
    expect(await resumeDirect(p.ports, "015009")).toEqual({
      intent: "save",
      outcome: "not_confirmed",
    });
    expect(p.ask.saved.size).toBe(0);
    // The browser is only ever handed to the production Ask form (or a local/test host).
    expect(handoffTargetAllowed("https://www.asktrusthub.com/my/profile-save")).toBe(true);
    for (const bad of [
      "https://www.asktrusthub.com/my/saved",
      "https://asktrusthub.com/my/profile-save",
      "https://www.asktrusthub.com/my/profile-save?x=1",
      "https://www.asktrusthub.com.evil.example/my/profile-save",
      "https://evil.vercel.app/my/profile-save",
      "javascript:alert(1)",
      "",
      null,
    ])
      expect(handoffTargetAllowed(bad), String(bad)).toBe(false);
  });

  it("K. parent unavailable: fail closed, nothing navigates, nothing is claimed", async () => {
    const p = pair();
    p.ask.session = "owner-a";
    p.ask.down = true;
    expect(await prepareParentSave(p.deps, "015009", "save", "b".repeat(43))).toEqual({
      state: "unavailable",
      localCopy: "keep",
    });
    expect(await p.click("015009", "save")).toBe("unavailable");
    expect([p.ask.forms.length, p.local.map.size]).toEqual([0, 0]);
    // The parent declines (no single accepted binding): device only.
    const declined = pair();
    declined.ask.bindings.delete("015009");
    expect(await prepareParentSave(declined.deps, "015009", "save", "b".repeat(43))).toEqual({
      state: "local_only",
      reason: "parent_declined",
      localCopy: "keep",
    });
    // No signing key: nothing is sent.
    const unsigned = pair();
    unsigned.deps.key = null;
    expect(await prepareParentSave(unsigned.deps, "015009", "save", "b".repeat(43))).toEqual({
      state: "local_only",
      reason: "unsigned",
      localCopy: "keep",
    });
    expect(unsigned.ask.apiCalls).toEqual([]);
    // A parent that answers with another digest, an expired window or a malformed reference is not followed.
    for (const corrupt of [
      (r: Record<string, unknown>) => {
        r.manifestDigest = "0".repeat(64);
      },
      (r: Record<string, unknown>) => {
        r.expiresAt = 1;
      },
      (r: Record<string, unknown>) => {
        r.transferRef = "short";
      },
    ]) {
      const q = pair(),
        inner = q.deps.parent!;
      q.deps.parent = async (call) => {
        const response = await inner(call);
        if (response.ok && response.operation === "prepareGuestProfileTransfer")
          corrupt(response.result as Record<string, unknown>);
        return response;
      };
      expect((await prepareParentSave(q.deps, "015009", "save", "b".repeat(43))).state).toBe(
        "unavailable",
      );
    }
    // The acknowledgement cannot be held (table not applied): the parent is told, the device claims nothing.
    const lost = pair();
    lost.ask.session = "owner-a";
    lost.sourceOptions.acks = {
      record: async () => {
        throw new Error("relation does not exist");
      },
      read: async () => null,
    };
    await lost.click("015009", "save");
    expect(lost.ask.sourceStatuses).toContain(503);
    expect((await resumeDirect(lost.ports, "015009"))!.outcome).toBe("not_confirmed");
    // A failing status read is "unknown", never a claim.
    const flaky = pair();
    flaky.ask.session = "owner-a";
    await flaky.click("015009", "save");
    flaky.deps.acks = {
      record: async () => {},
      read: async () => {
        throw new Error("db");
      },
    };
    expect((await resumeDirect(flaky.ports, "015009"))!.outcome).toBe("unknown");
  });
});

describe("gate: parent sync and canary are OFF", () => {
  beforeEach(() => {
    for (const name of [
      "NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED",
      "NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS",
      "MTH_SENIOR_PARENT_SAVE_MODE",
    ])
      expect(process.env[name]).toBeUndefined();
  });
  it("reads release exposure from the environment and stays off on anything short of exact", () => {
    expect(OFF_GATE).toEqual({ enabled: false, broad: false, canary: false, ccns: [] });
    expect(productionParentGate()).toEqual(OFF_GATE);
    const on = {
      NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED: "1",
      MTH_SENIOR_PARENT_SAVE_MODE: "production",
    };
    for (const env of [
      { NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED: "1" },
      { MTH_SENIOR_PARENT_SAVE_MODE: "production" },
      { ...on, NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED: "true" },
      { ...on, MTH_SENIOR_PARENT_SAVE_MODE: "preview" },
      { ...on, NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS: "015009,not-a-ccn" },
      { ...on, NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS: "015009,015009" },
      { ...on, NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS: "burns-nursing-home-inc" },
    ])
      expect(productionParentGate(env), JSON.stringify(env)).toEqual(OFF_GATE);
    expect(
      productionParentGate({
        ...on,
        NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS: "015009, 055223 ,155805",
      }),
    ).toEqual(CANARY_GATE);
    expect(productionParentGate(on)).toEqual({
      enabled: true,
      broad: true,
      canary: false,
      ccns: [],
    });
    expect([
      canaryCcnList(undefined),
      canaryCcnList(" "),
      canaryCcnList("015009"),
      canaryCcnList("x"),
    ]).toEqual([[], [], ["015009"], null]);
    expect([parentSyncMode(OFF_GATE), parentSyncMode(CANARY_GATE)]).toEqual(["off", "gated"]);
    for (const c of CANARY)
      expect([gateAllows(c.ccn, OFF_GATE), gateAllows(c.ccn, CANARY_GATE)]).toEqual([false, true]);
    expect(gateAllows(OTHER_NURSING_HOME.ccn, CANARY_GATE)).toBe(false);
    expect(SENIOR_CANARIES).toEqual(CANARY);
  });
  it("with the gate off nothing is read, signed or sent, and both endpoints answer 503", async () => {
    const { reader, reads } = source();
    let sent = 0;
    const off: AdapterDeps = {
      gate: OFF_GATE,
      reader,
      key: keypair("k").priv,
      parent: async () => {
        sent++;
        return { ok: false };
      },
      acks: memoryAckStore(),
      now: Date.now,
    };
    expect(await prepareParentSave(off, "015009", "save", "b".repeat(43))).toEqual({
      state: "unavailable",
      localCopy: "keep",
    });
    expect(await parentStatus(off, "t".repeat(43), "b".repeat(43))).toBe("unavailable");
    for (const body of [
      { action: "bootstrap" },
      { action: "prepare", ccn: "015009", intent: "save" },
      { action: "status", continuationRef: "t".repeat(43) },
    ]) {
      const response = await handleSeniorProfileSave(
        new Request(SENIOR_ORIGIN + ENDPOINT_PATH, {
          method: "POST",
          headers: {
            origin: SENIOR_ORIGIN,
            "sec-fetch-site": "same-origin",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
        off,
        SENIOR_ORIGIN,
      );
      expect([response.status, response.headers.get("set-cookie"), await response.json()]).toEqual([
        503,
        null,
        { state: "unavailable", localCopy: "keep" },
      ]);
    }
    const closed = await handleSeniorSource(
      new Request(SENIOR_ORIGIN + SOURCE_PATH, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      { reader, key: null, nonces: memoryNonces(), acks: null },
    );
    expect(closed.status).toBe(503);
    expect([reads, sent]).toEqual([[], 0]);
    // The browser client makes no hand-off: the endpoint refuses bootstrap.
    const local = memoryStorage();
    let submitted = 0;
    const ports: DirectPorts = {
      post: async (body) => {
        const r = await handleSeniorProfileSave(
          new Request(SENIOR_ORIGIN + ENDPOINT_PATH, {
            method: "POST",
            headers: {
              origin: SENIOR_ORIGIN,
              "sec-fetch-site": "same-origin",
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          }),
          off,
          SENIOR_ORIGIN,
        );
        if (!r.ok) throw new Error("unavailable");
        return r.json();
      },
      submit: () => {
        submitted++;
      },
      local,
    };
    expect([await startDirect(ports, "015009", "save"), submitted, local.map.size]).toEqual([
      "unavailable",
      0,
      0,
    ]);
  });
  it("signer and transport come only from the dedicated Senior values toward the pinned parent origin", () => {
    expect(productionHandoffDeps({})).toEqual({ key: null, parent: null });
    const k = keypair("senior-v23-prod");
    const env = {
      MY_TRUSTHUB_V23_SENIOR_KEY_ID: k.priv.kid,
      MY_TRUSTHUB_V23_SENIOR_SIGNING_PRIVATE_KEY_PEM: k.priv.pem,
    };
    expect(
      productionHandoffDeps({ ...env, MY_TRUSTHUB_V23_PARENT_ORIGIN: "https://evil.example" }),
    ).toEqual({ key: null, parent: null });
    expect(
      productionHandoffDeps({
        ...env,
        MY_TRUSTHUB_V23_PARENT_ORIGIN: "https://www.asktrusthub.com",
      }).key,
    ).toEqual(k.priv);
    expect(productionHandoffDeps(env).key).toEqual(k.priv);
    // The only outbound request in the whole path is the gated parent transport; routes build it only when the gate is open.
    const root = join(__dirname, "..", "..");
    const route = readFileSync(join(root, "app/api/my-trusthub/profile-save/route.ts"), "utf8");
    expect(route).toMatch(
      /const signer = gate\.enabled \? productionHandoffDeps\(\) : \{ key: null, parent: null \}/,
    );
    expect(
      readFileSync(join(root, "app/api/my-trusthub/profile-save/source/route.ts"), "utf8"),
    ).toMatch(/key: open \? askVerifyKey\(\) : null/);
    const files = readdirSync(__dirname)
      .filter((f) => !f.endsWith(".test.ts"))
      .map((f) => join(__dirname, f))
      .concat([
        join(root, "app/api/my-trusthub/profile-save/route.ts"),
        join(root, "app/api/my-trusthub/profile-save/source/route.ts"),
        join(root, "lib/my-trusthub/direct-save-client.ts"),
        join(root, "lib/my-trusthub/saved-store.ts"),
      ]);
    for (const file of files) {
      const text = readFileSync(file, "utf8"),
        fetches = text.split("fetch(").length - 1;
      expect(fetches, file).toBe(/parent-adapter\.ts$|direct-save-client\.ts$/.test(file) ? 1 : 0);
      // L. nothing in the Save path creates or touches a Watch or the Family Workspace.
      expect(text, file).not.toMatch(
        /family-workspace|addFacilityToWorkspace|createWatch|watchFacility/,
      );
    }
  });
});
