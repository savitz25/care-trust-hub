import type { ReactNode } from "react";
import type { EvidenceDimension, HistoryEvent, Signal, SourceCitation } from "@care/domain";
import { isPublicLaunchEnabled } from "@/config/deployment";

export function RealDataNotice({ compact = false }: { compact?: boolean }) {
  if (isPublicLaunchEnabled()) return null;
  return (
    <div className={`real-data-notice${compact ? " synthetic-notice--compact" : ""}`} role="note">
      <strong>Controlled real CMS data review</strong>
      <span>
        Not publicly activated. This preview combines verified CMS datasets and transparent
        calculations and is excluded from search indexing.
      </span>
    </div>
  );
}

export function SyntheticDataNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`synthetic-notice${compact ? " synthetic-notice--compact" : ""}`} role="note">
      <strong>Synthetic demonstration data</strong>
      <span>Every facility, value, event, and source record on this prototype is fictional.</span>
    </div>
  );
}

export function EvidenceBadge({ signal, children }: { signal: Signal; children: ReactNode }) {
  return (
    <span className={`evidence-badge evidence-badge--${signal}`}>
      <span className="evidence-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function StarValue({ value }: { value: number | null }) {
  if (value === null) return <span className="star-value star-value--empty">Not enough data</span>;
  return (
    <span className="star-value" aria-label={`${value} out of 5 stars`}>
      <span aria-hidden="true">
        {"★".repeat(value)}
        {"☆".repeat(5 - value)}
      </span>
      <small>{value}/5</small>
    </span>
  );
}

export function EvidenceDimensionCard({ dimension }: { dimension: EvidenceDimension }) {
  return (
    <article className="dimension-card">
      <div className="dimension-card__top">
        <h3>{dimension.label}</h3>
        <EvidenceBadge signal={dimension.signal}>{dimension.value}</EvidenceBadge>
      </div>
      <p>{dimension.detail}</p>
    </article>
  );
}

export function TrendIndicator({
  trend,
}: {
  trend: "improving" | "stable" | "declining" | "limited";
}) {
  const symbol =
    trend === "improving" ? "↗" : trend === "declining" ? "↘" : trend === "stable" ? "→" : "—";
  return (
    <span className={`trend trend--${trend}`}>
      <span aria-hidden="true">{symbol}</span> {trend[0].toUpperCase() + trend.slice(1)}
    </span>
  );
}

export function SourceDisclosure({ source }: { source: SourceCitation }) {
  return (
    <details className="source-disclosure">
      <summary>View source details</summary>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{source.dataset}</dd>
        </div>
        <div>
          <dt>Release</dt>
          <dd>{source.release}</dd>
        </div>
        <div>
          <dt>Observed</dt>
          <dd>{source.observed}</dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>{source.record}</dd>
        </div>
      </dl>
    </details>
  );
}

export function HistoryTimeline({ events }: { events: readonly HistoryEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li
          key={`${event.date}-${event.title}`}
          className={`timeline__item timeline__item--${event.kind}`}
        >
          <div className="timeline__marker" aria-hidden="true" />
          <div>
            <time>{event.date}</time>
            <h3>{event.title}</h3>
            <p>{event.detail}</p>
            <span className="source-inline">Synthetic source · {event.date}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TrustStrip() {
  return (
    <section className="trust-strip" aria-label="Our independence commitments">
      {[
        "No paid placements",
        "No facility lead fees",
        "Public sources cited",
        "Data dates shown",
      ].map((item) => (
        <div key={item}>
          <span aria-hidden="true">✓</span>
          <strong>{item}</strong>
        </div>
      ))}
    </section>
  );
}
