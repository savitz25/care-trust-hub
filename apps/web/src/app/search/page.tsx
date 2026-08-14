import type { Metadata } from "next";
import { SearchExperience } from "./search-experience";
import { SyntheticDataNotice } from "@/components/evidence";
import { isRealProviderUiEnabled } from "@/server/care/feature-flags";
import { RealSearch } from "./real-search";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return isRealProviderUiEnabled()
    ? {
        title: "Find nursing homes through CMS evidence",
        description: "Search current CMS Nursing Home Provider Information fields.",
        robots: { index: false, follow: false },
      }
    : {
        title: "Find care",
        description: "Explore fictional facilities through transparent evidence dimensions.",
      };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isRealProviderUiEnabled()) {
    return (
      <div className="page-shell">
        <RealSearch searchParams={await searchParams} />
      </div>
    );
  }
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
