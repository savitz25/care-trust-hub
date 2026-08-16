import Link from "next/link";
import Image from "next/image";
import { PrintButton } from "@/components/print-button";
import { CmsStarRating } from "@/components/real-provider";
import { providerHref } from "@/server/care/consumer";
import { getDecisionSummariesByCcns, getProvidersByCcns } from "@/server/care/repository";
import { parsePublicProviderSelection } from "@/server/care/shortlist-contract";

export const metadata = {
  title: "Nursing home research summary",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ real?: string }>;
}) {
  const ids = parsePublicProviderSelection((await searchParams).real ?? "", 10);
  const providers = await getProvidersByCcns(ids);
  const summaries = await getDecisionSummariesByCcns(ids);
  const generated = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(),
  );
  return (
    <div className="page-shell research-packet">
      <header className="page-intro">
        <Image
          className="research-packet__brand"
          src="/brand/senior-trust-hub-logo.svg"
          alt="SeniorTrustHub"
          width={560}
          height={112}
        />
        <p className="eyebrow">Shareable research packet</p>
        <h1>Nursing home research summary</h1>
        <p>
          Generated {generated}. Review cited public evidence and take these questions into calls or
          visits.
        </p>
        <PrintButton label="Print / Save as PDF" />
      </header>
      {providers.length === 0 ? (
        <div className="empty-state">
          <h2>Add facilities to your research summary</h2>
          <Link className="button button--primary" href="/shortlist">
            Build a shortlist
          </Link>
        </div>
      ) : (
        providers.map((provider) => {
          const evidence = summaries.find((item) => item.ccn === provider.ccn);
          return (
            <article className="research-facility" key={provider.ccn}>
              <header>
                <p className="kicker">CMS provider ID {provider.ccn}</p>
                <h2>{provider.providerName}</h2>
                <p>
                  {provider.location.address}
                  <br />
                  {provider.location.city}, {provider.location.state} {provider.location.zipCode}
                </p>
              </header>
              <dl className="compare-detail-grid">
                <div>
                  <dt>CMS overall rating</dt>
                  <dd>
                    <CmsStarRating value={provider.ratings.overall} />
                  </dd>
                </div>
                <div>
                  <dt>CMS inspection rating</dt>
                  <dd>
                    <CmsStarRating value={provider.ratings.healthInspection} />
                  </dd>
                </div>
                <div>
                  <dt>CMS staffing rating</dt>
                  <dd>
                    <CmsStarRating value={provider.ratings.staffing} />
                  </dd>
                </div>
                <div>
                  <dt>CMS quality rating</dt>
                  <dd>
                    <CmsStarRating value={provider.ratings.qualityMeasure} />
                  </dd>
                </div>
                <div>
                  <dt>Certified beds</dt>
                  <dd>{provider.certifiedBeds ?? "Not reported"}</dd>
                </div>
                <div>
                  <dt>Ownership descriptor</dt>
                  <dd>{provider.ownershipType ?? "Not reported in this source"}</dd>
                </div>
              </dl>
              <div className="compare-evidence-groups">
                <h3>Evidence to review</h3>
                <p>
                  {evidence?.staffingQuarter
                    ? `${evidence.staffingQuarter} PBJ staffing: ${evidence.rnHprd?.toFixed(2) ?? "not reported"} RN HPRD.`
                    : "PBJ staffing not available in the loaded source."}
                </p>
                <p>
                  {evidence?.inspectionDate
                    ? `Latest standard inspection: ${evidence.inspectionDate}, with ${evidence.deficiencyCount ?? "not reported"} cited deficiencies.`
                    : "Standard inspection summary not available in the loaded source."}
                </p>
                <p>
                  {evidence
                    ? `${evidence.ownershipPartyCount} CMS-published ownership/control parties.`
                    : "Ownership summary not available."}
                </p>
                <p>
                  {evidence?.chainName
                    ? `CMS chain: ${evidence.chainName}, ${evidence.chainFacilityCount} facilities across ${evidence.chainStateCount} states or territories (${evidence.chainReleaseMonth?.slice(0, 7)}).`
                    : "CMS chain affiliation not available in the loaded source."}
                </p>
              </div>
              <h3>Questions to ask</h3>
              <ul>
                <li>
                  What staffing and leadership changes have occurred since the latest CMS reporting
                  period?
                </li>
                <li>Which inspection findings should a family understand before admission?</li>
                <li>Who is responsible for day-to-day operations and family concerns?</li>
              </ul>
              <Link href={providerHref(provider)}>Open full facility research</Link>
              <p className="source-inline">
                Source: {provider.source.datasetName}; CMS source updated{" "}
                {provider.source.freshness.sourceModifiedAt?.slice(0, 10) ?? "not reported"}.
              </p>
            </article>
          );
        })
      )}
      <section className="profile-section">
        <h2>Sources and independence</h2>
        <p>
          This packet summarizes cited CMS datasets. Open each facility profile for staffing,
          inspections, enforcement, ownership, chain context, methodology, and dataset-specific
          freshness.
        </p>
        <p className="independence-statement">
          No paid placements. Facilities cannot pay to rank higher. We cite. You decide.
        </p>
      </section>
    </div>
  );
}
