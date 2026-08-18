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
    summary.cmsOwnershipType && {
      label: "Ownership type",
      value: summary.cmsOwnershipType,
      note: "CMS",
    },
    summary.operator && {
      label: "Operator",
      value: summary.operator.value,
      note: summary.operator.source,
    },
    summary.licensee && {
      label: "Licensee",
      value: summary.licensee.value,
      note: summary.licensee.source,
    },
    summary.managementCompany && {
      label: "Management company",
      value: summary.managementCompany.value,
      note: summary.managementCompany.source,
    },
    summary.chainName && {
      label: "Chain",
      value: summary.chainName,
      note: `CMS identifies this facility as part of the ${summary.chainName} chain.`,
    },
    summary.portfolio && {
      label: "Related facilities",
      value: String(summary.portfolio.facilityCount),
      note: "Current CMS organization identity",
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
          Operator, licensee, owner, manager, and chain stay separate. A connected organization is
          not automatically the party that runs daily operations.
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
      {summary.supportedByMultipleGovernmentSources && (
        <p className="ownership-v2__corroboration">Supported by multiple government sources</p>
      )}
      {summary.portfolio && (
        <p>
          <Link href={summary.portfolio.href}>Explore ownership network →</Link>
        </p>
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
              {summary.portfolio.facilityCount} currently connected nursing homes share this CMS
              organization identity with {summary.portfolio.organizationName}.
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
                <dt>CMS monetary penalties</dt>
                <dd>
                  {summary.portfolio.facilitiesWithPenalty} of {summary.portfolio.facilityCount}{" "}
                  facilities had a recorded monetary penalty in the available CMS period.
                </dd>
              </div>
              <div>
                <dt>Recent CMS penalties</dt>
                <dd>
                  {summary.portfolio.facilitiesWithRecentCmsPenalty} facilities had a CMS penalty in
                  the last 18 months.
                </dd>
              </div>
              <div>
                <dt>Recent high-value CMS enforcement</dt>
                <dd>
                  {summary.portfolio.facilitiesWithRecentHighValueEnforcement} facilities had a
                  high-value CMS fine or payment denial in the last 18 months.
                </dd>
              </div>
              <div>
                <dt>Recent CMS complaint inspections</dt>
                <dd>
                  {summary.portfolio.facilitiesWithRecentComplaintInspection} facilities had a CMS
                  complaint inspection in the last 18 months.
                </dd>
              </div>
              {summary.portfolio.facilitiesWithRecentStateEnforcement > 0 && (
                <div>
                  <dt>Recent state enforcement (CA/NY, labeled separately)</dt>
                  <dd>
                    {summary.portfolio.facilitiesWithRecentStateEnforcement} facilities had a
                    published state enforcement or inspection event in the last 18 months. State
                    evidence is not mixed into national CMS averages.
                  </dd>
                </div>
              )}
              <div>
                <dt>Total recorded CMS fines</dt>
                <dd>{money(summary.portfolio.totalFineAmount)}</dd>
              </div>
            </dl>
            <p className="ownership-v2__disclaimer">{summary.portfolio.disclaimer}</p>
          </div>
          <div id="related-facilities" className="ownership-v2__related">
            <h3>Facilities currently connected to this organization</h3>
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
            {summary.portfolio.facilityCount > summary.portfolio.relatedFacilities.length && (
              <p>
                <Link href={summary.portfolio.href}>
                  View all {summary.portfolio.facilityCount} connected facilities
                </Link>
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
