"use client";

import type { JourneyCta, JourneyModule } from "@/lib/journey-handoff";
import { trackJourneyHandoff } from "@/lib/journey-analytics";

export function JourneyNextStep({ module }: { module: JourneyModule | null }) {
  if (!module) return null;
  const onClick = (cta: JourneyCta) => {
    trackJourneyHandoff({
      destination_hub: cta.destination_hub,
      surface: module.surface,
      journey_id: cta.journey_id,
      context_type: cta.context_type,
    });
  };
  return (
    <aside className="journey-next" aria-labelledby="journey-next-heading" data-journey-handoff="senior">
      <p className="journey-next__eyebrow">{module.eyebrow}</p>
      <h2 id="journey-next-heading">{module.heading}</h2>
      <p>{module.body}</p>
      <p className="journey-next__actions">
        <a
          className="journey-next__primary"
          href={module.primary.href}
          rel="noopener noreferrer"
          onClick={() => onClick(module.primary)}
        >
          {module.primary.label}
        </a>
        {module.secondary ? (
          <a
            className="journey-next__secondary"
            href={module.secondary.href}
            rel="noopener noreferrer"
            onClick={() => onClick(module.secondary!)}
          >
            {module.secondary.label}
          </a>
        ) : null}
      </p>
    </aside>
  );
}
