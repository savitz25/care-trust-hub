"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TH_HUB_ACCENT } from "@/lib/design/trusthub-visual-standard";
import { CURRENT_NETWORK_HUB_ID, NETWORK_REGISTRY, switcherEntries } from "@/lib/network/registry";

type Props = {
  variant?: "dropdown" | "embedded";
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`th-chevron${open ? " is-open" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HubRows({ onPick }: { onPick?: () => void }) {
  return (
    <ul className="th-hub-rows">
      {switcherEntries().map((hub) => {
        const current = hub.id === CURRENT_NETWORK_HUB_ID;
        return (
          <li key={hub.id}>
            <a
              role="menuitem"
              href={hub.url}
              aria-current={current ? "page" : undefined}
              rel={current ? undefined : "noopener noreferrer"}
              className={`th-hub-row${current ? " is-current" : ""}`}
              onClick={onPick}
            >
              <span
                className="th-hub-dot"
                style={{ backgroundColor: TH_HUB_ACCENT[hub.id] }}
                aria-hidden
              />
              <span className="th-hub-copy">
                <span className="th-hub-name">
                  {hub.name}
                  {current ? <span className="th-hub-current">Current</span> : null}
                </span>
                <span className="th-hub-blurb">{hub.switcherLabel}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function SwitchHubMenu({ variant = "dropdown" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const current = NETWORK_REGISTRY[CURRENT_NETWORK_HUB_ID];

  useEffect(() => {
    if (variant !== "dropdown") return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [variant]);

  if (variant === "embedded") {
    return (
      <div className="th-network-panel-embed">
        <p className="th-network-eyebrow">ASK TRUST HUB NETWORK</p>
        <HubRows />
        <p className="th-network-foot">
          You are on {current.name} — {current.switcherLabel}.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="th-switch">
      <button
        type="button"
        className={`th-btn-secondary${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Switch Hub
        <Chevron open={open} />
      </button>
      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-label="Ask Trust Hub Network"
          className="th-network-panel"
        >
          <p className="th-network-eyebrow">ASK TRUST HUB NETWORK</p>
          <HubRows onPick={() => setOpen(false)} />
          <p className="th-network-foot">
            You are on {current.name} — {current.switcherLabel}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
