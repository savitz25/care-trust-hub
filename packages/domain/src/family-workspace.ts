/**
 * Family Comparison Workspace v1 — browser-local shortlist model.
 *
 * Stores CCNs and user annotations only. Published evidence is fetched fresh
 * and must never be copied into localStorage.
 */

export const FAMILY_WORKSPACE_VERSION = "senior-family-workspace-v1" as const;
export const FAMILY_WORKSPACE_PATH = "/workspace";
export const FAMILY_WORKSPACE_STORAGE_KEY = "sth-family-workspace-v1";
export const FAMILY_WORKSPACE_MAX_FACILITIES = 5;
export const FAMILY_WORKSPACE_NOTE_LIMIT = 2000;

export const FAMILY_WORKSPACE_SHARED_DEVICE_WARNING =
  "Saved only in this browser. Avoid storing sensitive medical or financial information on a shared device.";

export const RESEARCH_STAGES = [
  "researching",
  "planning_visit",
  "visited_or_spoke",
  "no_longer_considering",
] as const;

export type ResearchStage = (typeof RESEARCH_STAGES)[number];

export const RESEARCH_STAGE_LABELS: Record<ResearchStage, string> = {
  researching: "Researching",
  planning_visit: "Planning a visit",
  visited_or_spoke: "Visited / spoke with facility",
  no_longer_considering: "No longer considering",
};

export type QuoteCadence = "monthly" | "daily";

export interface FamilyWorkspaceEntry {
  readonly ccn: string;
  readonly addedAt: string;
  readonly researchStage: ResearchStage | null;
  readonly notes: string;
  readonly visitNotes: string;
  readonly quotedAmount: number | null;
  readonly quotedCadence: QuoteCadence | null;
}

export interface FamilyWorkspaceState {
  readonly version: typeof FAMILY_WORKSPACE_VERSION;
  readonly entries: readonly FamilyWorkspaceEntry[];
}

export type WorkspaceAddResult =
  | { readonly ok: true; readonly state: FamilyWorkspaceState; readonly alreadyPresent: boolean }
  | {
      readonly ok: false;
      readonly reason: "invalid_ccn" | "max_reached";
      readonly state: FamilyWorkspaceState;
    };

export function emptyFamilyWorkspace(): FamilyWorkspaceState {
  return { version: FAMILY_WORKSPACE_VERSION, entries: [] };
}

export function isValidWorkspaceCcn(value: string): boolean {
  return /^[A-Z0-9]{6}$/.test(value.trim().toUpperCase());
}

export function normalizeWorkspaceCcn(value: string): string | null {
  const ccn = value.trim().toUpperCase();
  return isValidWorkspaceCcn(ccn) ? ccn : null;
}

export function isResearchStage(value: string): value is ResearchStage {
  return (RESEARCH_STAGES as readonly string[]).includes(value);
}

function clipNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, FAMILY_WORKSPACE_NOTE_LIMIT);
}

function parseQuotedAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function parseCadence(value: unknown): QuoteCadence | null {
  return value === "monthly" || value === "daily" ? value : null;
}

function parseEntry(value: unknown): FamilyWorkspaceEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const ccn = typeof record.ccn === "string" ? normalizeWorkspaceCcn(record.ccn) : null;
  if (!ccn) return null;
  const addedAt =
    typeof record.addedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(record.addedAt)
      ? record.addedAt
      : "1970-01-01T00:00:00.000Z";
  const researchStage =
    typeof record.researchStage === "string" && isResearchStage(record.researchStage)
      ? record.researchStage
      : null;
  return {
    ccn,
    addedAt,
    researchStage,
    notes: clipNote(record.notes),
    visitNotes: clipNote(record.visitNotes),
    quotedAmount: parseQuotedAmount(record.quotedAmount),
    quotedCadence: parseCadence(record.quotedCadence),
  };
}

export function parseFamilyWorkspace(raw: string | null | undefined): FamilyWorkspaceState {
  if (!raw) return emptyFamilyWorkspace();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyFamilyWorkspace();
    const record = parsed as { version?: unknown; entries?: unknown };
    const source = Array.isArray(record.entries)
      ? record.entries
      : Array.isArray(parsed)
        ? parsed
        : [];
    const seen = new Set<string>();
    const entries: FamilyWorkspaceEntry[] = [];
    for (const item of source) {
      const entry = parseEntry(item);
      if (!entry || seen.has(entry.ccn)) continue;
      seen.add(entry.ccn);
      entries.push(entry);
      if (entries.length === FAMILY_WORKSPACE_MAX_FACILITIES) break;
    }
    return { version: FAMILY_WORKSPACE_VERSION, entries };
  } catch {
    return emptyFamilyWorkspace();
  }
}

export function serializeFamilyWorkspace(state: FamilyWorkspaceState): string {
  return JSON.stringify({
    version: FAMILY_WORKSPACE_VERSION,
    entries: state.entries.map((entry) => ({
      ccn: entry.ccn,
      addedAt: entry.addedAt,
      researchStage: entry.researchStage,
      notes: entry.notes,
      visitNotes: entry.visitNotes,
      quotedAmount: entry.quotedAmount,
      quotedCadence: entry.quotedCadence,
    })),
  });
}

export function addWorkspaceFacility(
  state: FamilyWorkspaceState,
  rawCcn: string,
  now = new Date(),
): WorkspaceAddResult {
  const ccn = normalizeWorkspaceCcn(rawCcn);
  if (!ccn) return { ok: false, reason: "invalid_ccn", state };
  if (state.entries.some((entry) => entry.ccn === ccn)) {
    return { ok: true, state, alreadyPresent: true };
  }
  if (state.entries.length >= FAMILY_WORKSPACE_MAX_FACILITIES) {
    return { ok: false, reason: "max_reached", state };
  }
  return {
    ok: true,
    alreadyPresent: false,
    state: {
      version: FAMILY_WORKSPACE_VERSION,
      entries: [
        ...state.entries,
        {
          ccn,
          addedAt: now.toISOString(),
          researchStage: null,
          notes: "",
          visitNotes: "",
          quotedAmount: null,
          quotedCadence: null,
        },
      ],
    },
  };
}

export function removeWorkspaceFacility(
  state: FamilyWorkspaceState,
  rawCcn: string,
): FamilyWorkspaceState {
  const ccn = normalizeWorkspaceCcn(rawCcn);
  if (!ccn) return state;
  return {
    version: FAMILY_WORKSPACE_VERSION,
    entries: state.entries.filter((entry) => entry.ccn !== ccn),
  };
}

export function updateWorkspaceAnnotation(
  state: FamilyWorkspaceState,
  rawCcn: string,
  patch: Partial<
    Pick<
      FamilyWorkspaceEntry,
      "researchStage" | "notes" | "visitNotes" | "quotedAmount" | "quotedCadence"
    >
  >,
): FamilyWorkspaceState {
  const ccn = normalizeWorkspaceCcn(rawCcn);
  if (!ccn) return state;
  return {
    version: FAMILY_WORKSPACE_VERSION,
    entries: state.entries.map((entry) => {
      if (entry.ccn !== ccn) return entry;
      return {
        ...entry,
        researchStage:
          patch.researchStage === undefined
            ? entry.researchStage
            : patch.researchStage && isResearchStage(patch.researchStage)
              ? patch.researchStage
              : null,
        notes: patch.notes === undefined ? entry.notes : clipNote(patch.notes),
        visitNotes: patch.visitNotes === undefined ? entry.visitNotes : clipNote(patch.visitNotes),
        quotedAmount:
          patch.quotedAmount === undefined
            ? entry.quotedAmount
            : parseQuotedAmount(patch.quotedAmount),
        quotedCadence:
          patch.quotedCadence === undefined
            ? entry.quotedCadence
            : parseCadence(patch.quotedCadence),
      };
    }),
  };
}

export function workspaceCcns(state: FamilyWorkspaceState): string[] {
  return state.entries.map((entry) => entry.ccn);
}
