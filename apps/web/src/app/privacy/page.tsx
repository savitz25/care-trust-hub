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
        Product analytics stays off unless a separate activation control is turned on. A project key
        alone does not start tracking, and this page is not permission to track visitors. When that
        control is on, we use PostHog for product analytics. Events can include pages viewed, clicks
        on links, buttons, and forms, device and browser info, and an anonymous id stored in local
        storage and a cookie. Email addresses, search text, sign-in fields, and sensitive URL
        parameters are removed before an event is sent. If a URL cannot be cleaned with certainty,
        its query string is dropped. Feature-flag and configuration requests are sanitized before
        they are sent, or they are not sent. The event asks PostHog not to add a location from the
        network address. PostHog can still receive that address with the request, and whether it is
        stored is a PostHog project setting that this site does not change. This site does not set
        how long events are kept. Retention follows the PostHog project settings. Do Not Track,
        Global Privacy Control, or blocking cookies turns analytics off in this browser. This
        disclosure is not a record of visitor consent. A cookie banner is not shown.
      </p>
    </PublicInformationPage>
  );
}
