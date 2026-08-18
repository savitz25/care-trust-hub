"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  FAMILY_WORKSPACE_MAX_FACILITIES,
  FAMILY_WORKSPACE_PATH,
  parseFamilyWorkspace,
} from "@care/domain";
import {
  addFacilityToWorkspace,
  familyWorkspaceSnapshot,
  subscribeFamilyWorkspace,
} from "./family-workspace-storage";

export function WorkspaceAddButton({ ccn, compact = false }: { ccn: string; compact?: boolean }) {
  const raw = useSyncExternalStore(subscribeFamilyWorkspace, familyWorkspaceSnapshot, () => "");
  const workspace = useMemo(() => parseFamilyWorkspace(raw || null), [raw]);
  const present = workspace.entries.some((entry) => entry.ccn === ccn.trim().toUpperCase());
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    const result = addFacilityToWorkspace(ccn);
    if (!result.ok && result.reason === "max_reached") {
      setMessage(
        `Workspace is full (${FAMILY_WORKSPACE_MAX_FACILITIES} of ${FAMILY_WORKSPACE_MAX_FACILITIES}).`,
      );
      return;
    }
    if (result.ok) {
      setMessage(
        result.alreadyPresent
          ? "Already in your Family Workspace."
          : `Added. ${result.state.entries.length} of ${FAMILY_WORKSPACE_MAX_FACILITIES} facilities saved.`,
      );
    }
  }

  if (present) {
    return (
      <span className="workspace-add">
        <span className="workspace-add__status">In Family Workspace</span>
        {compact ? null : (
          <Link className="text-link" href={FAMILY_WORKSPACE_PATH}>
            Open Workspace
          </Link>
        )}
      </span>
    );
  }

  return (
    <span className="workspace-add">
      <button
        className={compact ? "button button--quiet" : "button button--secondary"}
        type="button"
        onClick={add}
      >
        {compact ? "Add to Workspace" : "Add to Family Workspace"}
      </button>
      {message ? <span className="workspace-add__note">{message}</span> : null}
    </span>
  );
}
