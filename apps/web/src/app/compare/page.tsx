import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getComparisonObservations, syntheticFacilities, type Facility } from "@care/domain";
import { StarValue, SyntheticDataNotice, TrendIndicator } from "@/components/evidence";
import { PrintButton } from "@/components/print-button";
import { isRealProviderUiEnabled } from "@/server/care/feature-flags";
import { getDecisionSummariesByCcns, getProvidersByCcns } from "@/server/care/repository";
import { RealCompare } from "./real-compare";
import { parsePublicProviderSelection } from "@/server/care/shortlist-contract";

export const metadata: Metadata = {
  title: "Compare facilities",
  description:
    "Compare fictional facilities across transparent evidence dimensions without declaring a winner.",
};

const defaultSlugs = ["harbor-pines", "meadowridge", "willow-harbor"];

function Metric({
  label,
  facilities,
  render,
}: {
  label: string;
  facilities: Facility[];
  render: (facility: Facility) => ReactNode;
}) {
  return (
    <section className="compare-metric" aria-labelledby={`metric-${label.replaceAll(" ", "-")}`}>
      <h2 id={`metric-${label.replaceAll(" ", "-")}`}>{label}</h2>
      <div className="compare-metric__values">
        {facilities.map((facility) => (
          <div key={facility.slug}>
            <strong className="mobile-facility-name">{facility.name}</strong>
            {render(facility)}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ facilities?: string; real?: string }>;
}) {
  const params = await searchParams;
  if (isRealProviderUiEnabled() && params.real) {
    const ccns = parsePublicProviderSelection(params.real, 3);
    const providers = await getProvidersByCcns(ccns);
    const summaries = await getDecisionSummariesByCcns(ccns);
    return <RealCompare providers={providers} summaries={summaries} />;
  }
  const requested = params.facilities?.split(",").slice(0, 3) ?? defaultSlugs;
  const facilities = requested
    .map((slug) => syntheticFacilities.find((facility) => facility.slug === slug))
    .filter((facility): facility is Facility => Boolean(facility));
  const selected =
    facilities.length >= 2 ? facilities : (syntheticFacilities.slice(0, 3) as Facility[]);
  const observations = getComparisonObservations(selected);
  return (
    <div className="page-shell compare-page">
      <SyntheticDataNotice />
      <header className="page-intro">
        <p className="eyebrow">Side-by-side research</p>
        <h1>Compare the evidence, not a sales pitch.</h1>
        <p className="lede">
          No winner is declared. Different families may weigh these factors differently.
        </p>
        <PrintButton label="Print / share comparison" />
      </header>
      <div className="compare-table">
        <div className="compare-head" aria-label="Compared facilities">
          {selected.map((facility) => (
            <article key={facility.slug}>
              <p className="kicker">
                {facility.city}, {facility.state}
              </p>
              <h2>
                <a href={`/facility/${facility.slug}`}>{facility.name}</a>
              </h2>
              <span>{facility.careType}</span>
            </article>
          ))}
        </div>
        <Metric
          label="CMS overall"
          facilities={selected}
          render={(facility) => <StarValue value={facility.cmsOverall} />}
        />
        <Metric
          label="Staffing"
          facilities={selected}
          render={(facility) => (
            <>
              <StarValue value={facility.staffingStars} />
              <small>
                {facility.totalNurseHours?.toFixed(2) ?? "—"} total hours / resident / day
              </small>
            </>
          )}
        />
        <Metric
          label="Inspection history"
          facilities={selected}
          render={(facility) => (
            <strong>
              {facility.deficiencies === null
                ? "Limited history"
                : `${facility.deficiencies} deficiencies · ${facility.seriousDeficiencies} serious`}
            </strong>
          )}
        />
        <Metric
          label="Nursing turnover"
          facilities={selected}
          render={(facility) => (
            <strong>
              {facility.turnover === null ? "Not enough data" : `${facility.turnover}%`}
              <small>{facility.stateTurnover}% synthetic state comparison</small>
            </strong>
          )}
        />
        <Metric
          label="Recent penalties"
          facilities={selected}
          render={(facility) => (
            <strong>
              {facility.penalties.length
                ? `$${facility.penalties[0].amount.toLocaleString("en-US")} · ${facility.penalties[0].date}`
                : "None shown in demo period"}
            </strong>
          )}
        />
        <Metric
          label="Ownership"
          facilities={selected}
          render={(facility) => (
            <strong>
              {facility.chainName ?? facility.ownershipType}
              <small>
                {facility.ownershipChangeDate
                  ? `Changed ${facility.ownershipChangeDate}`
                  : "No recent change shown"}
              </small>
            </strong>
          )}
        />
        <Metric
          label="Recent trend"
          facilities={selected}
          render={(facility) => <TrendIndicator trend={facility.trend} />}
        />
      </div>
      <section className="compare-standouts" aria-labelledby="compare-standouts-title">
        <div className="section-heading">
          <p className="eyebrow">What stands out</p>
          <h2 id="compare-standouts-title">Differences worth discussing</h2>
        </div>
        <div>
          {observations.map((observation) => {
            const facility = selected.find(({ slug }) => slug === observation.slug)!;
            return (
              <article key={observation.slug}>
                <h3>{facility.name}</h3>
                <p>{observation.text}</p>
                <a href={`/facility/${facility.slug}`}>
                  Investigate this facility <span aria-hidden="true">→</span>
                </a>
              </article>
            );
          })}
        </div>
        <p className="independence-statement">
          Different families may weigh these factors differently. No facility can pay for placement
          or rank. Source: Experience Lab synthetic demonstration release, observed July 2026. No
          real provider or CMS record is represented.
        </p>
      </section>
    </div>
  );
}
