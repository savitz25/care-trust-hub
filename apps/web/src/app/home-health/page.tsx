import Link from "next/link";
import { PublicInformationPage } from "@/components/public-information-page";

export const metadata = {
  title: "Home Health agencies",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Home Health"
      title="National CMS Home Health research"
      intro="Home Health agencies are a distinct CMS provider class. They are not nursing homes. SeniorTrustHub currently lists 12,460 current CMS Home Health agencies. An agency office address is not the same as CMS ZIP coverage evidence."
    >
      <form className="search-panel landing-search" method="get" action="/search">
        <input type="hidden" name="search" value="1" />
        <input type="hidden" name="class" value="home_health" />
        <div className="field">
          <label htmlFor="hh-q">Provider name or CMS Home Health CCN</label>
          <input id="hh-q" name="q" />
        </div>
        <div className="filter-row">
          <div className="field">
            <label htmlFor="hh-city">Office city</label>
            <input id="hh-city" name="city" />
          </div>
          <div className="field">
            <label htmlFor="hh-state">Office state</label>
            <input id="hh-state" name="state" maxLength={2} />
          </div>
        </div>
        <button className="button button--primary" type="submit">
          Search current Home Health agencies
        </button>
      </form>
      <p>
        Canonical identity is the CMS Home Health certification number (HOME_HEALTH_CCN), not
        provider name and not NPI.
      </p>
      <p>
        CMS Quality of Patient Care stars stay separate from HHCAHPS. A missing or suppressed
        measure is not zero. Profiles remain research pages; internal directory search is not the
        same as external search-engine indexation.
      </p>
      <p>
        <Link className="text-link" href="/search?class=home_health">
          Open Home Health directory search <span aria-hidden="true">→</span>
        </Link>
      </p>
    </PublicInformationPage>
  );
}
