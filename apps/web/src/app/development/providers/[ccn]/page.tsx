import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDevelopmentDataEnabled } from "@/server/care/access";
import { formatFreshnessLabels, formatMissingCmsValue } from "@/server/care/freshness";
import { getProviderByCcn } from "@/server/care/repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Provider mapping inspection",
  robots: { index: false, follow: false },
};

export default async function DevelopmentProviderDetail({
  params,
}: {
  params: Promise<{ ccn: string }>;
}) {
  if (!isDevelopmentDataEnabled()) notFound();
  const provider = await getProviderByCcn((await params).ccn);
  if (!provider) notFound();
  const freshness = formatFreshnessLabels(provider.source.freshness);

  return (
    <main className="page-shell">
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Development only &middot; real CMS data</p>
        <h1>{provider.providerName}</h1>
        <p>CMS CCN {provider.ccn}</p>
      </header>
      <section>
        <h2>Facility</h2>
        <dl className="metric-list">
          <div>
            <dt>Location</dt>
            <dd>
              {[
                provider.location.address,
                provider.location.city,
                provider.location.state,
                provider.location.zipCode,
              ]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
          <div>
            <dt>Certified beds</dt>
            <dd>{formatMissingCmsValue(provider.certifiedBeds)}</dd>
          </div>
          <div>
            <dt>Participation</dt>
            <dd>{provider.participationType ?? "Not available in this CMS release"}</dd>
          </div>
          <div>
            <dt>Ownership descriptor</dt>
            <dd>{provider.ownershipType ?? "Not available in this CMS release"}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>CMS summary</h2>
        <dl className="metric-list">
          <div>
            <dt>Overall</dt>
            <dd>{formatMissingCmsValue(provider.ratings.overall)}</dd>
          </div>
          <div>
            <dt>Health inspection</dt>
            <dd>{formatMissingCmsValue(provider.ratings.healthInspection)}</dd>
          </div>
          <div>
            <dt>Staffing</dt>
            <dd>{formatMissingCmsValue(provider.ratings.staffing)}</dd>
          </div>
          <div>
            <dt>Quality measure</dt>
            <dd>{formatMissingCmsValue(provider.ratings.qualityMeasure)}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Source and freshness</h2>
        <p>{freshness.sourceUpdated}</p>
        <p>{freshness.retrieved}</p>
        <dl className="metric-list">
          <div>
            <dt>Dataset</dt>
            <dd>
              {provider.source.datasetName} ({provider.source.cmsDatasetIdentifier})
            </dd>
          </div>
          <div>
            <dt>Release</dt>
            <dd>{provider.source.releaseIdentifier}</dd>
          </div>
          <div>
            <dt>Source record</dt>
            <dd>{provider.source.sourceRecordLocator}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
