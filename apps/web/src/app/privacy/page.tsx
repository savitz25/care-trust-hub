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
      <h2>Analytics and cookies</h2>
      <p>
        We use PostHog for product analytics when a project key is present. Events can include pages
        viewed, clicks on links, buttons, and forms, device and browser info, and an anonymous id
        stored in local storage and a cookie. Email addresses, search text, sign-in fields, and
        sensitive URL parameters are removed before an event is sent. The event asks PostHog not to
        add a location from the network address. PostHog can still receive that address with the
        request, and whether it is stored is a PostHog project setting that this site does not
        change. This site does not set how long events are kept. Retention follows the PostHog
        project settings. Do Not Track, Global Privacy Control, or blocking cookies turns analytics
        off in this browser. A cookie banner is not shown.
      </p>
    </PublicInformationPage>
  );
}
