import { PublicInformationPage } from "@/components/public-information-page";
export const metadata = { title: "Terms of use" };
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Terms"
      title="Terms of use"
      intro="SeniorTrustHub is an evidence research tool, not a provider recommendation, referral service, or substitute for professional advice."
    >
      <p>
        Source agencies retain responsibility for their published records. SeniorTrustHub presents
        cited evidence and transparent calculations but does not guarantee that every source is
        complete or current at all times.
      </p>
      <p>
        Use this research with facility visits, direct questions, and advice from qualified care and
        clinical professionals.
      </p>
    </PublicInformationPage>
  );
}
