import Link from "next/link";
import type { CareProviderDetail, CareRegulatoryIntelligence } from "@/server/care/types";
import { CMS_RATING_EXPLANATIONS, factualRatingObservations } from "@/server/care/consumer";
import { formatFreshnessLabels } from "@/server/care/freshness";
import { CmsStarRating, ParticipationFacts, RealSourceDisclosure } from "./real-provider";
import { PrintButton } from "./print-button";
import { RegulatoryIntelligence } from "./regulatory-intelligence";

const additionalLayers = [
  "Inspection and deficiency history",
  "Penalties and enforcement",
  "Detailed staffing trends",
  "Ownership intelligence",
  "Chain performance",
  "Facility history",
];

export function RealProviderDetail({
  provider,
  regulatory,
}: {
  provider: CareProviderDetail;
  regulatory?: CareRegulatoryIntelligence;
}) {
  const freshness = formatFreshnessLabels(provider.source.freshness);
  const ratings = [
    ["CMS overall rating", provider.ratings.overall, CMS_RATING_EXPLANATIONS.overall],
    [
      "Health inspection rating",
      provider.ratings.healthInspection,
      CMS_RATING_EXPLANATIONS.healthInspection,
    ],
    ["Staffing rating", provider.ratings.staffing, CMS_RATING_EXPLANATIONS.staffing],
    [
      "Quality-measure rating",
      provider.ratings.qualityMeasure,
      CMS_RATING_EXPLANATIONS.qualityMeasure,
    ],
  ] as const;

  return (
    <div className="investigation-page real-investigation-page">
      <div className="page-shell">
        <div className="real-data-notice" role="note">
          <strong>Controlled real CMS data review</strong>
          <span>
            Not publicly activated. This page contains verified Provider Information fields only.
          </span>
        </div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/search">Search</Link>
          <span aria-hidden="true">/</span>
          <span>{provider.providerName}</span>
        </nav>
        <header className="facility-hero">
          <div>
            <h1>{provider.providerName}</h1>
            <p className="lede">
              {[provider.location.city, provider.location.state].filter(Boolean).join(", ")}
            </p>
            <div className="facility-hero__meta">
              <span>CMS provider ID {provider.ccn}</span>
              <span>{freshness.sourceUpdated}</span>
            </div>
          </div>
          <div className="facility-hero__actions">
            <Link className="button button--primary" href={`/compare?real=${provider.ccn}`}>
              Compare
            </Link>
            <Link className="button button--secondary" href="/shortlist">
              Save to shortlist
            </Link>
            <PrintButton />
          </div>
        </header>

        <section className="provider-overview" id="overview" aria-labelledby="cms-overview-title">
          <div className="section-heading">
            <p className="eyebrow">CMS overview</p>
            <h2 className="sr-only" id="cms-overview-title">
              CMS rating overview
            </h2>
          </div>
          <div className="provider-overview__ratings">
            {ratings.map(([label, value]) => (
              <div key={label}>
                <h3>{label.replace(" rating", "")}</h3>
                <CmsStarRating value={value} />
              </div>
            ))}
          </div>
          <p className="provider-overview__note">
            No proprietary TrustHub score. These ratings are published separately by CMS.
          </p>
          <details className="provider-overview__explanations">
            <summary>How CMS describes these ratings</summary>
            <dl>
              {ratings.map(([label, , explanation]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{explanation}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>

        <section className="provider-facts-strip" aria-label="Facility facts">
          <ParticipationFacts provider={provider} />
        </section>

        <nav className="provider-section-nav" aria-label="Facility record sections">
          <a href="#overview">Overview</a>
          {regulatory && <a href="#inspections">Inspections</a>}
          {regulatory && <a href="#penalties">Penalties</a>}
          {regulatory && <a href="#history">History</a>}
          <a href="#sources">Sources</a>
        </nav>

        {regulatory && <RegulatoryIntelligence intelligence={regulatory} />}

        <section className="profile-section" aria-labelledby="verify-title">
          <div className="section-heading">
            <p className="eyebrow">What we can verify today</p>
            <h2 id="verify-title">Current Provider Information facts</h2>
            <p>
              These measures come from the current successfully ingested CMS Nursing Home Provider
              Information release.
            </p>
          </div>
          <ul className="factual-observations">
            {factualRatingObservations(provider.ratings).map((observation) => (
              <li key={observation}>{observation}</li>
            ))}
          </ul>
        </section>

        <section
          className="profile-section profile-section--tint"
          aria-labelledby="future-sources-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Coming from additional public sources</p>
            <h2 id="future-sources-title">Evidence layers still being integrated</h2>
            <p>
              These areas require separate authoritative CMS datasets. No findings are shown until
              those sources are ingested and reviewed.
            </p>
          </div>
          <ul className="future-source-list">
            {additionalLayers
              .filter(
                (layer) =>
                  !regulatory ||
                  !["Inspection and deficiency history", "Penalties and enforcement"].includes(
                    layer,
                  ),
              )
              .map((layer) => (
                <li key={layer}>{layer}</li>
              ))}
          </ul>
        </section>

        <section
          className="profile-section source-register"
          id="sources"
          aria-labelledby="real-source-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Source register</p>
            <h2 id="real-source-title">See where this record came from</h2>
          </div>
          <RealSourceDisclosure source={provider.source} />
          <p className="independence-statement">
            No paid placements. Facilities cannot pay to rank higher. We cite. You decide.
          </p>
        </section>
      </div>
    </div>
  );
}
