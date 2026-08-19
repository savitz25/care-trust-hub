import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  ASSISTED_LIVING_STATE_SOURCES,
  assistedLivingLandingPath,
  officialAssistedLivingDatasetName,
  officialAssistedLivingSourceUrl,
  resolveAssistedLivingLanding,
} from "@care/domain";
import {
  AssistedLivingCoverageNote,
  AssistedLivingInspectionGap,
} from "@/components/assisted-living-provider";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { isAssistedLivingIntelligenceEnabled } from "@/server/care/feature-flags";
import { getAssistedLivingStateCoverage } from "@/server/care/assisted-living-publication";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  if (!isAssistedLivingIntelligenceEnabled()) {
    return { title: "Page not found", robots: publicRobots(false) };
  }
  const landing = resolveAssistedLivingLanding((await params).state);
  if (!landing) return { title: "Page not found", robots: publicRobots(false) };
  const path = assistedLivingLandingPath(landing.slug);
  return {
    title: `Assisted living in ${landing.name}`,
    description: `Research state-licensed assisted living and residential care in ${landing.name} using the official regulator listing. SeniorTrustHub does not score providers.`,
    alternates: canonicalUrl(path) ? { canonical: canonicalUrl(path) } : undefined,
    robots: publicRobots(true),
  };
}

export default async function AssistedLivingStatePage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  if (!isAssistedLivingIntelligenceEnabled()) notFound();
  const raw = (await params).state;
  const landing = resolveAssistedLivingLanding(raw);
  if (!landing) notFound();
  if (raw.toLowerCase() !== landing.slug)
    permanentRedirect(assistedLivingLandingPath(landing.slug));
  const source = ASSISTED_LIVING_STATE_SOURCES[landing.code];
  const coverage = (await getAssistedLivingStateCoverage()).find(
    (item) => item.stateCode === landing.code,
  );
  const sourceUrl = officialAssistedLivingSourceUrl(landing.code);
  return (
    <div className="page-shell">
      <RealDataNotice />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">State-regulator evidence</p>
        <h1>Assisted living in {landing.name}</h1>
        <p className="lede">
          SeniorTrustHub publishes official {landing.name} licensing identities for residential
          care. This is not national coverage and it is not a rating.
        </p>
        <AssistedLivingCoverageNote />
        <AssistedLivingInspectionGap />
      </header>
      <section className="facility-section">
        <h2>What is published here</h2>
        <dl className="real-fact-grid">
          <div>
            <dt>Published providers</dt>
            <dd>{coverage?.providers.toLocaleString("en-US") ?? "0"}</dd>
          </div>
          <div>
            <dt>Regulator</dt>
            <dd>{source.regulatorName}</dd>
          </div>
          <div>
            <dt>Official terms</dt>
            <dd>{source.officialTerminology.join("; ")}</dd>
          </div>
          <div>
            <dt>Explicit memory designations</dt>
            <dd>
              {landing.code === "CA"
                ? "Not reported in the official RCFE listing. Names are not used."
                : `${coverage?.explicitMemory.toLocaleString("en-US") ?? "0"} providers with an official designation`}
            </dd>
          </div>
        </dl>
        <p>
          SeniorTrustHub verifies the official facility ID, name, address, care type, licensed
          capacity, and organization roles that appear in{" "}
          {officialAssistedLivingDatasetName(landing.code)}.
        </p>
        <p>
          <Link
            className="button button--primary"
            href={`/assisted-living?search=1&state=${landing.code}`}
          >
            Search {landing.name} providers →
          </Link>
        </p>
        {landing.code !== "CA" ? (
          <p>
            <Link
              className="button button--secondary"
              href={`/assisted-living?search=1&state=${landing.code}&memory=1`}
            >
              Show explicit memory / dementia designations →
            </Link>
          </p>
        ) : null}
        {sourceUrl ? (
          <p>
            <a href={sourceUrl} rel="noreferrer">
              Official {landing.name} source
            </a>
          </p>
        ) : null}
      </section>
    </div>
  );
}
