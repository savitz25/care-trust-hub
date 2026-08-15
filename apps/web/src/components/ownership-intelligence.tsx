import type { CareOwnershipIntelligence, CareOwnershipSourceDisclosure } from "@/server/care/types";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  );

function OwnershipSource({ source }: { source: CareOwnershipSourceDisclosure }) {
  return (
    <details className="source-disclosure">
      <summary>View ownership source details</summary>
      <dl>
        <div>
          <dt>Source organization</dt>
          <dd>{source.sourceOrganization}</dd>
        </div>
        <div>
          <dt>Dataset</dt>
          <dd>{source.datasetName}</dd>
        </div>
        <div>
          <dt>CMS dataset identifier</dt>
          <dd>{source.cmsDatasetIdentifier}</dd>
        </div>
        <div>
          <dt>Source updated</dt>
          <dd>{source.sourceModifiedAt ? formatDate(source.sourceModifiedAt) : "Not reported"}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{formatDate(source.retrievedAt)}</dd>
        </div>
      </dl>
      <a href={source.officialSourceUrl} rel="noreferrer">
        View official CMS source
      </a>
    </details>
  );
}

const classificationLabels: Record<string, string> = {
  management_services_company: "Management services company",
  holding_company: "Holding company",
  investment_firm: "Investment firm",
  private_equity_company: "Private equity company",
  reit: "Real estate investment trust (REIT)",
  chain_home_office: "Chain / home office",
  parent_company: "Parent company",
};

export function OwnershipIntelligence({
  intelligence,
}: {
  intelligence: CareOwnershipIntelligence;
}) {
  const organizations = intelligence.parties.filter((party) => party.kind === "organization");
  const questions = [
    ...(organizations.length > 1
      ? [
          "CMS records list several organizations with ownership or control roles. Which entity is responsible for day-to-day operations at this facility?",
        ]
      : []),
    ...intelligence.changes
      .slice(0, 1)
      .map(
        (change) =>
          `CMS enrollment records show a ${change.changeTypeText.toLowerCase()} effective ${formatDate(change.effectiveDate)}. What operational or leadership changes followed that event?`,
      ),
    ...organizations
      .filter((party) => (party.connectedProviderCount ?? 0) > 1)
      .slice(0, 1)
      .map(
        (party) =>
          `CMS records connect ${party.displayName} to ${party.connectedProviderCount} facilities. Which policies and staffing decisions are managed centrally versus locally?`,
      ),
  ];
  const latest = intelligence.parties
    .map((party) => party.source.sourceModifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return (
    <section
      className="profile-section ownership-section"
      id="ownership"
      aria-labelledby="ownership-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Ownership</p>
        <h2 id="ownership-title">Who CMS records show is connected to this facility</h2>
        <p>
          These are CMS-published ownership disclosures. Medicare enrollment ownership and
          managerial-control information is reported by enrolled providers through CMS forms; it is
          not an independent determination of beneficial ownership.
        </p>
      </div>
      <dl className="real-fact-grid">
        <div>
          <dt>Reported parties</dt>
          <dd>{intelligence.parties.length}</dd>
        </div>
        <div>
          <dt>Organizations</dt>
          <dd>{organizations.length}</dd>
        </div>
        <div>
          <dt>Individuals</dt>
          <dd>{intelligence.parties.length - organizations.length}</dd>
        </div>
        <div>
          <dt>Latest ownership source update</dt>
          <dd>{latest ? formatDate(latest) : "Not reported"}</dd>
        </div>
      </dl>
      <div className="ownership-party-list">
        <h3>CMS-published ownership and control parties</h3>
        {intelligence.parties.length ? (
          <ul>
            {intelligence.parties.map((party) => {
              const flags = Object.entries(party.classifications)
                .filter(([key, value]) => value === true && classificationLabels[key])
                .map(([key]) => classificationLabels[key]);
              return (
                <li key={party.id}>
                  <h4>{party.displayName}</h4>
                  <p>
                    {party.kind === "organization" ? "Organization" : "Individual"} ·{" "}
                    {party.roleText}
                  </p>
                  {party.ownershipPercentage !== null && (
                    <p>Published ownership percentage: {party.ownershipPercentage}%</p>
                  )}
                  {party.associationDate && (
                    <p>Association date reported to CMS: {formatDate(party.associationDate)}</p>
                  )}
                  {flags.length > 0 && <p>CMS classifications: {flags.join(", ")}</p>}
                  {party.kind === "organization" && party.connectedProviderCount !== null && (
                    <p>
                      Other facilities connected through this exact CMS organization identity:{" "}
                      {Math.max(0, party.connectedProviderCount - 1)}
                      {party.connectedStates.length
                        ? ` across ${party.connectedStates.join(", ")}`
                        : ""}
                      .
                    </p>
                  )}
                  <OwnershipSource source={party.source} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No matched current ownership party records were found in the loaded CMS sources.</p>
        )}
      </div>
      {intelligence.changes.length > 0 && (
        <div className="ownership-changes">
          <h3>Ownership changes reported in CMS enrollment records</h3>
          <ol>
            {intelligence.changes.map((change) => (
              <li key={change.id}>
                <time dateTime={change.effectiveDate}>{formatDate(change.effectiveDate)}</time>
                <strong>{change.changeTypeText}</strong>
                <span>
                  {change.sellerName} to {change.buyerName}
                </span>
                <OwnershipSource source={change.source} />
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="methodology-note">
        <h3>What this means</h3>
        <p>
          Roles are shown as CMS publishes them. Different CMS sources can describe different
          enrollment, ownership, and control concepts, so TrustHub keeps each source-specific
          disclosure distinct.
        </p>
      </div>
      {questions.length > 0 && (
        <div className="staffing-questions">
          <h3>Questions to ask</h3>
          <ul>
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
