import Link from "next/link";
import type {
  CareProviderDetail,
  CareProviderSearchResult,
  CareSourceDisclosure,
} from "@/server/care/types";
import { cmsRatingText, providerHref } from "@/server/care/consumer";
import { formatFreshnessLabels, formatMissingCmsValue } from "@/server/care/freshness";
import { ShortlistButton } from "./shortlist-button";
import { WorkspaceAddButton } from "./workspace-add-button";

export function CmsStarRating({ value }: { value: number | null }) {
  return (
    <span className={`cms-stars${value === null ? " cms-stars--missing" : ""}`}>
      <span className="sr-only">{cmsRatingText(value)}</span>
      {value === null ? (
        <span aria-hidden="true">Not reported</span>
      ) : (
        <>
          <span aria-hidden="true">
            {"★".repeat(value)}
            {"☆".repeat(5 - value)}
          </span>
          <small aria-hidden="true">{value}/5</small>
        </>
      )}
    </span>
  );
}

export function RealSourceDisclosure({ source }: { source: CareSourceDisclosure }) {
  const freshness = formatFreshnessLabels(source.freshness);
  return (
    <details className="source-disclosure real-source-disclosure">
      <summary>View source details</summary>
      <dl>
        <div>
          <dt>Source organization</dt>
          <dd>{source.sourceOrganization}</dd>
        </div>
        <div>
          <dt>Dataset</dt>
          <dd>{source.datasetName}</dd>
        </div>
        <div>
          <dt>CMS dataset ID</dt>
          <dd>{source.cmsDatasetIdentifier}</dd>
        </div>
        <div>
          <dt>CMS source updated</dt>
          <dd>{freshness.sourceUpdated.replace("CMS source updated ", "")}</dd>
        </div>
        <div>
          <dt>Retrieved by Ask Trust Hub</dt>
          <dd>{freshness.retrieved.replace("Retrieved by Ask Trust Hub ", "")}</dd>
        </div>
        <div>
          <dt>CMS provider ID</dt>
          <dd>{source.providerIdentifier}</dd>
        </div>
        <div>
          <dt>Source record</dt>
          <dd>{source.sourceRecordLocator}</dd>
        </div>
      </dl>
      <a href={source.officialSourceUrl} rel="noreferrer">
        View official CMS source
      </a>
    </details>
  );
}

export function RealProviderCard({
  provider,
  compareCcns = [],
  workspaceEnabled = false,
  hrefSuffix,
}: {
  provider: CareProviderSearchResult;
  compareCcns?: string[];
  workspaceEnabled?: boolean;
  hrefSuffix?: string;
}) {
  const freshness = formatFreshnessLabels(provider.source.freshness);
  const compare = [...new Set([provider.ccn, ...compareCcns])].slice(0, 3);
  const href = hrefSuffix ? `${providerHref(provider)}?${hrefSuffix}` : providerHref(provider);
  return (
    <article className="facility-card real-provider-card">
      <div className="facility-card__heading">
        <div>
          <p className="kicker">CMS-certified nursing home</p>
          <h2>
            <Link href={href}>{provider.providerName}</Link>
          </h2>
          <p>
            {[provider.location.city, provider.location.state, provider.location.zipCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          {provider.distanceMiles !== undefined && (
            <p>
              <strong>{provider.distanceMiles.toFixed(1)} miles away</strong>
            </p>
          )}
        </div>
        <span className="ccn-label">CMS ID {provider.ccn}</span>
      </div>
      <dl className="facility-card__metrics real-rating-grid">
        <div>
          <dt>CMS overall</dt>
          <dd>
            <CmsStarRating value={provider.ratings.overall} />
          </dd>
        </div>
        <div>
          <dt>Health inspections</dt>
          <dd>
            <CmsStarRating value={provider.ratings.healthInspection} />
          </dd>
        </div>
        <div>
          <dt>Staffing</dt>
          <dd>
            <CmsStarRating value={provider.ratings.staffing} />
          </dd>
        </div>
        <div>
          <dt>Quality measures</dt>
          <dd>
            <CmsStarRating value={provider.ratings.qualityMeasure} />
          </dd>
        </div>
        <div>
          <dt>Certified beds</dt>
          <dd>{formatMissingCmsValue(provider.certifiedBeds)}</dd>
        </div>
        <div>
          <dt>Ownership</dt>
          <dd>{provider.ownershipType ?? "Not reported in this CMS release"}</dd>
        </div>
      </dl>
      <div className="facility-card__actions">
        <Link className="button button--primary" href={href}>
          View research
        </Link>
        <ShortlistButton ccn={provider.ccn} />
        {workspaceEnabled ? <WorkspaceAddButton ccn={provider.ccn} compact /> : null}
        <Link className="button button--quiet" href={`/compare?real=${compare.join(",")}`}>
          Compare
        </Link>
      </div>
      <p className="source-inline">
        {freshness.sourceUpdated} · {provider.source.datasetName}
      </p>
    </article>
  );
}

export function ParticipationFacts({ provider }: { provider: CareProviderDetail }) {
  const answer = (value: boolean | null) =>
    value === null ? "Not reported in this CMS release" : value ? "Yes" : "No";
  return (
    <dl className="ownership-facts real-fact-grid">
      <div>
        <dt>CMS certified beds</dt>
        <dd>{formatMissingCmsValue(provider.certifiedBeds)}</dd>
      </div>
      <div>
        <dt>Ownership descriptor</dt>
        <dd>{provider.ownershipType ?? "Not reported in this CMS release"}</dd>
      </div>
      <div>
        <dt>Medicare participation</dt>
        <dd>{answer(provider.participatesMedicare)}</dd>
      </div>
      <div>
        <dt>Medicaid participation</dt>
        <dd>{answer(provider.participatesMedicaid)}</dd>
      </div>
    </dl>
  );
}
