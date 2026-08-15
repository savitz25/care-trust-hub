import type {
  CareRegulatoryIntelligence,
  CareRegulatorySourceDisclosure,
} from "@/server/care/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function RegulatorySource({ source }: { source: CareRegulatorySourceDisclosure }) {
  return (
    <details className="source-disclosure">
      <summary>View source details</summary>
      <dl>
        <div>
          <dt>Dataset</dt>
          <dd>{source.datasetName}</dd>
        </div>
        <div>
          <dt>CMS dataset ID</dt>
          <dd>{source.cmsDatasetIdentifier}</dd>
        </div>
        <div>
          <dt>CMS source updated</dt>
          <dd>
            {source.sourceModifiedAt
              ? formatDate(source.sourceModifiedAt.slice(0, 10))
              : "Not reported"}
          </dd>
        </div>
        <div>
          <dt>CMS provider ID</dt>
          <dd>{source.providerIdentifier}</dd>
        </div>
        <div>
          <dt>Source record locator</dt>
          <dd>{source.sourceRecordLocator}</dd>
        </div>
      </dl>
      <a href={source.officialSourceUrl} rel="noreferrer">
        View official CMS source
      </a>
    </details>
  );
}

export function RegulatoryIntelligence({
  intelligence,
}: {
  intelligence: CareRegulatoryIntelligence;
}) {
  const latest = intelligence.inspections[0];
  const immediateJeopardy = latest?.findings.some(
    (finding) => finding.scopeSeverity.immediateJeopardy,
  );
  const questions = [
    ...intelligence.repeatTags.map(
      ({ tag, inspectionCount }) =>
        `CMS records show ${tag} in ${inspectionCount} inspections in the available record. What changes has the facility made to address this issue?`,
    ),
    ...(immediateJeopardy
      ? [
          "CMS records include an Immediate Jeopardy-level finding. What corrective actions were taken after that inspection?",
        ]
      : []),
    ...intelligence.penalties
      .filter((penalty) => penalty.penaltyType === "Fine")
      .slice(0, 1)
      .map(
        (penalty) =>
          `CMS records show a monetary penalty dated ${formatDate(penalty.penaltyDate)}. What changes were made after that enforcement action?`,
      ),
  ];
  return (
    <>
      <section
        className="profile-section profile-section--tint"
        id="inspections"
        aria-labelledby="inspections-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Inspections &amp; deficiencies</p>
          <h2 id="inspections-title">What CMS inspection records show</h2>
          <p>
            Scope and severity terms below are CMS classifications. They are not a TrustHub score.
          </p>
        </div>
        {latest ? (
          <article className="regulatory-summary">
            <h3>Latest recorded inspection</h3>
            <dl className="real-fact-grid">
              <div>
                <dt>Date</dt>
                <dd>{formatDate(latest.surveyDate)}</dd>
              </div>
              <div>
                <dt>Survey type</dt>
                <dd>{latest.surveyType}</dd>
              </div>
              <div>
                <dt>Linked findings</dt>
                <dd>{latest.findings.length}</dd>
              </div>
              <div>
                <dt>Highest linked CMS classification</dt>
                <dd>
                  {latest.highestScopeSeverity
                    ? `${latest.highestScopeSeverity.code} — ${latest.highestScopeSeverity.scope}; ${latest.highestScopeSeverity.severity}`
                    : "No linked health-deficiency finding in the loaded record"}
                </dd>
              </div>
            </dl>
            <RegulatorySource source={latest.source} />
          </article>
        ) : (
          <p>
            No inspection-date records were found for this provider in the currently loaded CMS
            dataset.
          </p>
        )}
        <div className="regulatory-list">
          {intelligence.inspections.map((inspection) => (
            <details key={inspection.id} className="regulatory-record">
              <summary>
                {formatDate(inspection.surveyDate)} — {inspection.surveyType} —{" "}
                {inspection.findings.length} linked finding
                {inspection.findings.length === 1 ? "" : "s"}
              </summary>
              {inspection.findings.length ? (
                <ul className="deficiency-list">
                  {inspection.findings.map((finding) => (
                    <li key={finding.id}>
                      <h4>
                        {finding.tag} — {finding.category ?? "CMS health deficiency"}
                      </h4>
                      <p>
                        {finding.officialDescription ??
                          "CMS did not publish a description in this release."}
                      </p>
                      <p>
                        <strong>CMS scope/severity {finding.scopeSeverity.code}:</strong>{" "}
                        {finding.scopeSeverity.scope}; {finding.scopeSeverity.severity}.
                      </p>
                      {finding.correctionStatus && (
                        <p>
                          Correction status: {finding.correctionStatus}
                          {finding.correctionDate ? ` (${formatDate(finding.correctionDate)})` : ""}
                        </p>
                      )}
                      <RegulatorySource source={finding.source} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No health-deficiency rows were deterministically linked to this inspection.</p>
              )}
            </details>
          ))}
        </div>
        {intelligence.repeatTags.length > 0 && (
          <div className="methodology-note">
            <h3>Tags appearing across inspections</h3>
            <ul>
              {intelligence.repeatTags.map(({ tag, inspectionCount }) => (
                <li key={tag}>
                  {tag} appears in {inspectionCount} linked inspections.
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="profile-section" id="penalties" aria-labelledby="penalties-title">
        <div className="section-heading">
          <p className="eyebrow">Penalties &amp; enforcement</p>
          <h2 id="penalties-title">CMS penalty records in the loaded three-year dataset</h2>
        </div>
        {intelligence.penalties.length ? (
          <ul className="penalty-list">
            {intelligence.penalties.map((penalty) => (
              <li key={penalty.id}>
                <h3>
                  {penalty.penaltyType} — {formatDate(penalty.penaltyDate)}
                </h3>
                {penalty.fineAmount && (
                  <p>
                    Published fine amount: $
                    {Number(penalty.fineAmount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                )}
                {penalty.paymentDenialDays !== null && (
                  <p>Payment denial length: {penalty.paymentDenialDays} days</p>
                )}
                <RegulatorySource source={penalty.source} />
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No penalty records were found for this provider in the currently loaded CMS Penalties
            dataset.
          </p>
        )}
      </section>

      <section
        className="profile-section profile-section--tint"
        id="history"
        aria-labelledby="history-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Facility history</p>
          <h2 id="history-title">Verified regulatory chronology</h2>
        </div>
        <ol className="regulatory-timeline">
          {intelligence.timeline.map((event) => (
            <li key={event.id}>
              <time dateTime={event.eventDate}>{formatDate(event.eventDate)}</time>
              <strong>{event.title}</strong>
              <span>{event.detail}</span>
            </li>
          ))}
        </ol>
      </section>

      {questions.length > 0 && (
        <section className="profile-section" aria-labelledby="questions-title">
          <div className="section-heading">
            <p className="eyebrow">Questions to ask</p>
            <h2 id="questions-title">Questions generated from the evidence above</h2>
          </div>
          <ul className="question-list">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
