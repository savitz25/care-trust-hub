import {
  formatHubCount,
  gaTraceMetrics,
  type GaPublicSnapshot,
  type GaTraceMetric,
} from "@care/domain";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: GaTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Agency clock: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
        <li>Source grain: {metric.sourceGrain}</li>
        <li>Coverage: {metric.coverageState}</li>
        <li>Limitation: {metric.caveat}</li>
      </ul>
    </details>
  );
}

export function GaIntelligenceView({ intel }: { intel: GaPublicSnapshot }) {
  const traces = gaTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const cms = intel.cmsOverlay;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="ga-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="ga-scale-title">CMS certification is not a Georgia license</h2>
          <p>
            Healthcare Facility Regulation Division at the Georgia Department of Community Health
            licenses state care settings. CMS certifies Nursing Homes, Home Health, and Hospice.
            Those directories are not added together, and neither directory is the department&apos;s
            program statements.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in Georgia"
            value={formatHubCount(cms.nursingHomes)}
            note={`Provider Information · source ${cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)} · not a DCH license`}
          />
          <Stat
            label="CMS Home Health in Georgia"
            value={formatHubCount(cms.homeHealth)}
            note={`Home Health Care Agencies · source ${cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Hospice in Georgia"
            value={formatHubCount(cms.hospice)}
            note={`Hospice General Information · source ${cms.clocks.hospice.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="Georgia state license rosters"
            value="Not acquired"
            note="Personal Care Home, Assisted Living Community, and the other state classes stay separate."
          />
        </div>
        {trace("cms-nh") ? <Trace metric={trace("cms-nh")!} /> : null}
        {trace("pch") ? <Trace metric={trace("pch")!} /> : null}
        {trace("alc") ? <Trace metric={trace("alc")!} /> : null}
      </section>

      <section className="hub-scale" aria-labelledby="ga-class-title">
        <div className="section-heading">
          <p className="eyebrow">Facility classes</p>
          <h2 id="ga-class-title">State classes stay separate</h2>
          <p>
            An Assisted Living Community ({intel.assistedLivingCommunities.regulation}) is a
            personal care home licensed for {intel.assistedLivingCommunities.minimumResidents} or
            more residents. A Personal Care Home ({intel.personalCareHomes.regulation}) is a
            different license. A Community Living Arrangement (
            {intel.communityLivingArrangements.regulation}) is supported with DBHDD funds. Adult Day
            Centers ({intel.adultDay.regulation}) are not residential. Private Home Care Providers (
            {intel.privateHomeCare.regulation}) are not CMS Home Health. A state nursing-home
            license ({intel.stateNursingHomeLicenses.regulation}) is not a CMS CCN.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="Personal Care Homes" value="Not acquired" note="Chapter 111-8-62 · state" />
          <Stat
            label="Assisted Living Communities"
            value="Not acquired"
            note="Chapter 111-8-63 · 25 or more residents · state"
          />
          <Stat
            label="Community Living Arrangements"
            value="Not acquired"
            note="Chapter 290-9-37 · state"
          />
          <Stat label="Adult Day Centers" value="Not acquired" note="Chapter 111-8-1 · state" />
          <Stat
            label="Private Home Care Providers"
            value="Not acquired"
            note="Chapter 111-8-65 · not CMS Home Health"
          />
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="ga-context-title">
        <div className="section-heading">
          <p className="eyebrow">Regulator statements, not hub totals</p>
          <h2 id="ga-context-title">Department figures are not TrustHub counts</h2>
          <p>{intel.programContext.statement}</p>
          <p>
            That sentence describes one program across four classes. It is not a Personal Care Home
            count, not an Assisted Living Community count, and not a TrustHub entity total. The page
            does not date the figure; retrieval on {intel.programContext.retrievedAt.slice(0, 10)}{" "}
            is not a license effective date.
          </p>
          <p>{intel.ltcStatement.statement}</p>
          <p>
            That long-term-care statement is not the {formatHubCount(cms.nursingHomes)} CMS Nursing
            Home directory rows in Georgia. The CMS source clock is{" "}
            {cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}. The department page does not
            publish a source date for 357. HFRD also describes division-wide oversight that includes
            hospitals and laboratories. That description is not a senior-care census.
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="ga-evidence-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence</p>
          <h2 id="ga-evidence-title">What was acquired, and what stops here</h2>
          <p>
            CMS Nursing Home profiles already carry federal inspection dates, ownership, and
            penalties on the CCN. Those clocks are CMS dates, not Georgia license dates. Source
            modified {cms.clocks.inspections.sourceModifiedAt.slice(0, 10)} for CMS inspection
            dates. HFRD inspection reports were not indexed and no PDFs were parsed (
            {intel.inspections.parsedPdfCount} parsed). Zero parsed files is not zero inspections.
            The official search remains{" "}
            <a href={intel.inspections.searchUrl} rel="noopener noreferrer">
              HFRD inspection report search
            </a>
            .
          </p>
          <p>
            Provider-level complaint records were not acquired. The{" "}
            <a href={intel.complaints.intakeUrl} rel="noopener noreferrer">
              complaint intake form
            </a>{" "}
            is not a dataset, and an inspection is not a complaint. Enforcement orders were not
            acquired. GaMap2Care is the official facility finder and did not expose a clean public
            data file on this pass, so state-only facilities are not listed here. Missing is not
            zero. Atlanta is a place, not a license system.
          </p>
          <p>
            No state license was joined to a CMS CCN. Name-only matching was not used. Existing CMS
            profiles stay on their CCN routes:{" "}
            <a href="/search?search=1&state=GA&class=nursing_home">nursing homes in Georgia</a>,{" "}
            <a href="/search?search=1&state=GA&class=home_health">home health in Georgia</a>, and{" "}
            <a href="/search?search=1&state=GA&class=hospice">hospice in Georgia</a>.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <a href={intel.regulatorMap.finderHub} rel="noopener noreferrer">
              HFRD Find a Facility
            </a>
          </li>
          <li>
            <a href={intel.regulatorMap.gaMap2Care} rel="noopener noreferrer">
              GaMap2Care
            </a>
          </li>
          <li>
            <a href={intel.regulatorMap.personalCareHomes} rel="noopener noreferrer">
              Personal Care Home program
            </a>
          </li>
          <li>
            <a href={intel.regulatorMap.privateHomeCare} rel="noopener noreferrer">
              Private Home Care program
            </a>
          </li>
          <li>
            <a href={intel.regulatorMap.longTermCare} rel="noopener noreferrer">
              Long Term Care program
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
