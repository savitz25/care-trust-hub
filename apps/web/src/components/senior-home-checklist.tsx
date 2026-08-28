"use client";

import { useEffect, useId, useState } from "react";

const AREAS = [
  { id: "rating", label: "Review the published CMS rating for that class, if one exists" },
  { id: "inspection", label: "Review inspection or survey history where a file exists" },
  { id: "ownership", label: "Review ownership and affiliated organizations" },
  { id: "staffing", label: "Review staffing evidence for Nursing Homes when published" },
  { id: "state", label: "Check state regulatory history where a state page exists" },
  { id: "compare", label: "Compare more than one provider before deciding" },
] as const;

const STORAGE_KEY = "senior-home-research-checklist-v1";

export function SeniorHomeChecklist() {
  const labelId = useId();
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw) as string[]);
    } catch {
      setChecked([]);
    }
  }, []);

  function toggle(id: string) {
    setChecked((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const done = AREAS.filter((area) => checked.includes(area.id)).length;
  return (
    <div className="intel-checklist">
      <p id={labelId} className="intel-checklist__status">
        You&apos;ve reviewed {done} of {AREAS.length} evidence areas. This tracks your research process,
        not a provider&apos;s safety or quality.
      </p>
      <ul className="intel-checklist__list" aria-labelledby={labelId}>
        {AREAS.map((area) => (
          <li key={area.id}>
            <label>
              <input
                type="checkbox"
                checked={checked.includes(area.id)}
                onChange={() => toggle(area.id)}
              />
              <span>{area.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
