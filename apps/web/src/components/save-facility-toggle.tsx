"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  browserDirectPorts,
  parentSync,
  resumeDirect,
  startDirect,
  type DirectIntent,
} from "@/lib/my-trusthub/direct-save-client";
import {
  SAVED_CHANGE_EVENT,
  SAVED_MAX,
  isFacilitySaved,
  saveFacility,
  unsaveFacility,
} from "@/lib/my-trusthub/saved-store";

/** Client half of My TrustHub sync. Bundled at build; OFF unless the master
 * switch is "1". Even when on, the server decides: with the gate closed the
 * endpoint answers "unavailable" and the Save stays on this device. */
export const PARENT_SYNC_UI = process.env.NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED === "1";
const CANARY_CCNS = (process.env.NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

/**
 * One Save toggle for a CMS facility profile: Save -> Saved -> Save.
 *
 * Device-first: the saved list on this device is written or cleared
 * immediately and never waits for anything. It never starts a Watch. The
 * visible word and aria-pressed carry the state.
 *
 * My TrustHub sync (off by default) is additive. The hand-off is a chain of
 * navigations that a click elsewhere abandons, so while it runs the page shows
 * a blocking notice, and an Unsave the parent did not acknowledge is never
 * reported as an account Unsave: the control says it may still be saved in
 * My TrustHub and offers the removal again.
 */
function subscribeSaved(onChange: () => void) {
  window.addEventListener(SAVED_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SAVED_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const subscribeNothing = () => () => {};

export function SaveFacilityToggle({ ccn, name }: { ccn: string; name: string }) {
  // The device list is the store; the control only reflects it.
  const saved = useSyncExternalStore(
    subscribeSaved,
    () => isFacilitySaved(ccn),
    () => false,
  );
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const [note, setNote] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<"save" | "unsave" | null>(null);
  const [parentHeld, setParentHeld] = useState(false);
  const [signInOffer, setSignInOffer] = useState(false);
  const direct = PARENT_SYNC_UI && (CANARY_CCNS.length === 0 || CANARY_CCNS.includes(ccn));
  const here = useRef(true);

  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, [ccn]);

  useEffect(() => {
    if (!syncing) return;
    // The notice ends with the page. If the navigation never happens, or the
    // page is restored from the back/forward cache, release it.
    const release = () => setSyncing(null);
    const timer = window.setTimeout(release, 30_000);
    window.addEventListener("pageshow", release);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", release);
    };
  }, [syncing]);

  // Back from My TrustHub (or reopening the profile after an abandoned
  // hand-off): report only what the parent acknowledged. Consumed once.
  useEffect(() => {
    if (!direct) return;
    let active = true;
    void resumeDirect(browserDirectPorts(), ccn).then((result) => {
      if (!active) return;
      setParentHeld(parentSync(localStorage, ccn) !== null);
      if (!result) return;
      if (result.intent === "unsave")
        setNote(
          result.outcome === "confirmed"
            ? "Removed from this device and My TrustHub"
            : "Removed from this device. My TrustHub did not confirm the removal.",
        );
      else {
        setNote(
          result.outcome === "confirmed"
            ? "Saved to My TrustHub"
            : result.outcome === "not_confirmed"
              ? "Saved on this device. Sign in to My TrustHub to sync across devices."
              : "Saved on this device",
        );
        setSignInOffer(result.outcome === "not_confirmed");
      }
    });
    return () => {
      active = false;
    };
  }, [direct, ccn]);

  /** Stage and hand the browser to My TrustHub. Nothing navigates once the user has left this profile. */
  const handOff = async (intent: DirectIntent) => {
    setSyncing(intent === "unsave" ? "unsave" : "save");
    const result = await startDirect(browserDirectPorts(), ccn, intent, () => here.current);
    if (result !== "navigating") setSyncing(null);
    return result;
  };

  // Signed-out continuation: the parent shows its sign-in step and then finishes
  // the Save. No second Save click, no confirmation.
  const signInToSync = () => {
    setSignInOffer(false);
    void handOff("save_signin").then((result) => {
      if (result !== "navigating")
        setNote("My TrustHub is unavailable right now. Your Save stays on this device.");
    });
  };

  const retryParentUnsave = () => {
    void handOff("unsave").then((result) => {
      if (result !== "navigating")
        setNote("My TrustHub could not be reached. It may still be saved there.");
    });
  };

  const toggle = async () => {
    if (syncing) return;
    setSignInOffer(false);
    if (saved) {
      const reachParent = direct && parentSync(localStorage, ccn) !== null;
      // The device removal is immediate and never depends on the parent.
      unsaveFacility(ccn);
      if (!reachParent) {
        setNote("Removed from your saved facilities on this device");
        return;
      }
      setParentHeld(true);
      if ((await handOff("unsave")) === "navigating") return;
      setNote(
        "Removed from this device. My TrustHub could not be reached, so it may still be saved there.",
      );
      return;
    }
    // The device Save is complete before anything else is attempted.
    const outcome = saveFacility(ccn);
    const stored = outcome === "saved" || outcome === "already_saved";
    if (!stored) {
      setNote(
        outcome === "full"
          ? `Your saved list is full (${SAVED_MAX}). Remove one on the shortlist page to save another.`
          : "Could not save on this device",
      );
      return;
    }
    if (!direct) {
      setNote("Saved on this device");
      return;
    }
    const result = await handOff("save");
    if (result === "navigating") return;
    setNote(
      result === "not_eligible"
        ? "Saved on this device. This profile can’t be added to My TrustHub yet."
        : "Saved on this device",
    );
  };

  const progress =
    syncing && typeof document !== "undefined"
      ? createPortal(
          <div
            role="status"
            aria-live="assertive"
            data-mth-sync={syncing}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.7)",
              padding: 16,
            }}
          >
            <div
              style={{
                maxWidth: 320,
                background: "#fff",
                border: "1px solid currentColor",
                borderRadius: 12,
                padding: "16px 20px",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              {syncing === "unsave" ? "Removing from My TrustHub…" : "Saving to My TrustHub…"}
              <span style={{ display: "block", marginTop: 4, fontWeight: 400, fontSize: "0.8rem" }}>
                Keep this page open. This takes a few seconds.
              </span>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <span
      data-save-state={mounted && saved ? "saved" : "unsaved"}
      data-parent-sync={direct ? "on" : "off"}
      style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}
    >
      <button
        className="button button--secondary"
        type="button"
        onClick={() => void toggle()}
        disabled={syncing !== null}
        data-save-toggle="true"
        aria-pressed={mounted ? saved : undefined}
        aria-busy={syncing !== null}
        aria-label={
          saved ? `Saved: ${name}. Select to remove from your saved facilities.` : `Save ${name}`
        }
      >
        {saved ? "Saved" : "Save"}
      </button>
      <span role="status" aria-live="polite" className="source-inline">
        {note}
      </span>
      {direct && mounted && saved && signInOffer && !syncing ? (
        <span className="source-inline" data-mth-sign-in="true">
          <a
            href="#sign-in-to-my-trusthub"
            onClick={(event) => {
              event.preventDefault();
              signInToSync();
            }}
          >
            Sign in to My TrustHub
          </a>
        </span>
      ) : null}
      {direct && mounted && !saved && parentHeld && !syncing ? (
        <span className="source-inline" data-mth-parent-held="true">
          May still be saved in My TrustHub.{" "}
          <a
            href="#remove-from-my-trusthub"
            onClick={(event) => {
              event.preventDefault();
              retryParentUnsave();
            }}
          >
            Remove it there
          </a>
        </span>
      ) : null}
      {progress}
    </span>
  );
}
