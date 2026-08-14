"use client";

import { useMemo, useState } from "react";
import { syntheticFacilities, type Facility } from "@care/domain";
import { FacilityCard } from "@/components/facility-card";

const example = "Harbor Pines\nMeadowridge\nWillow Harbor";

function matchNames(input: string): { query: string; matches: Facility[] }[] {
  return input
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((query) => ({
      query,
      matches: syntheticFacilities.filter((facility) =>
        facility.name.toLowerCase().includes(query.toLowerCase()),
      ),
    }));
}

export function ShortlistTool() {
  const [input, setInput] = useState(example);
  const [submitted, setSubmitted] = useState(example);
  const [selected, setSelected] = useState<string[]>([
    "harbor-pines",
    "meadowridge",
    "willow-harbor",
  ]);
  const groups = useMemo(() => matchNames(submitted), [submitted]);
  const matches = groups
    .flatMap(({ matches }) => matches)
    .filter(
      (facility, index, all) => all.findIndex(({ slug }) => slug === facility.slug) === index,
    );
  const toggle = (slug: string) =>
    setSelected((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : current.length < 3
          ? [...current, slug]
          : current,
    );
  return (
    <section className="shortlist-tool" aria-labelledby="shortlist-form-title">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(input);
        }}
      >
        <label id="shortlist-form-title" htmlFor="facility-names">
          <strong>Facility names</strong>
          <span>Paste one name per line, or separate names with commas.</span>
        </label>
        <textarea
          id="facility-names"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={5}
        />
        <button className="button button--primary" type="submit">
          Match facility names
        </button>
      </form>
      <div className="match-summary" aria-live="polite">
        <strong>{matches.length} fictional facilities matched</strong>
        <span>Select up to 4 to compare.</span>
      </div>
      {groups.some(({ matches }) => matches.length > 1) && (
        <div className="match-warning" role="status">
          <strong>One name may match more than one facility.</strong>
          <p>
            “Harbor Pines” matches two fictional records. Check the city and full name before
            selecting.
          </p>
        </div>
      )}
      <div className="matched-list">
        {matches.map((facility) => (
          <div key={facility.slug} className="selectable-result">
            <label className="compare-check">
              <input
                type="checkbox"
                checked={selected.includes(facility.slug)}
                onChange={() => toggle(facility.slug)}
                disabled={!selected.includes(facility.slug) && selected.length >= 3}
              />
              <span>Add {facility.name} to comparison</span>
            </label>
            <FacilityCard
              facility={facility}
              selected={selected.includes(facility.slug)}
              compareHref={`/compare?facilities=${selected.join(",")}`}
            />
          </div>
        ))}
      </div>
      {selected.length >= 2 && (
        <div className="floating-compare">
          <span>
            <strong>{selected.length} selected</strong>
            <small>Maximum 3 for side-by-side comparison</small>
          </span>
          <a className="button button--primary" href={`/compare?facilities=${selected.join(",")}`}>
            Compare selected
          </a>
        </div>
      )}
    </section>
  );
}
