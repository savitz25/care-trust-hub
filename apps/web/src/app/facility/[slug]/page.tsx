import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getEvidenceDimensions,
  getFacility,
  getQuestionsToAsk,
  getStandoutObservations,
  syntheticFacilities,
  type Facility,
} from "@care/domain";
import {
  EvidenceBadge,
  EvidenceDimensionCard,
  HistoryTimeline,
  SourceDisclosure,
  StarValue,
  SyntheticDataNotice,
  TrendIndicator,
} from "@/components/evidence";
import { PrintButton } from "@/components/print-button";
import { SHARE_HUB } from "@/config/share-hub";

export function generateStaticParams() {
  return syntheticFacilities.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const facility = getFacility((await params).slug);
  if (!facility) return { title: "Facility not found" };
  const title = `${facility.name} — synthetic investigation`;
  const description = `Review fictional staffing, inspection, enforcement, ownership, and historical evidence for ${facility.name}.`;
  const ogImage = {
    url: `${SHARE_HUB.origin}${SHARE_HUB.ogImagePath}`,
    width: SHARE_HUB.ogWidth,
    height: SHARE_HUB.ogHeight,
    alt: SHARE_HUB.ogAlt,
  };
  return {
    title,
    description,
    openGraph: {
      title,
      description: "A fictional evidence-led care research demonstration.",
      images: [ogImage],
    },
    twitter: {
      card: SHARE_HUB.twitterCard,
      title,
      description: "A fictional evidence-led care research demonstration.",
      images: [{ url: ogImage.url, alt: SHARE_HUB.ogAlt }],
    },
  };
}

const benchmarks = {
  rnHours: 0.61,
  lpnHours: 0.78,
  cnaHours: 2.23,
  totalNurseHours: 3.62,
  weekendNurseHours: 3.2,
} as const;

function StaffingRow({
  label,
  value,
  benchmark,
  max = 5,
}: {
  label: string;
  value: number | null;
  benchmark: number;
  max?: number;
}) {
  if (value === null)
    return (
      <div className="staff-row">
        <div>
          <strong>{label}</strong>
          <span>Not enough data</span>
        </div>
      </div>
    );
  return (
    <div className="staff-row">
      <div className="staff-row__label">
        <strong>{label}</strong>
        <span>
          {value.toFixed(2)} facility · {benchmark.toFixed(2)} state benchmark
        </span>
      </div>
      <div
        className="bar-track"
        role="img"
        aria-label={`${label}: facility ${value.toFixed(2)}, synthetic state benchmark ${benchmark.toFixed(2)}`}
      >
        <span
          className="bar bar--facility"
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
        <span
          className="benchmark-line"
          style={{ left: `${(benchmark / max) * 100}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function OwnershipGraph({ facility }: { facility: Facility }) {
  return (
    <div className="ownership-layout">
      <div className="ownership-graph" aria-label="Ownership relationship">
        <div>
          <span>Operating entity</span>
          <strong>{facility.operatingEntity}</strong>
        </div>
        <span className="ownership-arrow" aria-hidden="true">
          ↓
        </span>
        <div>
          <span>Parent or chain</span>
          <strong>{facility.chainName ?? "No parent chain shown"}</strong>
        </div>
        {facility.chainFacilityCount && (
          <>
            <span className="ownership-arrow" aria-hidden="true">
              ↓
            </span>
            <div>
              <span>Connected facilities</span>
              <strong>{facility.chainFacilityCount} fictional facilities</strong>
            </div>
          </>
        )}
      </div>
      <dl className="ownership-facts">
        <div>
          <dt>Ownership type</dt>
          <dd>{facility.ownershipType}</dd>
        </div>
        <div>
          <dt>Last ownership change</dt>
          <dd>{facility.ownershipChangeDate ?? "None in demo period"}</dd>
        </div>
        <div>
          <dt>This facility</dt>
          <dd>{facility.cmsOverall ?? "—"} overall stars</dd>
        </div>
        <div>
          <dt>Chain portfolio</dt>
          <dd>{facility.chainAverageStars?.toFixed(1) ?? "Not applicable"}</dd>
        </div>
        <div>
          <dt>State comparison</dt>
          <dd>3.2 synthetic average</dd>
        </div>
      </dl>
    </div>
  );
}

export default async function FacilityPage({ params }: { params: Promise<{ slug: string }> }) {
  const facility = getFacility((await params).slug);
  if (!facility) notFound();
  const dimensions = getEvidenceDimensions(facility);
  const observations = getStandoutObservations(facility);
  const questions = getQuestionsToAsk(facility);
  const comparisonSlugs = [
    facility.slug,
    ...["harbor-pines", "meadowridge", "willow-harbor"].filter((slug) => slug !== facility.slug),
  ].slice(0, 3);
  return (
    <div className="investigation-page">
      <div className="page-shell">
        <SyntheticDataNotice />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <a href="/search">Search</a>
          <span aria-hidden="true">/</span>
          <span>{facility.name}</span>
        </nav>
        <header className="facility-hero">
          <div>
            <p className="eyebrow">Facility investigation</p>
            <h1>{facility.name}</h1>
            <p className="lede">
              {facility.city}, {facility.state} · {facility.careType}
            </p>
            <div className="facility-hero__meta">
              <TrendIndicator trend={facility.trend} />
              <span>Mock source observed {facility.source.observed}</span>
            </div>
          </div>
          <div className="facility-hero__actions">
            <a
              className="button button--primary"
              href={`/compare?facilities=${comparisonSlugs.join(",")}`}
            >
              Compare
            </a>
            <PrintButton />
          </div>
        </header>
        <section className="profile-section" aria-labelledby="snapshot-title">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Evidence snapshot</p>
              <h2 id="snapshot-title">Seven dimensions, not one hidden score</h2>
            </div>
            <details className="what-means">
              <summary>What does this mean?</summary>
              <p>
                Each dimension comes from a separate synthetic field. No proprietary score combines
                or reweights them.
              </p>
            </details>
          </div>
          <div className="dimension-grid">
            {dimensions.map((dimension) => (
              <EvidenceDimensionCard key={dimension.key} dimension={dimension} />
            ))}
          </div>
          <SourceDisclosure source={facility.source} />
        </section>
        <section
          className="profile-section profile-section--tint"
          aria-labelledby="standouts-title"
        >
          <div className="section-heading">
            <p className="eyebrow">What stands out</p>
            <h2 id="standouts-title">Start with the evidence that raises questions</h2>
          </div>
          <div className="standout-list">
            {observations.map((observation) => (
              <article key={`${observation.category}-${observation.headline}`} className="standout">
                <div>
                  <EvidenceBadge signal={observation.signal}>{observation.category}</EvidenceBadge>
                  <h3>{observation.headline}</h3>
                  <p>{observation.detail}</p>
                </div>
                <details>
                  <summary>Why this matters</summary>
                  <p>{observation.why}</p>
                  <a href="#sources">See evidence source</a>
                </details>
              </article>
            ))}
          </div>
        </section>
        <section className="profile-section" aria-labelledby="ownership-title">
          <div className="section-heading">
            <p className="eyebrow">Ownership intelligence</p>
            <h2 id="ownership-title">Who actually owns this facility?</h2>
            <p>
              Ownership structure can add context, but it does not determine the quality of every
              connected facility.
            </p>
          </div>
          <OwnershipGraph facility={facility} />
          <SourceDisclosure source={facility.source} />
        </section>
        <section
          className="profile-section profile-section--timeline"
          id="history"
          aria-labelledby="history-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Facility history</p>
            <h2 id="history-title">What changed—and when</h2>
            <p>
              Current ratings can hide recent movement. This timeline keeps each synthetic event
              attached to its date.
            </p>
          </div>
          <HistoryTimeline events={facility.history} />
        </section>
        <section className="profile-section" aria-labelledby="staffing-title">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">Staffing intelligence</p>
              <h2 id="staffing-title">Time with residents, shown in context</h2>
            </div>
            <StarValue value={facility.staffingStars} />
          </div>
          <div className="staffing-grid">
            <div className="staff-chart">
              <div className="chart-legend">
                <span>
                  <i className="legend-facility" />
                  This facility
                </span>
                <span>
                  <i className="legend-benchmark" />
                  Synthetic state benchmark
                </span>
              </div>
              <StaffingRow
                label="RN hours / resident / day"
                value={facility.rnHours}
                benchmark={benchmarks.rnHours}
                max={1.1}
              />
              <StaffingRow
                label="LPN hours / resident / day"
                value={facility.lpnHours}
                benchmark={benchmarks.lpnHours}
                max={1.1}
              />
              <StaffingRow
                label="CNA hours / resident / day"
                value={facility.cnaHours}
                benchmark={benchmarks.cnaHours}
                max={3}
              />
              <StaffingRow
                label="Total nurse hours"
                value={facility.totalNurseHours}
                benchmark={benchmarks.totalNurseHours}
              />
              <StaffingRow
                label="Weekend nurse hours"
                value={facility.weekendNurseHours}
                benchmark={benchmarks.weekendNurseHours}
              />
            </div>
            <aside className="explain-card">
              <h3>Why staffing matters</h3>
              <p>
                Staffing levels can affect response time, monitoring, help with daily needs, and
                whether the same caregivers know a resident’s routines.
              </p>
              <dl>
                <div>
                  <dt>Nursing turnover</dt>
                  <dd>
                    {facility.turnover === null ? "Not enough data" : `${facility.turnover}%`}
                  </dd>
                </div>
                <div>
                  <dt>State comparison</dt>
                  <dd>{facility.stateTurnover}%</dd>
                </div>
              </dl>
            </aside>
          </div>
          <SourceDisclosure source={facility.source} />
        </section>
        <section
          className="profile-section profile-section--tint"
          aria-labelledby="inspection-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Inspection & deficiency intelligence</p>
            <h2 id="inspection-title">What inspectors recorded</h2>
          </div>
          <div className="inspection-summary">
            <div>
              <span className="big-number">{facility.deficiencies ?? "—"}</span>
              <strong>deficiencies in latest synthetic inspection</strong>
            </div>
            <div>
              <span className="big-number">{facility.seriousDeficiencies}</span>
              <strong>marked serious in this demonstration</strong>
            </div>
          </div>
          {facility.repeatCategories.length > 0 ? (
            <div className="finding">
              <span className="code">F-demo</span>
              <div>
                <h3>Repeat area: {facility.repeatCategories.join(", ")}</h3>
                <p>
                  A consumer-language demonstration of a repeated inspection category. No real
                  regulatory code or provider finding is represented.
                </p>
              </div>
            </div>
          ) : (
            <p className="quiet-callout">
              No repeat category appears in the current synthetic review period.
            </p>
          )}
          <SourceDisclosure source={facility.source} />
        </section>
        <section className="profile-section" aria-labelledby="enforcement-title">
          <div className="section-heading">
            <p className="eyebrow">Penalties & enforcement</p>
            <h2 id="enforcement-title">Evidence to review—not a verdict</h2>
            <p>
              A penalty should be understood alongside its date, reason, corrective response, and
              the rest of the record.
            </p>
          </div>
          {facility.penalties.length ? (
            <div className="penalty-list">
              {facility.penalties.map((penalty) => (
                <article key={penalty.date}>
                  <time>{penalty.date}</time>
                  <strong>${penalty.amount.toLocaleString("en-US")}</strong>
                  <span>{penalty.category}</span>
                  <small>Synthetic demonstration source</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="quiet-callout">
              <strong>No recent penalties shown</strong>
              <p>
                None appear in this fictional review period. That does not guarantee future or
                overall performance.
              </p>
            </div>
          )}
          <SourceDisclosure source={facility.source} />
        </section>
        <section className="profile-section questions-section" aria-labelledby="questions-title">
          <div className="section-heading">
            <p className="eyebrow">Questions to ask</p>
            <h2 id="questions-title">Turn evidence into a better conversation</h2>
            <p>
              Questions are generated deterministically from the evidence shown above. No external
              AI is used.
            </p>
          </div>
          <ol className="question-list">
            {questions.map((item) => (
              <li key={item.question}>
                <span>Evidence: {item.evidence}</span>
                <p>“{item.question}”</p>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="profile-section source-register"
          id="sources"
          aria-labelledby="sources-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Source register</p>
            <h2 id="sources-title">Trace the demonstration record</h2>
          </div>
          <SourceDisclosure source={facility.source} />
          <p className="independence-statement">
            No paid placements. Facilities cannot pay to rank higher. This printed research uses
            fictional data only. We cite. You decide.
          </p>
        </section>
      </div>
    </div>
  );
}
