import { PublicInformationPage } from "@/components/public-information-page";
import { publicInformationMetadata } from "@/config/metadata";

export const metadata = publicInformationMetadata("Privacy", "/privacy");
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Privacy"
      title="Collect less, protect what is submitted"
      intro="Public research does not require an account and shortlist state contains only public facility identifiers."
    >
      <p>
        Trust requests collect contact information needed for review. Submitter email, phone,
        evidence links, and internal notes are private operational data and are not shown on public
        profiles.
      </p>
      <p>
        Do not submit resident names, diagnoses, medical records, or other private health
        information.
      </p>
    </PublicInformationPage>
  );
}
