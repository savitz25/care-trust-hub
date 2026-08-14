"use client";

import { useMemo, useState } from "react";
import { syntheticFacilities } from "@care/domain";
import { FacilityCard } from "@/components/facility-card";

export function SearchExperience() {
  const [location, setLocation] = useState("Clearwater Junction, IN");
  const [distance, setDistance] = useState("25");
  const [careType, setCareType] = useState("all");
  const [strongStaffing, setStrongStaffing] = useState(false);
  const [noPenalties, setNoPenalties] = useState(false);
  const filtered = useMemo(
    () =>
      syntheticFacilities.filter(
        (facility) =>
          facility.distance <= Number(distance) &&
          (careType === "all" || facility.careType.startsWith(careType)) &&
          (!strongStaffing || (facility.staffingStars ?? 0) >= 4) &&
          (!noPenalties || facility.penalties.length === 0),
      ),
    [distance, careType, strongStaffing, noPenalties],
  );
  return (
    <div className="search-layout">
      <aside className="search-panel" aria-label="Search filters">
        <div className="field">
          <label htmlFor="location">ZIP, city, or county</label>
          <input
            id="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>
        <div className="filter-row">
          <div className="field">
            <label htmlFor="care-type">Care type</label>
            <select
              id="care-type"
              value={careType}
              onChange={(event) => setCareType(event.target.value)}
            >
              <option value="all">All nursing care</option>
              <option value="Nursing">Nursing home</option>
              <option value="Skilled">Skilled rehabilitation</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="distance">Distance</label>
            <select
              id="distance"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
            >
              <option value="10">10 miles</option>
              <option value="15">15 miles</option>
              <option value="25">25 miles</option>
            </select>
          </div>
        </div>
        <fieldset>
          <legend>
            Evidence filters <span>Optional</span>
          </legend>
          <label className="check-row">
            <input
              type="checkbox"
              checked={strongStaffing}
              onChange={(event) => setStrongStaffing(event.target.checked)}
            />
            Staffing rated 4 or 5
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={noPenalties}
              onChange={(event) => setNoPenalties(event.target.checked)}
            />
            No recent penalties shown
          </label>
        </fieldset>
        <p className="filter-note">Filters use synthetic demonstration fields only.</p>
      </aside>
      <section className="results" aria-labelledby="results-title">
        <div className="results__header">
          <div>
            <p className="eyebrow">Synthetic results near</p>
            <h2 id="results-title">{location || "your location"}</h2>
          </div>
          <strong aria-live="polite">{filtered.length} results</strong>
        </div>
        {filtered.map((facility) => (
          <FacilityCard
            key={facility.slug}
            facility={facility}
            compareHref={`/compare?facilities=${facility.slug},harbor-pines`}
          />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <h3>No fictional records match these filters</h3>
            <p>Try a wider distance or remove an evidence filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}
