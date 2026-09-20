import "server-only";
import type { SeniorProviderClass } from "./senior-ask-contract";
import { interpretSeniorAskQuery } from "./senior-ask-parse";
import { executeSeniorResearchPlan, type SeniorAskEntity } from "./senior-ask-execute";

/**
 * TH-SEARCH-R1-019E: SeniorTrustHub's structured provider-name-candidates operation.
 *
 * A SEPARATE, independently versioned contract from `trusthub-specialist-execution-v2`
 * (senior-specialist-execution-v2.ts) -- that contract REQUIRES a providerClass or an exact CCN
 * identifier and has no name field at all, matching the same shape already established for
 * Lender/Contractor's own `*-name-candidates-v1` siblings alongside their own untouched v2 identity
 * contracts. Nothing here touches v2; v2's own tests and callers are unaffected.
 *
 * ONE authoritative engine: this operation constructs the SAME kind of `SeniorResearchQuery`
 * (`mode: "entity"`, `identityQuery`) that `interpretSeniorAskQuery()`'s STRUCTURED PROVIDER NAME
 * FIRST fix (senior-ask-parse.ts) already produces for a bare typed name, and executes it through
 * the SAME `executeSeniorResearchPlan()` native Ask itself calls -- the identical cross-class
 * `identitySearch()` inside senior-ask-execute.ts, never a second matcher. See
 * docs/qa/th-search-r1-019e/README.md section I for the native/structured parity evidence.
 */
export const SENIOR_NAME_CANDIDATES_CONTRACT = "senior-name-candidates-v1" as const;

export type SeniorNameCandidateRequest = {
  operation?: unknown;
  name?: unknown;
  providerClass?: unknown;
  state?: unknown;
  page?: unknown;
};

export class SeniorNameCandidatesRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const PROVIDER_CLASSES = new Set<SeniorProviderClass>(["nursing_home", "home_health", "hospice"]);
const TOP_LEVEL_FIELDS = new Set(["operation", "name", "providerClass", "state", "page"]);

function fail(
  code: string,
  status: number,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new SeniorNameCandidatesRequestError(code, status, message, details);
}

export type NormalizedSeniorNameRequest = {
  name: string;
  providerClass: SeniorProviderClass | undefined;
  state: string | undefined;
  page: number;
};

/** Validates the request shape only. Never touches the database and never runs the name predicate. */
export function normalizeSeniorNameCandidatesRequest(input: unknown): NormalizedSeniorNameRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("invalid_request", 400, "A JSON object is required.");
  }
  const body = input as Record<string, unknown>;
  const unsupported = Object.keys(body).filter((key) => !TOP_LEVEL_FIELDS.has(key));
  if (unsupported.length) {
    fail(
      "unsupported_field",
      400,
      "Only operation, name, providerClass, state and page are accepted.",
      {
        fields: unsupported,
      },
    );
  }
  if (body.operation !== undefined && body.operation !== "provider_name_candidates") {
    fail("invalid_operation", 400, 'operation must be "provider_name_candidates".');
  }
  if (typeof body.name !== "string") {
    fail("invalid_name", 400, "name must be a string.");
  }
  const name = body.name.trim();
  if (name.length < 2 || name.length > 180) {
    fail("invalid_name", 400, "name must be 2-180 characters.");
  }
  let providerClass: SeniorProviderClass | undefined;
  if (body.providerClass !== undefined) {
    if (
      typeof body.providerClass !== "string" ||
      !PROVIDER_CLASSES.has(body.providerClass as SeniorProviderClass)
    ) {
      fail(
        "invalid_provider_class",
        400,
        "providerClass must be nursing_home, home_health, or hospice when supplied.",
      );
    }
    providerClass = body.providerClass as SeniorProviderClass;
  }
  let state: string | undefined;
  if (body.state !== undefined) {
    if (typeof body.state !== "string" || !/^[A-Za-z]{2}$/.test(body.state)) {
      fail("invalid_state", 400, "state must be a two-letter postal code when supplied.");
    }
    state = body.state.toUpperCase();
  }
  const page = body.page === undefined ? 1 : Number(body.page);
  if (!Number.isInteger(page) || page < 1 || page > 50) {
    fail("invalid_page", 400, "page must be an integer from 1 through 50.");
  }
  return { name, providerClass, state, page };
}

export type SeniorNameCandidateRow = {
  providerClass: SeniorProviderClass;
  displayName: string;
  ccn: string;
  recordedLocation: { city: string | null; state: string; county?: string | null } | undefined;
  locationMeaning: string;
  publicationState: "public_profile";
  action: { type: "PROFILE"; href: string; label: string };
  whyMatched: string;
};

export type SeniorNameCandidatesResult =
  | {
      resultState: "COMPLETED_WITH_CANDIDATES" | "COMPLETED_NO_CANDIDATES" | "PARTIAL_TRUNCATED";
      name: { supplied: string; predicateApplied: true };
      providerClassFilter: SeniorProviderClass | null;
      state: string | null;
      candidates: SeniorNameCandidateRow[];
      pagination: { page: number; hasMore: boolean };
      limitations: string[];
    }
  | {
      resultState: "UNSUPPORTED_OPERATION";
      name: { supplied: string; predicateApplied: false };
      message: string;
    }
  | {
      resultState: "TECHNICAL_FAILURE";
      name: { supplied: string; predicateApplied: false };
      failureKind: "unavailable";
      message: string;
    };

const LOCATION_MEANING =
  "Recorded provider/office location on the current CMS directory record -- not service territory, availability, or a verified service area.";

function toRow(entity: SeniorAskEntity): SeniorNameCandidateRow {
  return {
    providerClass: entity.providerClass,
    displayName: entity.providerName,
    ccn: entity.ccn,
    recordedLocation: entity.recordedLocation,
    locationMeaning: LOCATION_MEANING,
    publicationState: "public_profile",
    action: { type: "PROFILE", href: entity.href, label: `Open ${entity.providerName} profile` },
    whyMatched: entity.whyMatched,
  };
}

/**
 * Executes the validated request through the SAME identity/name engine native Ask uses
 * (`identityQuery` + `executeSeniorResearchPlan`, senior-ask-execute.ts). The name predicate always
 * runs before any page/limit is taken -- `identitySearch()` there filters every source query on the
 * supplied name first. `providerClass`, when supplied, narrows the ALREADY-RETURNED candidates to
 * that one class (never a second query, never a merged denominator) -- source SCOPE for the name
 * search itself is never narrowed by class, matching native Ask's own unscoped identity search.
 */
export async function executeSeniorNameCandidates(
  req: NormalizedSeniorNameRequest,
): Promise<SeniorNameCandidatesResult> {
  // Classify through the ONE shared parser -- the SAME interpretSeniorAskQuery() a typed bare name
  // goes through natively, including the STRUCTURED PROVIDER NAME FIRST override above. This is what
  // makes "senior care Florida" and "memory care facility around Tacoma" UNSUPPORTED here too,
  // exactly as they are natively, instead of this operation inventing its own separate judgment.
  const plan = interpretSeniorAskQuery(req.name, req.page);
  if (plan.mode !== "entity" || plan.identityQuery === undefined) {
    return {
      resultState: "UNSUPPORTED_OPERATION",
      name: { supplied: req.name, predicateApplied: false },
      message:
        plan.failReason ??
        "This text was not accepted as a structured provider name by SeniorTrustHub's current search.",
    };
  }
  // An explicit structured `state` is layered on top of the parsed plan only when the name itself
  // carried no geography of its own -- it narrows the SAME unscoped identity search (see
  // identitySearch() in senior-ask-execute.ts), never a second query and never overriding a place
  // already found inside the name.
  const query =
    req.state && !plan.geography
      ? {
          ...plan,
          geography: { type: "state" as const, value: req.state, meaning: LOCATION_MEANING },
        }
      : plan;
  let result;
  try {
    result = await executeSeniorResearchPlan(query);
  } catch {
    return {
      resultState: "TECHNICAL_FAILURE",
      name: { supplied: req.name, predicateApplied: false },
      failureKind: "unavailable",
      message:
        "SeniorTrustHub name search is temporarily unavailable. This is not a completed miss.",
    };
  }
  if (result.query.terminalState === "SOURCE_UNAVAILABLE") {
    return {
      resultState: "TECHNICAL_FAILURE",
      name: { supplied: req.name, predicateApplied: false },
      failureKind: "unavailable",
      message:
        result.failClosed?.reason ?? "SeniorTrustHub name search is temporarily unavailable.",
    };
  }
  if (
    result.failClosed ||
    result.query.mode !== "entity" ||
    result.query.identityQuery === undefined
  ) {
    // The supplied text was not accepted as a structured provider name by the one shared parser
    // (e.g. it was reduced to a bare, unsupported non-CMS category phrase) -- unsupported scope, not
    // a completed miss, and never silently substituted with a class browse of some other class.
    return {
      resultState: "UNSUPPORTED_OPERATION",
      name: { supplied: req.name, predicateApplied: false },
      message:
        result.failClosed?.reason ??
        "This text was not accepted as a structured provider name by SeniorTrustHub's current search.",
    };
  }
  const filtered = req.providerClass
    ? result.entities.filter((e) => e.providerClass === req.providerClass)
    : result.entities;
  const candidates = filtered.map(toRow);
  const truncated = Boolean(result.pagination.hasMore);
  return {
    resultState: truncated
      ? "PARTIAL_TRUNCATED"
      : candidates.length
        ? "COMPLETED_WITH_CANDIDATES"
        : "COMPLETED_NO_CANDIDATES",
    name: { supplied: req.name, predicateApplied: true },
    providerClassFilter: req.providerClass ?? null,
    state: req.state ?? null,
    candidates,
    pagination: { page: result.pagination.page, hasMore: result.pagination.hasMore },
    limitations: [
      ...result.limitations,
      "A name match means only that this published provider record's name matches the supplied name -- not verified service coverage, a recommendation, or a quality conclusion.",
      ...(req.providerClass
        ? [
            "providerClass narrows the candidates already returned by the unscoped name search; it never changes which sources were searched.",
          ]
        : []),
    ],
  };
}
