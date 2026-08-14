import Link from "next/link";
import type { CareProviderDetail } from "@/server/care/types";
import { CMS_RATING_EXPLANATIONS, factualRatingObservations } from "@/server/care/consumer";
import { formatFreshnessLabels } from "@/server/care/freshness";
import { CmsStarRating, ParticipationFacts, RealSourceDisclosure } from "./real-provider";
import { PrintButton } from "./print-button";

const additionalLayers = [
  "Inspection and deficiency history",
  "Penalties and enforcement",
  "Detailed staffing trends",
  "Ownership intelligence",
  "Chain performance",
  "Facility history",
];

export function RealProviderDetail({ provider }: { provider: CareProviderDetail }) {
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
            <p className="eyebrow">CMS provider record</p>
            <h1>{provider.providerName}</h1>
            <p className="lede">
              {[
                provider.location.address,
                provider.location.city,
                provider.location.state,
                provider.location.zipCode,
              ]
                .filter(Boolean)
                .join(", ")}
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
            <PrintButton />
          </div>
        </header>

        <section className="profile-section" aria-labelledby="facts-title">
          <div className="section-heading">
            <p className="eyebrow">Facility facts</p>
            <h2 id="facts-title">What CMS identifies in this release</h2>
          </div>
          <ParticipationFacts provider={provider} />
        </section>

        <section
          className="profile-section profile-section--tint"
          aria-labelledby="cms-evidence-title"
        >
          <div className="section-heading">
            <p className="eyebrow">CMS evidence</p>
            <h2 id="cms-evidence-title">Four published dimensions, not a proprietary score</h2>
            <p>Each value below is reported by CMS and remains separate.</p>
          </div>
          <div className="dimension-grid real-dimension-grid">
            {ratings.map(([label, value, explanation]) => (
              <article className="dimension-card real-dimension-card" key={label}>
                <div className="dimension-card__top">
                  <h3>{label}</h3>
                  <CmsStarRating value={value} />
                </div>
                <p>{explanation}</p>
                <small>{freshness.sourceUpdated}</small>
              </article>
            ))}
          </div>
          <RealSourceDisclosure source={provider.source} />
        </section>

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
            {additionalLayers.map((layer) => (
              <li key={layer}>{layer}</li>
            ))}
          </ul>
        </section>

        <section className="profile-section source-register" aria-labelledby="real-source-title">
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
