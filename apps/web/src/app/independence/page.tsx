import { PublicInformationPage } from "@/components/public-information-page";
export const metadata = { title: "Independence and no paid placement" };
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Independence"
      title="Facilities cannot pay to rank higher"
      intro="SeniorTrustHub separates public evidence and consumer research from commercial participation."
    >
      <p>
        We do not sell consumer contact information to facilities as leads. Claims, corrections, and
        factual responses are free. Claim status and future payment status cannot change search
        inclusion, order, evidence, comparison, shortlist, or What to Review.
      </p>
      <p>
        Provider-supplied context, when approved, is labeled separately and never replaces CMS
        evidence.
      </p>
    </PublicInformationPage>
  );
}
