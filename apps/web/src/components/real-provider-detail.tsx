import Link from "next/link";
import type {
  CareProviderDetail,
  CareOwnershipIntelligence,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
  CareChainIntelligence,
  CarePublishedFacilityEnrichment,
  CareFacilityHistory,
  CareOwnershipOperationSummary,
  CareNhEvidence,
} from "@/server/care/types";
import { NursingHomeEvidencePanel } from "./nh-evidence-panel";
import type { PublishedStateIntelligence } from "@care/domain";
import { VerifiedPublicContact } from "./verified-public-contact";
import { StateLicenseOversight } from "./state-license-oversight";
import { FacilityHistory } from "./facility-history";
import { CMS_RATING_EXPLANATIONS, factualRatingObservations } from "@/server/care/consumer";
import { formatFreshnessLabels } from "@/server/care/freshness";
import { CmsStarRating, ParticipationFacts } from "./real-provider";
import { PrintButton } from "./print-button";
import { OwnershipIntelligence } from "./ownership-intelligence";
import { OwnershipOperation } from "./ownership-v2";
import { RegulatoryIntelligence } from "./regulatory-intelligence";
import { StaffingIntelligence } from "./staffing-intelligence";
import { ChainIntelligence } from "./chain-intelligence";
import { WhatToReview } from "./what-to-review";
import { RealDataNotice } from "./evidence";
import { facilityInterviewBuilderHref } from "./interview-builder-bridge";
import { WorkspaceAddButton } from "./workspace-add-button";
import { NhProfileIntelligence } from "./nh-profile-intelligence";
import { isProviderIntelV1, type NursingHomeProviderIntelligence } from "@care/domain";

const additionalLayers = ["Home health national spine", "Hospice national spine"];

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

function stateSourceSupports(intelligence: PublishedStateIntelligence): string {
  const parts = [intelligence.licenseLabel.toLowerCase()];
  if (intelligence.licenseStatus) parts.push("license status");
  if (intelligence.licenseType) parts.push("license type");
  if (intelligence.licensedCapacity) parts.push("state licensed capacity");
  if (intelligence.licensee) parts.push("licensee");
  if (intelligence.operator) parts.push("operator");
  if (intelligence.managementCompany) parts.push("management company");
  if (intelligence.administrator) parts.push("administrator");
  if (parts.length === 1) {
    const only = parts[0] ?? "state license";
    return `${only[0].toUpperCase()}${only.slice(1)} from the official state regulator`;
  }
  const last = parts.pop();
  return `${parts.join(", ")}, and ${last}. Separate from CMS certification, ratings, and ownership.`;
}

export function FacilitySourceRegister({
  provider,
  regulatory,
  staffing,
  ownership,
  chain,
  publishedEnrichment,
  stateIntelligence,
}: {
  provider: CareProviderDetail;
  regulatory?: CareRegulatoryIntelligence;
  staffing?: CareStaffingIntelligence;
  ownership?: CareOwnershipIntelligence;
  chain?: CareChainIntelligence;
  publishedEnrichment?: CarePublishedFacilityEnrichment;
  stateIntelligence?: PublishedStateIntelligence;
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
  if (
    publishedEnrichment &&
    (publishedEnrichment.website || publishedEnrichment.phone || publishedEnrichment.publicAlias)
  ) {
    const retrievedAt =
      publishedEnrichment.website?.resolvedAt ??
      publishedEnrichment.phone?.resolvedAt ??
      publishedEnrichment.publicAlias?.resolvedAt ??
      provider.source.freshness.retrievedAt;
    sources.push({
      key: "verified-public-listing",
      sourceOrganization: "Public facility listing",
      datasetName: "Verified public facility information",
      datasetIdentifier: "commercial-corroboration:public-listing",
      officialSourceUrl: "/sources",
      sourceModifiedAt: retrievedAt,
      retrievedAt,
      supports:
        "Independently verified public website, phone, or publicly used name. Not a CMS rating or regulatory status.",
    });
  }
  if (stateIntelligence?.licenseId) {
    sources.push({
      key: `state-regulator-${stateIntelligence.stateCode}`,
      sourceOrganization: stateIntelligence.regulator,
      datasetName: stateIntelligence.datasetName,
      datasetIdentifier: `state-regulator:${stateIntelligence.stateCode.toLowerCase()}`,
      officialSourceUrl: stateIntelligence.officialUrl,
      sourceModifiedAt: stateIntelligence.checkedAt,
      retrievedAt: stateIntelligence.checkedAt ?? provider.source.freshness.retrievedAt,
      coverage: `${stateIntelligence.licenseLabel} ${stateIntelligence.licenseId.value}`,
      supports: stateSourceSupports(stateIntelligence),
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
            {source.datasetIdentifier.startsWith("commercial-corroboration")
              ? "How sources work"
              : source.datasetIdentifier.startsWith("state-regulator:")
                ? "View official state source"
                : "View official CMS source"}
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
  providerContext = [],
  trustParticipation = false,
  publishedEnrichment,
  stateIntelligence,
  facilityHistory,
  ownershipOperation,
  interviewBuilderEnabled = false,
  workspaceEnabled = false,
  nhEvidence = null,
  nhIntel = null,
}: {
  provider: CareProviderDetail;
  regulatory?: CareRegulatoryIntelligence;
  staffing?: CareStaffingIntelligence;
  ownership?: CareOwnershipIntelligence;
  chain?: CareChainIntelligence;
  providerContext?: Array<{
    id: string;
    text: string;
    submittedAt: string;
    approvedAt: string;
    referencedSection: string | null;
  }>;
  trustParticipation?: boolean;
  publishedEnrichment?: CarePublishedFacilityEnrichment;
  stateIntelligence?: PublishedStateIntelligence;
  facilityHistory?: CareFacilityHistory;
  ownershipOperation?: CareOwnershipOperationSummary;
  interviewBuilderEnabled?: boolean;
  workspaceEnabled?: boolean;
  nhEvidence?: CareNhEvidence | null;
  nhIntel?: NursingHomeProviderIntelligence | null;
}) {
  const intel = nhIntel && isProviderIntelV1(nhIntel) ? nhIntel : null;
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
        <RealDataNotice />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/search">Search</Link>
          <span aria-hidden="true">/</span>
          <span>{provider.providerName}</span>
        </nav>
        <header className="facility-hero">
          <div>
            <p className="eyebrow">CMS nursing home</p>
            <h1>{provider.providerName}</h1>
            {publishedEnrichment?.publicAlias ? (
              <p className="lede">Also known publicly as {publishedEnrichment.publicAlias.value}</p>
            ) : null}
            <p className="lede">
              {[provider.location.city, provider.location.state].filter(Boolean).join(", ")}
            </p>
            <div className="facility-hero__meta">
              <span>CMS CCN {provider.ccn}</span>
              {provider.telephone ? <span>{provider.telephone}</span> : null}
              {intel ? (
                <span>
                  {intel.directory.projection === "KNOWN_NOT_CURRENT"
                    ? "Not listed in the current CMS nursing-home directory"
                    : "Listed in the current CMS nursing-home directory"}
                </span>
              ) : null}
              <span>{freshness.sourceUpdated}</span>
            </div>
            {interviewBuilderEnabled ? (
              <p>
                <Link href={facilityInterviewBuilderHref(provider.ccn)}>
                  Build questions for this facility →
                </Link>
              </p>
            ) : null}
            {workspaceEnabled ? <WorkspaceAddButton ccn={provider.ccn} /> : null}
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

        {intel ? <NhProfileIntelligence intel={intel} /> : null}

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

        {publishedEnrichment ? (
          <VerifiedPublicContact provider={provider} enrichment={publishedEnrichment} />
        ) : null}

        {stateIntelligence ? (
          <StateLicenseOversight provider={provider} intelligence={stateIntelligence} />
        ) : null}

        {nhEvidence ? <NursingHomeEvidencePanel evidence={nhEvidence} /> : null}

        <WhatToReview
          provider={provider}
          regulatory={regulatory}
          staffing={staffing}
          ownership={ownership}
          chain={chain}
        />

        <nav className="provider-section-nav" aria-label="Facility record sections">
          {intel ? <a href="#at-a-glance">CMS snapshot</a> : null}
          <a href="#overview">Overview</a>
          {intel ? <a href="#ownership-intel">Ownership</a> : null}
          {intel ? <a href="#chow-history">Ownership changes</a> : null}
          {ownership && <a href="#ownership">Ownership</a>}
          {ownershipOperation?.portfolio && <a href="#related-facilities">Related facilities</a>}
          {chain && <a href="#chain">Chain</a>}
          {regulatory && <a href="#inspections">Inspections</a>}
          {regulatory && <a href="#penalties">Penalties</a>}
          {(facilityHistory || regulatory) && <a href="#history">History</a>}
          {stateIntelligence ? <a href="#state-license">State license</a> : null}
          {staffing && <a href="#staffing">Staffing</a>}
          {publishedEnrichment &&
          (publishedEnrichment.website ||
            publishedEnrichment.phone ||
            publishedEnrichment.publicAlias ||
            provider.telephone) ? (
            <a href="#contact">Contact</a>
          ) : null}
          <a href="#sources">Sources</a>
        </nav>

        {ownershipOperation ? <OwnershipOperation summary={ownershipOperation} /> : null}
        {ownership && <OwnershipIntelligence intelligence={ownership} />}
        {chain && <ChainIntelligence chain={chain} facility />}
        {regulatory && (
          <RegulatoryIntelligence
            intelligence={regulatory}
            ownership={ownership}
            hideChronology={Boolean(facilityHistory)}
          />
        )}
        {facilityHistory ? <FacilityHistory history={facilityHistory} /> : null}
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
            {additionalLayers.map((layer) => (
              <li key={layer}>{layer} remains a separate CMS provider class, not this profile.</li>
            ))}
          </ul>
        </section>

        {providerContext.length > 0 && (
          <section
            className="profile-section provider-context"
            aria-labelledby="provider-context-title"
          >
            <div className="section-heading">
              <p className="eyebrow">Provider-supplied information</p>
              <h2 id="provider-context-title">Provider context</h2>
              <p>
                Submitted by a representative of the provider. These statements are separate from
                the CMS evidence above.
              </p>
            </div>
            {providerContext.map((item) => (
              <article key={item.id}>
                <p>{item.text}</p>
                <dl>
                  <div>
                    <dt>Referenced section</dt>
                    <dd>{item.referencedSection ?? "General facility profile"}</dd>
                  </div>
                  <div>
                    <dt>Approved for display</dt>
                    <dd>{sourceDate(item.approvedAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </section>
        )}

        {trustParticipation && (
          <section
            className="profile-section trust-participation"
            aria-labelledby="participation-title"
          >
            <div className="section-heading">
              <p className="eyebrow">Trust participation</p>
              <h2 id="participation-title">See something that needs correction?</h2>
              <p>
                Claims, corrections, and factual context are free. Submissions never replace CMS
                evidence or affect ranking.
              </p>
            </div>
            <div className="facility-card__actions">
              <Link
                className="button button--secondary"
                href={`/trust/correction?ccn=${provider.ccn}`}
              >
                Suggest a correction
              </Link>
              <Link
                className="button button--quiet"
                href={`/trust/source-concern?ccn=${provider.ccn}`}
              >
                Report a source-data concern
              </Link>
              <Link className="button button--quiet" href={`/trust/claim?ccn=${provider.ccn}`}>
                Represent this facility? Submit a profile claim
              </Link>
            </div>
            <Link href="/trust/corrections">How corrections work</Link>
          </section>
        )}

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
            publishedEnrichment={publishedEnrichment}
            stateIntelligence={stateIntelligence}
          />
          <p className="independence-statement">
            No paid placements. Facilities cannot pay to rank higher. We cite. You decide.
          </p>
        </section>
      </div>
    </div>
  );
}
