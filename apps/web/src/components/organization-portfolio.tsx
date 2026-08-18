import { OrganizationRelatedFacilities } from "./organization-related-facilities";
import type { CareOrganizationPortfolioPage } from "@/server/care/types";

function money(value: number | null): string {
  if (value == null) return "Not reported";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function OrganizationPortfolio({ page }: { page: CareOrganizationPortfolioPage }) {
  const { portfolio } = page;
  return (
    <article className="organization-portfolio">
      <header className="section-heading">
        <p className="eyebrow">Ownership organization</p>
        <h1>{portfolio.organizationName}</h1>
        <p>
          Connected facilities: {portfolio.facilityCount}. States: {portfolio.stateCount}.
          Relationship types:{" "}
          {portfolio.relationshipRoles.join(", ") || "CMS ownership relationship"}.
        </p>
      </header>

      <section aria-labelledby="portfolio-snapshot-title">
        <h2 id="portfolio-snapshot-title">Portfolio Snapshot</h2>
        <dl className="real-fact-grid">
          <div>
            <dt>CMS rating distribution</dt>
            <dd>
              {portfolio.overallSampleSize >= 3
                ? `Average ${portfolio.overallAverage} stars across ${portfolio.overallSampleSize} reporting facilities`
                : "Not enough comparable CMS ratings"}
            </dd>
          </div>
          <div>
            <dt>Staffing context</dt>
            <dd>
              {portfolio.averageTotalNurseHprd == null
                ? "Not enough comparable staffing observations"
                : `${portfolio.averageTotalNurseHprd} total nurse hours per resident day across ${portfolio.totalNurseSampleSize} reporting facilities`}
            </dd>
          </div>
          <div>
            <dt>Inspection context</dt>
            <dd>
              {portfolio.facilitiesWithRecentComplaintInspection} facilities had a CMS complaint
              inspection in the last 18 months.
            </dd>
          </div>
          <div>
            <dt>Penalties</dt>
            <dd>
              {portfolio.facilitiesWithRecentCmsPenalty} facilities had a recent CMS penalty.
              {portfolio.facilitiesWithRecentHighValueEnforcement > 0
                ? ` ${portfolio.facilitiesWithRecentHighValueEnforcement} had recent high-value CMS enforcement.`
                : ""}{" "}
              Recorded CMS fines total {money(portfolio.totalFineAmount)}.
            </dd>
          </div>
          {portfolio.facilitiesWithRecentStateEnforcement > 0 && (
            <div>
              <dt>State enforcement (CA/NY)</dt>
              <dd>
                {portfolio.facilitiesWithRecentStateEnforcement} facilities had published state
                enforcement or inspection events. This is state-specific evidence and is not used
                for national portfolio comparisons.
              </dd>
            </div>
          )}
        </dl>
        {portfolio.overallSampleSize >= 3 && (
          <ol className="ownership-v2__distribution">
            {([5, 4, 3, 2, 1] as const).map((star) => (
              <li key={star}>
                {star}★ {portfolio.overallDistribution[star]}{" "}
                {portfolio.overallDistribution[star] === 1 ? "facility" : "facilities"}
              </li>
            ))}
          </ol>
        )}
        <p className="ownership-v2__disclaimer">{portfolio.disclaimer}</p>
      </section>

      <section aria-labelledby="related-facilities-title">
        <h2 id="related-facilities-title">Related Facilities</h2>
        <OrganizationRelatedFacilities facilities={portfolio.relatedFacilities} />
      </section>

      {(page.historicalFacilities.length > 0 || page.ownershipChanges.length > 0) && (
        <section aria-labelledby="relationship-history-title">
          <h2 id="relationship-history-title">Ownership / Relationship History</h2>
          {page.ownershipChanges.length > 0 && (
            <>
              <h3>Ownership changes recorded</h3>
              <ul>
                {page.ownershipChanges.map((change) => (
                  <li key={`${change.ccn}-${change.effectiveDate}-${change.changeTypeText}`}>
                    {change.effectiveDate}: {change.changeTypeText} at {change.facilityName}
                  </li>
                ))}
              </ul>
            </>
          )}
          {page.historicalFacilities.length > 0 && (
            <>
              <h3>Previously connected facilities</h3>
              <p>
                These facilities appeared in older CMS ownership files for this organization and are
                not in the current file. Sequential file appearance is not treated as an
                acquisition.
              </p>
              <ul>
                {page.historicalFacilities.map((facility) => (
                  <li key={facility.ccn}>
                    {facility.providerName}
                    {facility.city
                      ? ` · ${facility.city}, ${facility.state}`
                      : ` · ${facility.state}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="org-sources-title">
        <h2 id="org-sources-title">Sources &amp; Methodology</h2>
        <ul>
          <li>CMS skilled nursing facility ownership and enrollment files.</li>
          <li>Current membership uses the latest successful CMS ownership release only.</li>
          <li>
            Portfolio pages are published only for VERIFIED CMS organization identities with at
            least three current facilities.
          </li>
          <li>We cite. You decide. No owner score, chain score, or portfolio grade is created.</li>
        </ul>
      </section>
    </article>
  );
}
