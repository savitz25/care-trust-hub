"use client";

import { HeaderDisclosure } from "./header-disclosure";
import { TH_HUB_ACCENT } from "@/lib/design/trusthub-visual-standard";
import { CURRENT_NETWORK_HUB_ID, NETWORK_REGISTRY, switcherEntries } from "@/lib/network/registry";

type Props = {
  variant?: "dropdown" | "embedded";
};

function HubRows({ onPick }: { onPick?: () => void }) {
  return (
    <ul className="th-hub-rows">
      {switcherEntries().map((hub) => {
        const current = hub.id === CURRENT_NETWORK_HUB_ID;
        return (
          <li key={hub.id}>
            <a
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
  const current = NETWORK_REGISTRY[CURRENT_NETWORK_HUB_ID];

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
    <HeaderDisclosure
      label="Switch Hub"
      buttonClass="th-btn-secondary"
      panelClass="th-network-panel"
    >
      <nav aria-label="Ask Trust Hub Network">
        <p className="th-network-eyebrow">ASK TRUST HUB NETWORK</p>
        <HubRows />
        <p className="th-network-foot">
          You are on {current.name} — {current.switcherLabel}.
        </p>
      </nav>
    </HeaderDisclosure>
  );
}
