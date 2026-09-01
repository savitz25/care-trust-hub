import type { Metadata } from "next";
import { SearchExperience } from "./search-experience";
import { SyntheticDataNotice } from "@/components/evidence";
import { isRealProviderUiEnabled } from "@/server/care/feature-flags";
import { parseProviderClass } from "@/server/care/search-contract";
import { RealSearch } from "./real-search";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const providerClass = parseProviderClass(
    typeof params.class === "string" ? params.class : undefined,
  );
  const titles = {
    nursing_home: "Find nursing homes through CMS evidence",
    home_health: "Find Home Health agencies through CMS evidence",
    hospice: "Find Hospice providers through CMS evidence",
  } as const;
  return isRealProviderUiEnabled()
    ? {
        title: titles[providerClass],
        description: "Search current CMS directories. Search result URLs are not indexed.",
        robots: { index: false, follow: false },
      }
    : {
        title: "Find care",
        description: "Explore fictional facilities through transparent evidence dimensions.",
        robots: { index: false, follow: false },
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
