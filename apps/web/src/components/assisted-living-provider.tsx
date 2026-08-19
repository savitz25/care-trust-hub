import Link from "next/link";
import {
  ASSISTED_LIVING_COVERAGE_NOTE,
  ASSISTED_LIVING_INSPECTION_GAP,
  CONSUMER_CATEGORY_LABELS,
  ORGANIZATION_ROLE_LABELS,
  assistedLivingStatusCopy,
  capacityLine,
  formatRetrievedDate,
  memoryCarePublicLabel,
  officialAssistedLivingDatasetName,
  officialAssistedLivingSourceUrl,
  publishedAssistedLivingPath,
  regulatorDisplayName,
  type AssistedLivingPublicProvider,
} from "@care/domain";
import { RealDataNotice } from "./evidence";
import { WorkspaceAddButton } from "./workspace-add-button";

export function AssistedLivingCoverageNote() {
  return <p className="al-coverage">{ASSISTED_LIVING_COVERAGE_NOTE}</p>;
}

export function AssistedLivingInspectionGap() {
  return <p className="al-gap">{ASSISTED_LIVING_INSPECTION_GAP}</p>;
}

export function AssistedLivingStatus({ provider }: { provider: AssistedLivingPublicProvider }) {
  const status = assistedLivingStatusCopy(provider);
  return (
    <div className={status.prominent ? "al-status al-status--prominent" : "al-status"}>
      {status.headline ? <strong>{status.headline}</strong> : null}
      <p>{status.detail}</p>
    </div>
  );
}

export function AssistedLivingCard({
  provider,
  workspaceEnabled = false,
}: {
  provider: AssistedLivingPublicProvider;
  workspaceEnabled?: boolean;
}) {
  const href = publishedAssistedLivingPath({
    stateCode: provider.stateCode,
    id: provider.id,
    officialName: provider.officialName,
  });
  const memory = memoryCarePublicLabel(provider.memoryDesignation);
  const status = assistedLivingStatusCopy(provider);
  const place = [provider.officialCity, provider.officialState ?? provider.stateCode]
    .filter(Boolean)
    .join(", ");
  return (
    <article className="facility-card al-card">
      <div>
        <p className="eyebrow">{CONSUMER_CATEGORY_LABELS[provider.consumerCategory]}</p>
        <h3>
          <Link href={href}>{provider.officialName}</Link>
        </h3>
        <p>{place}</p>
        <p>{provider.officialType}</p>
        <p>{capacityLine(provider.licensedCapacity)}</p>
        {memory ? <p>{memory}</p> : null}
        {status.headline ? <p>{status.headline}</p> : <p>{status.detail}</p>}
      </div>
      <p>
        <Link className="text-link" href={href}>
          View provider →
        </Link>
      </p>
      {workspaceEnabled ? (
        <WorkspaceAddButton provider={{ kind: "assisted_living", id: provider.id }} compact />
      ) : null}
    </article>
  );
}

export function AssistedLivingProviderDetail({
  provider,
  workspaceEnabled = false,
  interviewEnabled = false,
}: {
  provider: AssistedLivingPublicProvider;
  workspaceEnabled?: boolean;
  interviewEnabled?: boolean;
}) {
  const memory = memoryCarePublicLabel(provider.memoryDesignation);
  const sourceUrl = officialAssistedLivingSourceUrl(provider.stateCode);
  const place = [provider.officialCity, provider.officialState ?? provider.stateCode]
    .filter(Boolean)
    .join(", ");
  const interviewHref =
    provider.memoryDesignation === "explicit_memory_or_dementia_license" ||
    provider.memoryDesignation === "specialty_endorsement"
      ? `/tools/facility-tour-interview-builder?al=${provider.id}&setting=memory_care`
      : `/tools/facility-tour-interview-builder?al=${provider.id}&setting=assisted_living`;
  return (
    <article className="facility-profile al-profile">
      <RealDataNotice />
      <header className="facility-hero">
        <div>
          <p className="eyebrow">{CONSUMER_CATEGORY_LABELS[provider.consumerCategory]}</p>
          <h1>{provider.officialName}</h1>
          <p className="lede">
            {place}
            {provider.officialStreet ? ` · ${provider.officialStreet}` : ""}
          </p>
          <p>{provider.officialType}</p>
        </div>
        <div className="facility-hero__actions">
          {workspaceEnabled ? (
            <WorkspaceAddButton provider={{ kind: "assisted_living", id: provider.id }} />
          ) : null}
          {interviewEnabled ? (
            <Link className="button button--secondary" href={interviewHref}>
              Build interview questions →
            </Link>
          ) : null}
        </div>
      </header>
      <AssistedLivingStatus provider={provider} />
      <AssistedLivingCoverageNote />
      <AssistedLivingInspectionGap />

      <section className="facility-section" aria-labelledby="al-license">
        <h2 id="al-license">License and oversight</h2>
        <dl className="real-fact-grid">
          <div>
            <dt>Regulator</dt>
            <dd>{regulatorDisplayName(provider.stateCode)}</dd>
          </div>
          <div>
            <dt>License / facility ID</dt>
            <dd>{provider.licenseId ?? provider.sourceFacilityId}</dd>
          </div>
          <div>
            <dt>Licensed capacity</dt>
            <dd>{capacityLine(provider.licensedCapacity)}</dd>
          </div>
          <div>
            <dt>Official care type</dt>
            <dd>{provider.officialType}</dd>
          </div>
        </dl>
      </section>

      {memory ? (
        <section className="facility-section" aria-labelledby="al-memory">
          <h2 id="al-memory">Memory / dementia care</h2>
          <p>{memory}</p>
          <p>
            This label is shown only because the regulator published an explicit designation. It is
            not inferred from the facility name.
          </p>
        </section>
      ) : null}

      {provider.organizations.length > 0 ? (
        <section className="facility-section" aria-labelledby="al-orgs">
          <h2 id="al-orgs">Licensed organization / operation</h2>
          <dl className="real-fact-grid">
            {provider.organizations.map((party) => (
              <div key={`${party.role}-${party.name}`}>
                <dt>{ORGANIZATION_ROLE_LABELS[party.role]}</dt>
                <dd>{party.name}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="facility-section" aria-labelledby="al-sources">
        <h2 id="al-sources">Sources</h2>
        <dl>
          <div>
            <dt>Regulator</dt>
            <dd>{regulatorDisplayName(provider.stateCode)}</dd>
          </div>
          <div>
            <dt>Dataset</dt>
            <dd>{officialAssistedLivingDatasetName(provider.stateCode)}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>{formatRetrievedDate(provider.retrievedAt)}</dd>
          </div>
        </dl>
        {sourceUrl ? (
          <p>
            <a href={sourceUrl} rel="noreferrer">
              View official regulator source
            </a>
          </p>
        ) : null}
      </section>
    </article>
  );
}
