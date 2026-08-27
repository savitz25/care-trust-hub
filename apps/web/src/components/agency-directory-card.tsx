import Link from "next/link";
import type { AgencySearchResult } from "@/server/care/agency-search";
import { CmsStarRating } from "./real-provider";

function availability(value: boolean, available: string, missing: string) {
  return value ? available : missing;
}

export function AgencyDirectoryCard({ provider }: { provider: AgencySearchResult }) {
  const location = [provider.city, provider.state, provider.zipCode].filter(Boolean).join(", ");
  const isHomeHealth = provider.providerClass === "home_health";
  return (
    <article className="facility-card agency-directory-card">
      <div className="facility-card__heading">
        <div>
          <p className="kicker">
            {isHomeHealth ? "CMS Home Health agency" : "CMS Hospice provider"}
          </p>
          <h2>
            <Link href={provider.href}>{provider.providerName}</Link>
          </h2>
          <p>
            Office: {location || "Office city and state not reported"}
            {isHomeHealth || provider.providerClass === "hospice"
              ? ". This is the directory office address, not a verified service area."
              : ""}
          </p>
          {provider.telephone ? <p>{provider.telephone}</p> : null}
        </div>
        <span className="ccn-label">
          {isHomeHealth ? "CMS Home Health CCN" : "CMS Hospice CCN"} {provider.ccn}
        </span>
      </div>
      <dl className="facility-card__metrics real-rating-grid">
        {isHomeHealth ? (
          <div>
            <dt>CMS Quality of Patient Care star</dt>
            <dd>
              <CmsStarRating value={provider.cmsQualityStar} />
            </dd>
          </div>
        ) : (
          <div>
            <dt>CMS overall star</dt>
            <dd>Hospice has no CMS overall star in this directory</dd>
          </div>
        )}
        <div>
          <dt>{isHomeHealth ? "CMS quality measures" : "Hospice quality measures"}</dt>
          <dd>
            {availability(
              provider.qualityAvailable,
              "Observations on file",
              "Not reported in this evidence layer",
            )}
          </dd>
        </div>
        <div>
          <dt>{isHomeHealth ? "HHCAHPS" : "CAHPS Hospice Survey"}</dt>
          <dd>
            {availability(
              provider.experienceAvailable,
              "Observations on file",
              "Not reported in this evidence layer",
            )}
          </dd>
        </div>
        <div>
          <dt>Ownership evidence</dt>
          <dd>
            {availability(
              provider.ownershipAvailable,
              "CURRENT OWNED_BY evidence on file",
              "Not reported in this evidence layer",
            )}
          </dd>
        </div>
        <div>
          <dt>CMS ZIP coverage records</dt>
          <dd>
            {availability(
              provider.serviceEvidenceAvailable,
              "On file — not the same as office ZIP",
              "Not reported in this evidence layer",
            )}
          </dd>
        </div>
      </dl>
      <div className="facility-card__actions">
        <Link className="button button--primary" href={provider.href}>
          View research
        </Link>
      </div>
    </article>
  );
}
