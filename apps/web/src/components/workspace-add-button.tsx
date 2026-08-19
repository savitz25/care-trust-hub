"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  FAMILY_WORKSPACE_MAX_FACILITIES,
  FAMILY_WORKSPACE_PATH,
  parseFamilyWorkspace,
  type WorkspaceProviderKind,
} from "@care/domain";
import {
  addAssistedLivingProviderToWorkspace,
  addFacilityToWorkspace,
  familyWorkspaceSnapshot,
  subscribeFamilyWorkspace,
} from "./family-workspace-storage";

export function WorkspaceAddButton({
  ccn,
  provider,
  compact = false,
}: {
  ccn?: string;
  provider?: { kind: WorkspaceProviderKind; id: string };
  compact?: boolean;
}) {
  const target = provider ?? (ccn ? { kind: "cms" as const, id: ccn.trim().toUpperCase() } : null);
  const raw = useSyncExternalStore(subscribeFamilyWorkspace, familyWorkspaceSnapshot, () => "");
  const workspace = useMemo(() => parseFamilyWorkspace(raw || null), [raw]);
  const present = Boolean(
    target &&
      workspace.entries.some((entry) => entry.kind === target.kind && entry.id === target.id),
  );
  const [message, setMessage] = useState<string | null>(null);

  function add() {
    if (!target) return;
    const result =
      target.kind === "assisted_living"
        ? addAssistedLivingProviderToWorkspace(target.id)
        : addFacilityToWorkspace(target.id);
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

  if (!target) return null;

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
