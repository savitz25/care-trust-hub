import { formatVerifiedCheckedLabel, publicPhonesMatch } from "@care/domain";
import type { CarePublishedFacilityEnrichment, CareProviderDetail } from "@/server/care/types";

function telHref(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `tel:+1${digits.slice(-10)}`;
}

export function VerifiedPublicContact({
  provider,
  enrichment,
}: {
  provider: CareProviderDetail;
  enrichment: CarePublishedFacilityEnrichment;
}) {
  const cmsPhone = provider.telephone?.trim() || null;
  const showCmsPhone = Boolean(cmsPhone);
  const showEnrichedPhone =
    Boolean(enrichment.phone) && !publicPhonesMatch(enrichment.phone?.value ?? null, cmsPhone);
  const hasPublished =
    Boolean(enrichment.website) || showEnrichedPhone || Boolean(enrichment.publicAlias);
  if (!showCmsPhone && !hasPublished) return null;

  return (
    <section
      className="verified-public-contact"
      id="contact"
      aria-labelledby="public-contact-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Facility information</p>
        <h2 id="public-contact-title">Contact</h2>
        <p>
          CMS remains the primary federal record. Public website and additional contact details
          appear only when independently verified.
        </p>
      </div>
      <dl className="ownership-facts real-fact-grid verified-public-contact__facts">
        {showCmsPhone && cmsPhone && (
          <div>
            <dt>Phone</dt>
            <dd>
              {telHref(cmsPhone) ? <a href={telHref(cmsPhone)!}>{cmsPhone}</a> : cmsPhone}
              {enrichment.phoneMatchesCms && enrichment.phone ? (
                <small>{formatVerifiedCheckedLabel(enrichment.phone.resolvedAt)}</small>
              ) : (
                <small>CMS Provider Information</small>
              )}
            </dd>
          </div>
        )}
        {showEnrichedPhone && enrichment.phone && (
          <div>
            <dt>{showCmsPhone ? "Public contact" : "Phone"}</dt>
            <dd>
              {telHref(enrichment.phone.value) ? (
                <a href={telHref(enrichment.phone.value)!}>{enrichment.phone.value}</a>
              ) : (
                enrichment.phone.value
              )}
              <small>{formatVerifiedCheckedLabel(enrichment.phone.resolvedAt)}</small>
            </dd>
          </div>
        )}
        {enrichment.website && (
          <div>
            <dt>Official website</dt>
            <dd>
              <a href={enrichment.website.value} rel="noreferrer">
                Visit facility website
              </a>
              <small>{formatVerifiedCheckedLabel(enrichment.website.resolvedAt)}</small>
            </dd>
          </div>
        )}
        {enrichment.publicAlias && (
          <div>
            <dt>Also known publicly as</dt>
            <dd>
              {enrichment.publicAlias.value}
              <small>{formatVerifiedCheckedLabel(enrichment.publicAlias.resolvedAt)}</small>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
