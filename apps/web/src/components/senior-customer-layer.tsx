import { safeBusinessWebsite } from "@/server/customer-integration/security";
import type { PublicBusinessProfile, PublicReplies } from "@/server/customer-integration/public";
export function SeniorCustomerLayer({
  providerClass,
  ccn,
  enabled,
  profile,
  replies,
}: {
  providerClass: string;
  ccn: string;
  enabled: boolean;
  profile: PublicBusinessProfile | null;
  replies: PublicReplies | null;
}) {
  const website = safeBusinessWebsite(profile?.fields.website);
  return (
    <div className="page-shell" style={{ paddingBlock: "0 3rem" }}>
      {profile ? (
        <section className="card">
          <p className="eyebrow">Managed profile</p>
          <h2>Business-supplied information</h2>
          <p>
            Control verified, not endorsement. Official SeniorTrustHub evidence remains unchanged.
          </p>
          {profile.fields.description ? <p>{profile.fields.description}</p> : null}
          {website ? (
            <p>
              <a href={website} target="_blank" rel="nofollow noopener noreferrer">
                Visit website
              </a>
            </p>
          ) : null}
          {profile.fields.public_phone ? (
            <p>Business phone: {profile.fields.public_phone}</p>
          ) : null}
          {profile.fields.public_email ? (
            <p>Business email: {profile.fields.public_email}</p>
          ) : null}
          {profile.fields.contact_context ? <p>{profile.fields.contact_context}</p> : null}
          <small>{profile.freshness.label}</small>
        </section>
      ) : null}
      {replies?.replies.length ? (
        <section className="card">
          <p className="eyebrow">Business response</p>
          <h2>Response from the business</h2>
          {replies.replies.map((r) => (
            <p key={r.id}>{r.body}</p>
          ))}
        </section>
      ) : null}
      <aside className="card">
        <h2>{profile ? "Managed by the business" : "Is this your provider?"}</h2>
        {enabled ? (
          <a
            className="button-link"
            href={
              profile
                ? "https://www.asktrusthub.com/manage"
                : `/api/claim/handoff/${providerClass}/${encodeURIComponent(ccn)}`
            }
          >
            {profile ? "Manage on AskTrustHub" : "Claim this profile"}
          </a>
        ) : null}
        <p>
          {enabled
            ? "Manage business-supplied information through AskTrustHub."
            : "Profile management is not currently available."}
        </p>
      </aside>
    </div>
  );
}
