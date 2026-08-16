import { PublicInformationPage } from "@/components/public-information-page";
export const metadata = { title: "About SeniorTrustHub" };
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="About"
      title="Research senior care without being sold senior care"
      intro="SeniorTrustHub helps families investigate nursing homes using cited, published government evidence."
    >
      <h2>We cite. You decide.</h2>
      <p>
        We organize CMS records so families can review staffing, inspections, enforcement,
        ownership, and chain context without paid placement or a proprietary facility score.
      </p>
      <h2>A research tool</h2>
      <p>
        SeniorTrustHub does not provide medical advice. Discuss clinical and care decisions with
        qualified clinicians and care professionals.
      </p>
    </PublicInformationPage>
  );
}
