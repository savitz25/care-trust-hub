"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { providerHref } from "@/server/care/consumer";
import type { CareRelatedFacility } from "@/server/care/types";

function stars(value: number | null): string {
  if (value == null) return "Not reported";
  return `${value} of 5`;
}

export function OrganizationRelatedFacilities({
  facilities,
}: {
  facilities: CareRelatedFacility[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "state" | "rating">("name");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = facilities.filter((facility) => {
      if (!needle) return true;
      return [facility.providerName, facility.city, facility.state, facility.ccn]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return [...filtered].sort((left, right) => {
      if (sort === "state") {
        return (
          left.state.localeCompare(right.state) ||
          left.providerName.localeCompare(right.providerName)
        );
      }
      if (sort === "rating") {
        return (right.overallRating ?? -1) - (left.overallRating ?? -1);
      }
      return left.providerName.localeCompare(right.providerName);
    });
  }, [facilities, query, sort]);

  return (
    <div className="organization-related">
      <div className="organization-related__controls">
        <label>
          Search facilities
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, city, state, or CCN"
          />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="name">Name</option>
            <option value="state">State</option>
            <option value="rating">CMS overall rating</option>
          </select>
        </label>
      </div>
      <p>
        Showing {visible.length} of {facilities.length} currently connected facilities. This list is
        not a ranking.
      </p>
      <ul>
        {visible.map((facility) => (
          <li key={facility.ccn}>
            <Link href={providerHref(facility)}>{facility.providerName}</Link>
            <span>
              {[facility.city, facility.state].filter(Boolean).join(", ")} · CMS overall{" "}
              {stars(facility.overallRating)} · staffing {stars(facility.staffingRating)}
              {facility.hadPenalty ? " · CMS penalty recorded" : ""} · {facility.relationshipType}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
