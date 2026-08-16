import { PublicInformationPage } from "@/components/public-information-page";
export const metadata = { title: "Data sources" };
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Sources"
      title="Published evidence used by SeniorTrustHub"
      intro="Our nursing home research is grounded in CMS Provider Data Catalog and Medicare enrollment datasets."
    >
      <ul>
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
