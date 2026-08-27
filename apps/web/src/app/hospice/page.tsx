import Link from "next/link";
import { PublicInformationPage } from "@/components/public-information-page";

export const metadata = {
  title: "Hospice providers",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Hospice"
      title="National CMS Hospice research"
      intro="Hospice providers are a distinct CMS provider class. They are not nursing homes and not Home Health agencies. SeniorTrustHub currently lists 6,669 current CMS Hospice General Information providers. 242 additional typed identities appear only in quality files; they are not in this current directory."
    >
      <form className="search-panel landing-search" method="get" action="/search">
        <input type="hidden" name="search" value="1" />
        <input type="hidden" name="class" value="hospice" />
        <div className="field">
          <label htmlFor="hos-q">Provider name or CMS Hospice CCN</label>
          <input id="hos-q" name="q" />
        </div>
        <div className="filter-row">
          <div className="field">
            <label htmlFor="hos-city">Office city</label>
            <input id="hos-city" name="city" />
          </div>
          <div className="field">
            <label htmlFor="hos-state">Office state</label>
            <input id="hos-state" name="state" maxLength={2} />
          </div>
        </div>
        <button className="button button--primary" type="submit">
          Search current Hospice providers
        </button>
      </form>
      <p>
        Canonical identity is the CMS Hospice certification number (HOSPICE_CCN). Leading zeros are
        preserved.
      </p>
      <p>
        Hospice quality measures stay separate from CAHPS Hospice Survey results. Survey scores are
        not clinical quality. Hospice has no CMS overall star in this directory. Internal directory
        search is not the same as external search-engine indexation.
      </p>
      <p>
        <Link className="text-link" href="/search?class=hospice">
          Open Hospice directory search <span aria-hidden="true">→</span>
        </Link>
      </p>
    </PublicInformationPage>
  );
}
