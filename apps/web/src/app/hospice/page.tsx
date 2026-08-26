import { PublicInformationPage } from "@/components/public-information-page";

export const metadata = {
  title: "Hospice providers",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Hospice"
      title="National CMS Hospice research spine"
      intro="Hospice providers are a distinct CMS provider class. They are not nursing homes and not Home Health agencies. An office county is not proof of the full service area. Individual pages are not broadly indexed until identity, freshness, and labeling gates pass."
    >
      <p>
        Canonical identity is the CMS Hospice certification number (HOSPICE_CCN). Leading zeros
        are preserved.
      </p>
      <p>
        Hospice Item Set / claims quality measures stay separate from CAHPS Hospice Survey
        results. Survey scores are not clinical quality.
      </p>
    </PublicInformationPage>
  );
}
