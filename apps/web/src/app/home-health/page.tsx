import { PublicInformationPage } from "@/components/public-information-page";

export const metadata = {
  title: "Home Health agencies",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Home Health"
      title="National CMS Home Health research spine"
      intro="Home Health agencies are a distinct CMS provider class. They are not nursing homes. An agency office address is not the same as the ZIP codes CMS lists as coverage evidence. Individual pages are not broadly indexed until identity, freshness, and labeling gates pass."
    >
      <p>
        Canonical identity is the CMS Home Health certification number (HOME_HEALTH_CCN), not
        provider name and not NPI.
      </p>
      <p>
        Quality-of-patient-care measures stay separate from HHCAHPS patient-experience scores. A
        missing or suppressed measure is not zero.
      </p>
    </PublicInformationPage>
  );
}
