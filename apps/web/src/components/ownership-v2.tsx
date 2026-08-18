import Link from "next/link";
import { providerHref } from "@/server/care/consumer";
import type { CareOwnershipOperationSummary } from "@/server/care/types";

function stars(value: number | null): string {
  if (value == null) return "Not reported";
  return `${value} of 5 CMS stars`;
}

function money(value: number | null): string {
  if (value == null) return "Not reported";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function OwnershipOperation({ summary }: { summary: CareOwnershipOperationSummary }) {
  const facts = [
    summary.operator && {
      label: "Facility operator",
      value: summary.operator.value,
      note: summary.operator.source,
    },
    summary.licensee && {
      label: "State licensee",
      value: summary.licensee.value,
      note: summary.licensee.source,
    },
    summary.managementCompany && {
      label: "Management company",
      value: summary.managementCompany.value,
      note: summary.managementCompany.source,
    },
    summary.cmsOwnershipType && {
      label: "CMS ownership type",
      value: summary.cmsOwnershipType,
      note: "CMS",
    },
    summary.organizationCount > 0 && {
      label: "Connected ownership organizations",
      value: String(summary.organizationCount),
      note: "CMS ownership disclosures",
    },
    summary.individualCount > 0 && {
      label: "Connected individuals",
      value: `${summary.individualCount} ownership records`,
      note: "CMS ownership disclosures",
    },
    summary.chainName && {
      label: "Chain / common-control group",
      value: summary.chainName,
      note: "CMS chain grouping, not automatically the legal owner",
    },
    summary.ownershipChangeCount > 0 && {
      label: "Ownership changes",
      value: `${summary.ownershipChangeCount} recorded`,
      note: "CMS enrollment records",
    },
  ].filter(Boolean) as Array<{ label: string; value: string; note: string }>;

  return (
    <section
      className="ownership-v2"
      id="ownership-operation"
      aria-labelledby="ownership-operation-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Ownership &amp; operation</p>
        <h2 id="ownership-operation-title">Ownership &amp; Operation</h2>
        <p>
          These labels keep operator, licensee, owner, manager, and chain separate. A connected
          organization is not automatically the party that runs daily operations.
        </p>
      </div>
      {facts.length > 0 && (
        <dl className="ownership-facts real-fact-grid">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {fact.value}
                <small>{fact.note}</small>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {summary.whoIsBehind.length > 0 && (
        <div className="ownership-v2__behind">
          <h3>Who is behind this facility?</h3>
          <p>SeniorTrustHub found evidence connecting this facility to:</p>
          <ul>
            {summary.whoIsBehind.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.portfolio && (
        <>
          <div className="ownership-v2__portfolio">
            <h3>Related facilities</h3>
            <p>
              {summary.portfolio.facilityCount} nursing homes are connected to{" "}
              {summary.portfolio.organizationName} through the same CMS organization identity.
            </p>
            <p>
              <a href="#related-facilities">View related facilities</a>
            </p>
            <dl className="real-fact-grid">
              <div>
                <dt>Average CMS overall rating</dt>
                <dd>
                  {summary.portfolio.overallAverage == null
                    ? "Not enough comparable data"
                    : `${summary.portfolio.overallAverage} stars across ${summary.portfolio.overallSampleSize} reporting facilities`}
                </dd>
              </div>
              <div>
                <dt>Average staffing rating</dt>
                <dd>
                  {summary.portfolio.staffingAverage == null
                    ? "Not enough comparable data"
                    : `${summary.portfolio.staffingAverage} stars across ${summary.portfolio.staffingSampleSize} reporting facilities`}
                </dd>
              </div>
              <div>
                <dt>CMS monetary penalties</dt>
                <dd>
                  {summary.portfolio.facilitiesWithPenalty} of {summary.portfolio.facilityCount}{" "}
                  facilities had a recorded monetary penalty in the available period.
                </dd>
              </div>
              <div>
                <dt>Total recorded fines</dt>
                <dd>{money(summary.portfolio.totalFineAmount)}</dd>
              </div>
              {summary.portfolio.averageTotalNurseHprd != null && (
                <div>
                  <dt>Average total nurse staffing</dt>
                  <dd>
                    {summary.portfolio.averageTotalNurseHprd} hours per resident day across{" "}
                    {summary.portfolio.totalNurseSampleSize} reporting facilities
                  </dd>
                </div>
              )}
            </dl>
            {summary.portfolio.overallSampleSize >= 3 && (
              <ol className="ownership-v2__distribution">
                {([5, 4, 3, 2, 1] as const).map((star) => (
                  <li key={star}>
                    {star}★ {summary.portfolio!.overallDistribution[star]}{" "}
                    {summary.portfolio!.overallDistribution[star] === 1 ? "facility" : "facilities"}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div id="related-facilities" className="ownership-v2__related">
            <h3>Facilities connected to this organization</h3>
            <ul>
              {summary.portfolio.relatedFacilities.map((facility) => (
                <li key={facility.ccn}>
                  <Link href={providerHref(facility)}>{facility.providerName}</Link>
                  <span>
                    {[facility.city, facility.state].filter(Boolean).join(", ")} · CMS overall{" "}
                    {stars(facility.overallRating)} · staffing {stars(facility.staffingRating)}
                    {facility.hadPenalty ? " · CMS penalty recorded" : ""}
                    {` · ${facility.relationshipType}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
