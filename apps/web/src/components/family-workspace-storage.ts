import {
  FAMILY_WORKSPACE_STORAGE_KEY,
  addWorkspaceFacility,
  emptyFamilyWorkspace,
  parseFamilyWorkspace,
  removeWorkspaceFacility,
  serializeFamilyWorkspace,
  updateWorkspaceAnnotation,
  workspaceCcns,
  type FamilyWorkspaceEntry,
  type FamilyWorkspaceState,
  type ResearchStage,
  type QuoteCadence,
  type WorkspaceAddResult,
} from "@care/domain";

export {
  FAMILY_WORKSPACE_MAX_FACILITIES,
  FAMILY_WORKSPACE_PATH,
  FAMILY_WORKSPACE_SHARED_DEVICE_WARNING,
  FAMILY_WORKSPACE_STORAGE_KEY,
  FAMILY_WORKSPACE_VERSION,
  RESEARCH_STAGE_LABELS,
  RESEARCH_STAGES,
  USER_ENTERED_QUOTE_LABEL,
} from "@care/domain";

function notifyWorkspaceChange() {
  window.dispatchEvent(new Event("sth-family-workspace"));
}

function writeWorkspace(state: FamilyWorkspaceState): FamilyWorkspaceState {
  localStorage.setItem(FAMILY_WORKSPACE_STORAGE_KEY, serializeFamilyWorkspace(state));
  notifyWorkspaceChange();
  return state;
}

export function readFamilyWorkspace(): FamilyWorkspaceState {
  try {
    return parseFamilyWorkspace(localStorage.getItem(FAMILY_WORKSPACE_STORAGE_KEY));
  } catch {
    return emptyFamilyWorkspace();
  }
}

export function addFacilityToWorkspace(ccn: string, now = new Date()): WorkspaceAddResult {
  const result = addWorkspaceFacility(readFamilyWorkspace(), ccn, now);
  if (result.ok) writeWorkspace(result.state);
  return result;
}

export function removeFacilityFromWorkspace(ccn: string): FamilyWorkspaceState {
  return writeWorkspace(removeWorkspaceFacility(readFamilyWorkspace(), ccn));
}

export function updateFacilityWorkspaceAnnotation(
  ccn: string,
  patch: Partial<
    Pick<
      FamilyWorkspaceEntry,
      "researchStage" | "notes" | "visitNotes" | "quotedAmount" | "quotedCadence"
    >
  >,
): FamilyWorkspaceState {
  return writeWorkspace(updateWorkspaceAnnotation(readFamilyWorkspace(), ccn, patch));
}

export function clearFamilyWorkspace(): FamilyWorkspaceState {
  localStorage.removeItem(FAMILY_WORKSPACE_STORAGE_KEY);
  notifyWorkspaceChange();
  return emptyFamilyWorkspace();
}

export function subscribeFamilyWorkspace(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("sth-family-workspace", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("sth-family-workspace", onStoreChange);
  };
}

export function familyWorkspaceSnapshot(): string {
  return localStorage.getItem(FAMILY_WORKSPACE_STORAGE_KEY) ?? "";
}

export function familyWorkspaceCount(): number {
  return readFamilyWorkspace().entries.length;
}

export function isFacilityInWorkspace(ccn: string): boolean {
  return workspaceCcns(readFamilyWorkspace()).includes(ccn.trim().toUpperCase());
}

export type { FamilyWorkspaceEntry, FamilyWorkspaceState, QuoteCadence, ResearchStage };
