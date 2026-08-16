import type { Metadata } from "next";
import { isRealProviderUiEnabled } from "@/server/care/feature-flags";
import { suggestProvidersByNames } from "@/server/care/repository";
import { parseShortlistNames } from "@/server/care/shortlist-contract";
import { RealShortlistWorkspace } from "./real-shortlist";
import { ShortlistTool } from "./shortlist-tool";
import { SyntheticDataNotice } from "@/components/evidence";

export const metadata: Metadata = {
  title: "Research a nursing-home shortlist",
  description:
    "Match a list of nursing homes to public CMS records and research them side by side.",
};
export const dynamic = "force-dynamic";
export default async function ShortlistPage({
  searchParams,
}: {
  searchParams: Promise<{ names?: string }>;
}) {
  if (!isRealProviderUiEnabled())
    return (
      <div className="page-shell narrow-shell">
        <SyntheticDataNotice />
        <ShortlistTool />
      </div>
    );
  const raw = (await searchParams).names ?? "";
  const { names, truncated } = parseShortlistNames(raw);
  const candidates = await suggestProvidersByNames(names);
  return (
    <div className="page-shell narrow-shell">
      <div className="real-data-notice">
        <strong>Controlled real CMS data review</strong>
        <span>Not publicly activated. Candidate matches use CMS Provider Information.</span>
      </div>
      <header className="page-intro">
        <p className="eyebrow">Crisis shortlist</p>
        <h1>Already have a list of facilities?</h1>
        <p className="lede">
          Paste the names you were given. We’ll help you match them to CMS records and research them
          side by side.
        </p>
      </header>
      <form className="search-panel" method="get">
        <label htmlFor="facility-names">
          <strong>One facility per line</strong>
          <span> Enter 2–10 names. Do not include patient or health information.</span>
        </label>
        <textarea id="facility-names" name="names" rows={7} defaultValue={raw} />
        <button className="button button--primary" type="submit">
          Find possible matches
        </button>
      </form>
      {truncated && (
        <p className="methodology-note" role="status">
          Only the first 10 facility names were used.
        </p>
      )}
      <RealShortlistWorkspace candidates={candidates} submittedNames={names} />
      <aside className="editorial-note">
        <strong>We don’t tell you which facility to choose.</strong>
        <p>
          Confirm ambiguous names yourself. Candidate matching never changes CMS provider identity.
        </p>
      </aside>
    </div>
  );
}
