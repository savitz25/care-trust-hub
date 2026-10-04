/**
 * Device Save for CMS facility profiles.
 *
 * This is the existing public shortlist ("care-public-shortlist-v1": an array
 * of CMS CCNs, at most ten) that "Save to shortlist" on result cards and the
 * /shortlist page already use. The profile Save toggle reads and writes the
 * same list, so there is one saved list on the device, not two. It holds CCNs
 * only: no account, no name, no notes. It never starts a Watch and never
 * touches the Family Workspace.
 */
export const SAVED_STORAGE_KEY = "care-public-shortlist-v1";
export const SAVED_CHANGE_EVENT = "care-public-shortlist-change";
export const SAVED_MAX = 10;
const CCN = /^[A-Z0-9]{6}$/;

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item): item is string => typeof item === "string"))].slice(
          0,
          SAVED_MAX,
        )
      : [];
  } catch {
    return [];
  }
}
function write(ccns: string[]): boolean {
  try {
    localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(ccns));
    window.dispatchEvent(new Event(SAVED_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function listSavedFacilities(): string[] {
  return read();
}
export function isFacilitySaved(ccn: string): boolean {
  return read().includes(ccn);
}
export type SaveResult = "saved" | "already_saved" | "full" | "invalid" | "unavailable";
/** Idempotent. A full list is reported, never silently trimmed. */
export function saveFacility(ccn: string): SaveResult {
  if (!CCN.test(ccn)) return "invalid";
  const current = read();
  if (current.includes(ccn)) return "already_saved";
  if (current.length >= SAVED_MAX) return "full";
  return write([...current, ccn]) ? "saved" : "unavailable";
}
export function unsaveFacility(ccn: string): void {
  const current = read();
  if (current.includes(ccn)) write(current.filter((item) => item !== ccn));
}
