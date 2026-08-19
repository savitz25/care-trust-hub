import { PublicInformationPage } from "@/components/public-information-page";
export const metadata = { title: "Data sources" };
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
      <p>
        Each facility and chain profile shows dataset-specific release and freshness details.
        Different datasets do not share a fabricated common freshness date.
      </p>
    </PublicInformationPage>
  );
}
