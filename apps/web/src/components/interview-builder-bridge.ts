import {
  isInterviewCareSetting,
  isInterviewConcernTag,
  type InterviewCareSetting,
  type InterviewConcernTag,
} from "@care/domain";
import type { CareSetting } from "@care/domain";

export const INTERVIEW_BUILDER_PATH = "/tools/facility-tour-interview-builder";
export const INTERVIEW_BUILDER_SEED_KEY = "sth-interview-builder-v1-seed";
export const INTERVIEW_BUILDER_CHECKED_KEY = "sth-interview-builder-v1-checked";
export const INTERVIEW_BUILDER_HIDDEN_KEY = "sth-interview-builder-v1-hidden";
export const INTERVIEW_BUILDER_NOTES_KEY = "sth-interview-builder-v1-notes";

export interface InterviewBuilderSeed {
  readonly setting?: InterviewCareSetting;
  readonly concerns?: readonly InterviewConcernTag[];
}

const NAVIGATOR_TO_INTERVIEW: Record<CareSetting, InterviewCareSetting | null> = {
  aging_in_place: "home_care",
  home_care: "home_care",
  home_health: "home_care",
  assisted_living: "assisted_living",
  memory_care: "memory_care",
  skilled_nursing: "skilled_nursing",
  short_term_rehab: "short_term_rehab",
};

export function mapNavigatorSettingToInterview(
  settings: readonly CareSetting[],
): InterviewCareSetting | null {
  for (const setting of settings) {
    const mapped = NAVIGATOR_TO_INTERVIEW[setting];
    if (mapped) return mapped;
  }
  return null;
}

export function storeInterviewBuilderSeed(seed: InterviewBuilderSeed): void {
  const setting = seed.setting && isInterviewCareSetting(seed.setting) ? seed.setting : undefined;
  const concerns = [...new Set((seed.concerns ?? []).filter(isInterviewConcernTag))];
  sessionStorage.setItem(INTERVIEW_BUILDER_SEED_KEY, JSON.stringify({ setting, concerns }));
}

export function subscribeInterviewBuilderSeed(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function interviewBuilderSeedSnapshot(): string {
  return sessionStorage.getItem(INTERVIEW_BUILDER_SEED_KEY) ?? "";
}

export function parseInterviewBuilderSeed(raw: string | null): InterviewBuilderSeed {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as { setting?: unknown; concerns?: unknown };
    const setting =
      typeof record.setting === "string" && isInterviewCareSetting(record.setting)
        ? record.setting
        : undefined;
    const concerns = Array.isArray(record.concerns)
      ? record.concerns.filter(
          (value): value is InterviewConcernTag =>
            typeof value === "string" && isInterviewConcernTag(value),
        )
      : [];
    return { setting, concerns };
  } catch {
    return {};
  }
}

export function readInterviewBuilderSeed(): InterviewBuilderSeed {
  try {
    return parseInterviewBuilderSeed(sessionStorage.getItem(INTERVIEW_BUILDER_SEED_KEY));
  } catch {
    return {};
  }
}

export function facilityInterviewBuilderHref(ccn: string): string {
  return `${INTERVIEW_BUILDER_PATH}?ccn=${encodeURIComponent(ccn.trim().toUpperCase())}`;
}

export function evidenceSectionHref(
  facilityHref: string,
  hint: "staffing" | "inspections" | "penalties" | "history" | "ownership" | "state",
): string {
  const hash = hint === "state" ? "state-license" : hint === "history" ? "history" : hint;
  return `${facilityHref}#${hash}`;
}

function readJsonRecord(key: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function readCheckedQuestionIds(): Set<string> {
  return new Set(Object.keys(readJsonRecord(INTERVIEW_BUILDER_CHECKED_KEY)));
}

export function writeCheckedQuestionIds(ids: ReadonlySet<string>): void {
  sessionStorage.setItem(
    INTERVIEW_BUILDER_CHECKED_KEY,
    JSON.stringify(Object.fromEntries([...ids].map((id) => [id, "1"]))),
  );
}

export function readHiddenQuestionIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(INTERVIEW_BUILDER_HIDDEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

export function writeHiddenQuestionIds(ids: ReadonlySet<string>): void {
  sessionStorage.setItem(INTERVIEW_BUILDER_HIDDEN_KEY, JSON.stringify([...ids]));
}

export function readQuestionNotes(): Record<string, string> {
  return readJsonRecord(INTERVIEW_BUILDER_NOTES_KEY);
}

export function writeQuestionNotes(notes: Record<string, string>): void {
  const compact = Object.fromEntries(
    Object.entries(notes).filter(([, value]) => value.trim().length > 0),
  );
  sessionStorage.setItem(INTERVIEW_BUILDER_NOTES_KEY, JSON.stringify(compact));
}
