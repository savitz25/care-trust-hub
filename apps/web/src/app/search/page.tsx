import type { Metadata } from "next";
import { SearchExperience } from "./search-experience";
import { SyntheticDataNotice } from "@/components/evidence";

export const metadata: Metadata = {
  title: "Find care",
  description: "Explore fictional facilities through transparent evidence dimensions.",
};

export default function SearchPage() {
  return (
    <div className="page-shell">
      <SyntheticDataNotice />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Facility research</p>
        <h1>Find care through evidence, not placement.</h1>
        <p className="lede">
          Search a fictional location, then review staffing, inspections, enforcement, ownership,
          and change over time.
        </p>
      </header>
      <SearchExperience />
    </div>
  );
}
