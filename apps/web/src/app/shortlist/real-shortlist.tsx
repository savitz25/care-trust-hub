"use client";
import { useEffect, useMemo, useState } from "react";
import type { CareProviderSearchResult } from "@/server/care/types";
import { RealProviderCard } from "@/components/real-provider";

const STORAGE_KEY = "care-public-shortlist-v1";
export function RealShortlistWorkspace({
  candidates,
  submittedNames,
}: {
  candidates: CareProviderSearchResult[];
  submittedNames: string[];
}) {
  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(value))
        return value.filter((item) => typeof item === "string").slice(0, 10);
    } catch {}
    return [];
  });
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);
  const toggle = (ccn: string) =>
    setSelected((current) =>
      current.includes(ccn)
        ? current.filter((item) => item !== ccn)
        : current.length < 10
          ? [...current, ccn]
          : current,
    );
  const compare = selected.slice(0, 3).join(",");
  const selectedCandidates = useMemo(
    () => candidates.filter((item) => selected.includes(item.ccn)),
    [candidates, selected],
  );
  return (
    <>
      {submittedNames.length > 0 && (
        <div className="match-summary" aria-live="polite">
          <strong>{candidates.length} possible CMS matches</strong>
          <span>
            Confirm each facility by name, city, state, and CMS ID. Similar names are never silently
            matched.
          </span>
        </div>
      )}
      {submittedNames.length > 0 && candidates.length === 0 && (
        <div className="empty-state">
          <h2>No candidate matched</h2>
          <p>Try part of the facility name or add its city and state.</p>
        </div>
      )}
      <div className="matched-list">
        {candidates.map((provider) => (
          <div className="selectable-result" key={provider.ccn}>
            <label className="compare-check">
              <input
                type="checkbox"
                checked={selected.includes(provider.ccn)}
                onChange={() => toggle(provider.ccn)}
                disabled={!selected.includes(provider.ccn) && selected.length >= 10}
              />
              <span>
                Confirm {provider.providerName}, {provider.location.city}, {provider.location.state}{" "}
                — CMS ID {provider.ccn}
              </span>
            </label>
            <RealProviderCard provider={provider} compareCcns={selected.slice(0, 2)} />
          </div>
        ))}
      </div>
      {selected.length > 0 && (
        <section className="shortlist-overview" aria-labelledby="saved-title">
          <h2 id="saved-title">Your shortlist</h2>
          <p>
            {selected.length} confirmed facilities. Only public CMS provider IDs are stored in this
            browser.
          </p>
          {selectedCandidates.map((provider) => (
            <p key={provider.ccn}>
              <strong>{provider.providerName}</strong> — {provider.location.city},{" "}
              {provider.location.state}
            </p>
          ))}
          <div className="facility-card__actions">
            {selected.length >= 2 && (
              <a className="button button--primary" href={`/compare?real=${compare}`}>
                Compare up to 3
              </a>
            )}
            <a className="button button--secondary" href={`/research?real=${selected.join(",")}`}>
              Create research summary
            </a>
          </div>
        </section>
      )}
    </>
  );
}
