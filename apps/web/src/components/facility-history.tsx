"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_HISTORY_LIMIT,
  filterHistoryEvents,
  groupHistoryByYear,
  type HistoryFilter,
} from "@care/domain";
import type { CareFacilityHistory } from "@/server/care/types";

const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "rating", label: "Ratings" },
  { id: "staffing", label: "Staffing" },
  { id: "inspection", label: "Inspections" },
  { id: "enforcement", label: "Enforcement" },
  { id: "ownership", label: "Ownership" },
];

function formatEventDate(
  value: string,
  precision: CareFacilityHistory["events"][number]["datePrecision"],
) {
  const date = new Date(`${value}T00:00:00Z`);
  if (precision === "quarter") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  if (precision === "release" || precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function FacilityHistory({ history }: { history: CareFacilityHistory }) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(
    () => filterHistoryEvents(history.events, filter),
    [filter, history.events],
  );
  const visible = expanded ? filtered : filtered.slice(0, DEFAULT_HISTORY_LIMIT);
  const grouped = groupHistoryByYear(visible);

  return (
    <section className="facility-history" id="history" aria-labelledby="facility-history-title">
      <div className="section-heading">
        <p className="eyebrow">Facility history</p>
        <h2 id="facility-history-title">Facility History</h2>
        <p>
          {history.coverageLabel}. Dates and values come from published CMS evidence, not a score.
        </p>
      </div>

      <div className="facility-history__recent">
        <h3>What changed recently?</h3>
        {history.recentHighlights.length > 0 ? (
          <ul>
            {history.recentHighlights.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{history.emptyRecentLabel}</p>
        )}
      </div>

      <div className="facility-history__filters" role="group" aria-label="Filter facility history">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === filter ? "button button--secondary" : "button button--quiet"}
            aria-pressed={item.id === filter}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p>No published history events match this filter.</p>
      ) : (
        grouped.map((group) => (
          <section
            key={group.year}
            className="facility-history__year"
            aria-labelledby={`history-${group.year}`}
          >
            <h3 id={`history-${group.year}`}>{group.year}</h3>
            <ol className="facility-history__list">
              {group.events.map((item) => (
                <li key={item.id}>
                  <time dateTime={item.eventDate}>
                    {formatEventDate(item.eventDate, item.datePrecision)}
                  </time>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    {item.previousValue && item.newValue ? (
                      <p className="facility-history__values">
                        {item.previousValue} → {item.newValue}
                      </p>
                    ) : null}
                    <p className="facility-history__source">
                      {item.dateBasis === "reported_in_release"
                        ? "Reported in a CMS release"
                        : "CMS recorded event date"}
                      {" · "}
                      <a href={item.evidenceHref}>View related evidence</a>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}

      {filtered.length > DEFAULT_HISTORY_LIMIT ? (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show recent history" : "View more history"}
        </button>
      ) : null}
    </section>
  );
}
