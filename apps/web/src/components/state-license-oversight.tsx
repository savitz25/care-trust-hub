import type { PublishedStateIntelligence } from "@care/domain";
import type { CareProviderDetail } from "@/server/care/types";

function formatCapacity(value: string): string {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return `${numeric.toLocaleString("en-US")} beds`;
  return value;
}

export function StateLicenseOversight({
  provider,
  intelligence,
}: {
  provider: CareProviderDetail;
  intelligence: PublishedStateIntelligence;
}) {
  return (
    <section
      className="state-license-oversight"
      id="state-license"
      aria-labelledby="state-license-title"
    >
      <div className="section-heading">
        <p className="eyebrow">State regulatory evidence</p>
        <h2 id="state-license-title">State License &amp; Oversight</h2>
        <p>
          {intelligence.regulator} is the state source for this license record. It does not replace
          CMS federal certification, ratings, or certified-bed counts.
        </p>
      </div>
      <p className="state-license-oversight__regulator">{intelligence.regulator}</p>
      <dl className="ownership-facts real-fact-grid state-license-oversight__facts">
        {intelligence.licenseId && (
          <div>
            <dt>{intelligence.licenseLabel}</dt>
            <dd>{intelligence.licenseId.value}</dd>
          </div>
        )}
        {intelligence.licenseStatus && (
          <div>
            <dt>License status</dt>
            <dd>{intelligence.licenseStatus.value}</dd>
          </div>
        )}
        {intelligence.licenseType && (
          <div>
            <dt>License type</dt>
            <dd>{intelligence.licenseType.value}</dd>
          </div>
        )}
        {intelligence.licensedCapacity && (
          <div>
            <dt>State licensed capacity</dt>
            <dd>
              {formatCapacity(intelligence.licensedCapacity.value)}
              {provider.certifiedBeds !== null ? (
                <small>CMS certified beds: {provider.certifiedBeds.toLocaleString("en-US")}</small>
              ) : null}
            </dd>
          </div>
        )}
        {intelligence.licensee && (
          <div>
            <dt>Licensee</dt>
            <dd>
              {intelligence.licensee.value}
              <small>
                Legal entity holding the state license — not automatically the owner or chain
              </small>
            </dd>
          </div>
        )}
        {intelligence.operator && (
          <div>
            <dt>Operator</dt>
            <dd>
              {intelligence.operator.value}
              <small>State-identified operator — not automatically the owner or chain</small>
            </dd>
          </div>
        )}
        {intelligence.managementCompany && (
          <div>
            <dt>Management company</dt>
            <dd>
              {intelligence.managementCompany.value}
              <small>
                State-identified management entity — not automatically the owner or chain
              </small>
            </dd>
          </div>
        )}
        {intelligence.administrator && (
          <div>
            <dt>Administrator</dt>
            <dd>
              {intelligence.administrator.value}
              <small>Named on the state license record</small>
            </dd>
          </div>
        )}
      </dl>
      <p className="state-license-oversight__freshness">
        {intelligence.checkedLabel ?? "State regulatory data checked"}
      </p>
      <p className="state-license-oversight__source">
        <a href="#sources">View source details</a>
        {" · "}
        <a href={intelligence.officialUrl} rel="noreferrer">
          Official {intelligence.stateCode} source
        </a>
      </p>
    </section>
  );
}
