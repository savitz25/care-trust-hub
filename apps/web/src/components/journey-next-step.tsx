import type { JourneyModule } from "@/lib/journey-handoff";

export function JourneyNextStep({ module }: { module: JourneyModule | null }) {
  if (!module) return null;
  return (
    <aside className="journey-next" aria-labelledby="journey-next-heading" data-journey-handoff="senior">
      <p className="journey-next__eyebrow">{module.eyebrow}</p>
      <h2 id="journey-next-heading">{module.heading}</h2>
      <p>{module.body}</p>
      <p className="journey-next__actions">
        <a className="journey-next__primary" href={module.primary.href} rel="noopener noreferrer">
          {module.primary.label}
        </a>
        {module.secondary ? (
          <a className="journey-next__secondary" href={module.secondary.href} rel="noopener noreferrer">
            {module.secondary.label}
          </a>
        ) : null}
      </p>
    </aside>
  );
}
