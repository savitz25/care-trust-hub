import type { PublicProviderBusinessContact } from "@care/domain";

function recordedLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const recorded = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `Recorded ${recorded}`;
}

function telHref(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `tel:+1${digits.slice(-10)}`;
}

export function ProviderBusinessContact({
  contact,
}: {
  contact: PublicProviderBusinessContact | null | undefined;
}) {
  if (!contact) return null;
  const recorded = recordedLabel(contact.verifiedAt ?? contact.updatedAt);
  const sourceUrl = contact.sourceUrls.find((url) => url !== contact.websiteUrl) ?? null;
  const phoneHref = contact.phoneOverride ? telHref(contact.phoneOverride) : null;
  return (
    <section
      className="provider-business-contact"
      id="business-contact"
      aria-labelledby="business-contact-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Business contact</p>
        <h2 id="business-contact-title">Website and email</h2>
        <p>
          Recorded business contact. Separate from CMS and state licensing records. Not a rating.
        </p>
        {recorded ? <p>{recorded}</p> : null}
      </div>
      <dl className="ownership-facts provider-business-contact__facts">
        {contact.websiteUrl ? (
          <div>
            <dt>Business website</dt>
            <dd>
              <a href={contact.websiteUrl} target="_blank" rel="nofollow noopener noreferrer">
                Visit business website
              </a>
            </dd>
          </div>
        ) : null}
        {contact.email ? (
          <div>
            <dt>Business email</dt>
            <dd>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </dd>
          </div>
        ) : null}
        {contact.phoneOverride ? (
          <div>
            <dt>Business phone</dt>
            <dd>
              {phoneHref ? <a href={phoneHref}>{contact.phoneOverride}</a> : contact.phoneOverride}
            </dd>
          </div>
        ) : null}
        {sourceUrl ? (
          <div>
            <dt>Contact source</dt>
            <dd>
              <a href={sourceUrl} target="_blank" rel="nofollow noopener noreferrer">
                View contact source
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
