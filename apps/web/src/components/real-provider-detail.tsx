import Link from "next/link";
import type {
  CareProviderDetail,
  CareOwnershipIntelligence,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
  CareChainIntelligence,
} from "@/server/care/types";
import { CMS_RATING_EXPLANATIONS, factualRatingObservations } from "@/server/care/consumer";
import { formatFreshnessLabels } from "@/server/care/freshness";
import { CmsStarRating, ParticipationFacts } from "./real-provider";
import { PrintButton } from "./print-button";
import { OwnershipIntelligence } from "./ownership-intelligence";
import { RegulatoryIntelligence } from "./regulatory-intelligence";
import { StaffingIntelligence } from "./staffing-intelligence";
import { ChainIntelligence } from "./chain-intelligence";

const additionalLayers = ["Ownership intelligence", "Chain / portfolio intelligence"];

interface FacilitySourceEntry {
  key: string;
  sourceOrganization: string;
  datasetName: string;
  datasetIdentifier: string;
  officialSourceUrl: string;
  sourceModifiedAt: string | null;
  retrievedAt: string;
  coverage?: string;
  supports: string;
}

const sourceDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(value),
      )
    : "Not reported";

export function FacilitySourceRegister({
  provider,
  regulatory,
  staffing,
  ownership,
  chain,
}: {
  provider: CareProviderDetail;
  regulatory?: CareRegulatoryIntelligence;
  staffing?: CareStaffingIntelligence;
  ownership?: CareOwnershipIntelligence;
  chain?: CareChainIntelligence;
}) {
  const sources: FacilitySourceEntry[] = [
    {
      key: `provider-${provider.source.cmsDatasetIdentifier}`,
      sourceOrganization: provider.source.sourceOrganization,
      datasetName: provider.source.datasetName,
      datasetIdentifier: provider.source.cmsDatasetIdentifier,
      officialSourceUrl: provider.source.officialSourceUrl,
      sourceModifiedAt: provider.source.freshness.sourceModifiedAt,
      retrievedAt: provider.source.freshness.retrievedAt,
      supports: "Overview, facility facts, and CMS ratings",
    },
  ];
  const addRegulatorySource = (
    source: CareRegulatoryIntelligence["inspections"][number]["source"],
    supports: string,
  ) => {
    if (sources.some((entry) => entry.datasetIdentifier === source.cmsDatasetIdentifier)) return;
    sources.push({
      key: `regulatory-${source.cmsDatasetIdentifier}`,
      sourceOrganization: source.sourceOrganization,
      datasetName: source.datasetName,
      datasetIdentifier: source.cmsDatasetIdentifier,
      officialSourceUrl: source.officialSourceUrl,
      sourceModifiedAt: source.sourceModifiedAt,
      retrievedAt: source.retrievedAt,
      supports,
    });
  };
  for (const inspection of regulatory?.inspections ?? []) {
    addRegulatorySource(inspection.source, "Inspections and facility history");
    for (const finding of inspection.findings) {
      addRegulatorySource(finding.source, "Health deficiencies and facility history");
    }
  }
  for (const penalty of regulatory?.penalties ?? []) {
    addRegulatorySource(penalty.source, "Penalties, enforcement, and facility history");
  }
  if (staffing?.latest) {
    const chronological = [...staffing.history].sort((a, b) =>
      a.coverageStart.localeCompare(b.coverageStart),
    );
    const first = chronological[0] ?? staffing.latest;
    const last = chronological.at(-1) ?? staffing.latest;
    sources.push({
      key: `staffing-${staffing.latest.source.cmsDatasetIdentifier}`,
      sourceOrganization: staffing.latest.source.sourceOrganization,
      datasetName: staffing.latest.source.datasetName,
      datasetIdentifier: staffing.latest.source.cmsDatasetIdentifier,
      officialSourceUrl: staffing.latest.source.officialSourceUrl,
      sourceModifiedAt: staffing.latest.source.sourceModifiedAt,
      retrievedAt: staffing.latest.source.retrievedAt,
      coverage: `${sourceDate(first.coverageStart)}–${sourceDate(last.coverageEnd)}`,
      supports: "PBJ staffing cards, history, and transparent calculations",
    });
  }
  const ownershipSources = [
    ...(ownership?.parties.map((party) => party.source) ?? []),
    ...(ownership?.changes.map((change) => change.source) ?? []),
  ];
  for (const ownershipSource of ownershipSources) {
    if (sources.some((entry) => entry.datasetIdentifier === ownershipSource.cmsDatasetIdentifier))
      continue;
    sources.push({
      key: `ownership-${ownershipSource.cmsDatasetIdentifier}`,
      sourceOrganization: ownershipSource.sourceOrganization,
      datasetName: ownershipSource.datasetName,
      datasetIdentifier: ownershipSource.cmsDatasetIdentifier,
      officialSourceUrl: ownershipSource.officialSourceUrl,
      sourceModifiedAt: ownershipSource.sourceModifiedAt,
      retrievedAt: ownershipSource.retrievedAt,
      supports: "Ownership parties, organization connections, and ownership history",
    });
  }
  if (chain) {
    sources.push({
      key: `chain-${chain.source.versionIdentifier}`,
      sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
      datasetName: "Nursing Home Chain Performance Measures",
      datasetIdentifier: chain.source.datasetIdentifier,
      officialSourceUrl: chain.source.officialUrl,
      sourceModifiedAt: chain.source.sourceModifiedAt,
      retrievedAt: chain.source.retrievedAt,
      coverage: chain.current.releaseMonth.slice(0, 7),
      supports: "CMS chain context, performance, and monthly history",
    });
    if (
      !sources.some((entry) => entry.datasetIdentifier === chain.membershipSource.datasetIdentifier)
    )
      sources.push({
        key: "chain-membership",
        sourceOrganization: "Centers for Medicare & Medicaid Services (CMS)",
        datasetName: "Skilled Nursing Facility Enrollments",
        datasetIdentifier: chain.membershipSource.datasetIdentifier,
        officialSourceUrl:
          "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-enrollments",
        sourceModifiedAt: chain.membershipSource.sourceModifiedAt,
        retrievedAt: chain.membershipSource.retrievedAt,
        supports: "Exact CMS chain affiliation",
      });
  }
  return (
    <div className="source-register__datasets">
      {sources.map((source) => (
        <details className="source-disclosure real-source-disclosure" key={source.key}>
          <summary>{source.datasetName}</summary>
          <dl>
            <div>
              <dt>Source organization</dt>
              <dd>{source.sourceOrganization}</dd>
            </div>
            <div>
              <dt>Dataset identifier</dt>
              <dd>{source.datasetIdentifier}</dd>
            </div>
            {source.coverage && (
              <div>
                <dt>Coverage</dt>
                <dd>{source.coverage}</dd>
              </div>
            )}
            <div>
              <dt>Source updated</dt>
              <dd>{sourceDate(source.sourceModifiedAt)}</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>{sourceDate(source.retrievedAt)}</dd>
            </div>
            <div>
              <dt>Supports</dt>
              <dd>{source.supports}</dd>
            </div>
          </dl>
          <a href={source.officialSourceUrl} rel="noreferrer">
            View official CMS source
          </a>
        </details>
      ))}
    </div>
  );
}

export function RealProviderDetail({
  provider,
  regulatory,
  staffing,
  ownership,
  chain,
}: {
  provider: CareProviderDetail;
  regulatory?: CareRegulatoryIntelligence;
  staffing?: CareStaffingIntelligence;
  ownership?: CareOwnershipIntelligence;
  chain?: CareChainIntelligence;
}) {
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
            Not publicly activated. This preview combines verified CMS datasets and transparent
            calculations from those records.
          </span>
        </div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/search">Search</Link>
          <span aria-hidden="true">/</span>
          <span>{provider.providerName}</span>
        </nav>
        <header className="facility-hero">
          <div>
            <h1>{provider.providerName}</h1>
            <p className="lede">
              {[provider.location.city, provider.location.state].filter(Boolean).join(", ")}
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
            <Link className="button button--secondary" href="/shortlist">
              Save to shortlist
            </Link>
            <PrintButton />
          </div>
        </header>

        <section className="provider-overview" id="overview" aria-labelledby="cms-overview-title">
          <div className="section-heading">
            <p className="eyebrow">CMS overview</p>
            <h2 className="sr-only" id="cms-overview-title">
              CMS rating overview
            </h2>
          </div>
          <div className="provider-overview__ratings">
            {ratings.map(([label, value]) => (
              <div key={label}>
                <h3>{label.replace(" rating", "")}</h3>
                <CmsStarRating value={value} />
              </div>
            ))}
          </div>
          <p className="provider-overview__note">
            No proprietary TrustHub score. These ratings are published separately by CMS.
          </p>
          <details className="provider-overview__explanations">
            <summary>How CMS describes these ratings</summary>
            <dl>
              {ratings.map(([label, , explanation]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{explanation}</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>

        <section className="provider-facts-strip" aria-label="Facility facts">
          <ParticipationFacts provider={provider} />
        </section>

        <nav className="provider-section-nav" aria-label="Facility record sections">
          <a href="#overview">Overview</a>
          {ownership && <a href="#ownership">Ownership</a>}
          {chain && <a href="#chain">Chain</a>}
          {regulatory && <a href="#inspections">Inspections</a>}
          {regulatory && <a href="#penalties">Penalties</a>}
          {regulatory && <a href="#history">History</a>}
          {staffing && <a href="#staffing">Staffing</a>}
          <a href="#sources">Sources</a>
        </nav>

        {ownership && <OwnershipIntelligence intelligence={ownership} />}
        {chain && <ChainIntelligence chain={chain} facility />}
        {regulatory && <RegulatoryIntelligence intelligence={regulatory} ownership={ownership} />}
        {staffing && (
          <StaffingIntelligence
            intelligence={staffing}
            cmsStaffingRating={provider.ratings.staffing}
          />
        )}

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
            <p className="eyebrow">Planned evidence layers</p>
            <h2 id="future-sources-title">Additional public-source research</h2>
            <p>
              These areas require separate authoritative CMS datasets. No findings are shown until
              those sources are ingested and reviewed.
            </p>
          </div>
          <ul className="future-source-list">
            {additionalLayers
              .filter((layer) => !ownership || layer !== "Ownership intelligence")
              .filter((layer) => !chain || layer !== "Chain / portfolio intelligence")
              .map((layer) => (
                <li key={layer}>{layer}</li>
              ))}
          </ul>
        </section>

        <section
          className="profile-section source-register"
          id="sources"
          aria-labelledby="real-source-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Source register</p>
            <h2 id="real-source-title">See where this record came from</h2>
          </div>
          <FacilitySourceRegister
            provider={provider}
            regulatory={regulatory}
            staffing={staffing}
            ownership={ownership}
            chain={chain}
          />
          <p className="independence-statement">
            No paid placements. Facilities cannot pay to rank higher. We cite. You decide.
          </p>
        </section>
      </div>
    </div>
  );
}
