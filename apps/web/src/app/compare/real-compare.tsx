import Link from "next/link";
import type { CareDecisionSummary, CareProviderDetail } from "@/server/care/types";
import { providerHref } from "@/server/care/consumer";
import { formatFreshnessLabels, formatMissingCmsValue } from "@/server/care/freshness";
import { CmsStarRating } from "@/components/real-provider";
import { PrintButton } from "@/components/print-button";

function YesNo({ value }: { value: boolean | null }) {
  return <>{value === null ? "Not reported" : value ? "Yes" : "No"}</>;
}

export function RealCompare({
  providers,
  summaries = [],
}: {
  providers: CareProviderDetail[];
  summaries?: CareDecisionSummary[];
}) {
  return (
    <div className="page-shell compare-page real-compare-page">
      <div className="real-data-notice" role="note">
        <strong>Controlled real CMS data review</strong>
        <span>Comparison is limited to current Provider Information fields.</span>
      </div>
      <header className="page-intro">
        <p className="eyebrow">CMS side-by-side research</p>
        <h1>Compare published measures without declaring a winner.</h1>
        <p className="lede">Different families may weigh these CMS dimensions differently.</p>
        <PrintButton label="Print / share comparison" />
      </header>
      {providers.length < 2 ? (
        <div className="empty-state">
          <h2>Add another provider</h2>
          <p>Choose at least two real CMS providers from search to compare.</p>
          <Link className="button button--primary" href="/search">
            Search CMS providers
          </Link>
        </div>
      ) : (
        <div className="real-compare-stack">
          {providers.map((provider) => {
            const freshness = formatFreshnessLabels(provider.source.freshness);
            const evidence = summaries.find((item) => item.ccn === provider.ccn);
            return (
              <article className="real-compare-provider" key={provider.ccn}>
                <header>
                  <p className="kicker">CMS ID {provider.ccn}</p>
                  <h2>
                    <Link href={providerHref(provider)}>{provider.providerName}</Link>
                  </h2>
                  <p>
                    {[provider.location.city, provider.location.state, provider.location.zipCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </header>
                <dl className="compare-detail-grid">
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
                    <dt>Ownership descriptor</dt>
                    <dd>{provider.ownershipType ?? "Not reported in this CMS release"}</dd>
                  </div>
                  <div>
                    <dt>Medicare participation</dt>
                    <dd>
                      <YesNo value={provider.participatesMedicare} />
                    </dd>
                  </div>
                  <div>
                    <dt>Medicaid participation</dt>
                    <dd>
                      <YesNo value={provider.participatesMedicaid} />
                    </dd>
                  </div>
                  <div>
                    <dt>Source freshness</dt>
                    <dd>{freshness.sourceUpdated}</dd>
                  </div>
                </dl>
                <div className="compare-evidence-groups">
                  <section>
                    <h3>Staffing</h3>
                    <p>
                      {evidence?.staffingQuarter
                        ? `${evidence.staffingQuarter}: ${evidence.totalNurseHprd?.toFixed(2) ?? "Not reported"} total nursing HPRD; ${evidence.rnHprd?.toFixed(2) ?? "Not reported"} RN HPRD; ${evidence.weekendRnHprd?.toFixed(2) ?? "Not reported"} weekend RN HPRD.`
                        : "Not available in this source."}
                    </p>
                  </section>
                  <section>
                    <h3>Latest standard inspection</h3>
                    <p>
                      {evidence?.inspectionDate
                        ? `${evidence.inspectionDate}: ${evidence.deficiencyCount ?? "Not reported"} cited deficiencies.`
                        : "Not available in this source."}
                    </p>
                  </section>
                  <section>
                    <h3>Enforcement</h3>
                    <p>
                      {evidence?.latestPenaltyType
                        ? evidence.latestPenaltyType === "Fine"
                          ? `Latest loaded fine: $${evidence.latestFineAmount?.toLocaleString("en-US") ?? "not reported"}.`
                          : `Latest loaded payment denial: ${evidence.paymentDenialDays ?? "not reported"} days.`
                        : "Not available in this source."}
                    </p>
                  </section>
                  <section>
                    <h3>Ownership</h3>
                    <p>
                      {evidence
                        ? `${evidence.ownershipPartyCount} disclosed ownership/control parties${evidence.ownershipChangeDate ? `; latest ownership change effective ${evidence.ownershipChangeDate}` : ""}.`
                        : "Not available in this source."}
                    </p>
                  </section>
                  <section>
                    <h3>Chain</h3>
                    <p>
                      {evidence?.chainName
                        ? `${evidence.chainName}: CMS published ${evidence.chainFacilityCount} facilities across ${evidence.chainStateCount} states or territories for ${evidence.chainReleaseMonth?.slice(0, 7)}.`
                        : "Not available in this source."}
                    </p>
                  </section>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="independence-statement">
        No proprietary ranking or winner is produced. Source: CMS Nursing Home Provider Information.
        We cite. You decide.
      </p>
    </div>
  );
}
