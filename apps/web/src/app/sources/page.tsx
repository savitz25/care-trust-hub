import { PublicInformationPage } from "@/components/public-information-page";
import { publicInformationMetadata } from "@/config/metadata";
export const metadata = publicInformationMetadata("Data sources", "/sources");
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Sources"
      title="Published evidence used by SeniorTrustHub"
      intro="Nursing home research is grounded in CMS Provider Data Catalog and Medicare enrollment datasets. Assisted-living pages currently use official California, New York, and Texas regulator listings only."
    >
      <ul>
        <li>California CDSS Community Care Licensing RCFE listing</li>
        <li>New York State DOH Adult Care Facility / HFIS General Information</li>
        <li>Texas HHSC Assisted Living Facility directory</li>
        <li>Provider Information</li>
        <li>Inspection Dates and Health Deficiencies</li>
        <li>Penalties and enforcement</li>
        <li>Payroll Based Journal Daily Nurse Staffing</li>
        <li>Nursing home ownership, PECOS enrollment, and change-of-ownership records</li>
        <li>Nursing Home Chain Performance Measures</li>
      </ul>
      <p id="cms-release-dates">
        CMS nursing-home evidence family dates are the dataset release, and that release is the same
        for every certified home. Current release dates, SLA bands, and last ingest status are
        published once at <a href="/api/cms-source-freshness">/api/cms-source-freshness</a>. A
        nursing-home profile repeats a family date only when that date is not one of these national
        CMS releases. Home health and hospice profiles still show their own evidence-family dates.
      </p>
      <p>Different datasets do not share a fabricated common freshness date.</p>
    </PublicInformationPage>
  );
}
