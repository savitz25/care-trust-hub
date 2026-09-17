import {
  formatHubCount,
  paTraceMetrics,
  type PaPublicSnapshot,
  type PaTraceMetric,
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

function Trace({ metric }: { metric: PaTraceMetric }) {
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

export function PaIntelligenceView({ intel }: { intel: PaPublicSnapshot }) {
  const traces = paTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const nh = intel.nursingHomes;
  const hh = intel.homeHealth;
  const hc = intel.homeCare;
  const cms = intel.cmsOverlay;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="pa-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="pa-scale-title">
            Provider classes, not one Pennsylvania senior-facilities total
          </h2>
          <p>
            DHS Personal Care Homes are not Assisted Living Residences. DOH nursing homes are not
            Home Health, not Home Care, and not Hospice. Adult Day Centers and LIFE/PACE are not
            residential license classes. No Trust Score. No AggregateRating. No ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="DOH nursing-home license rows"
            value={formatHubCount(nh.PA_NURSING_HOME_ROWS)}
            note="September 2026 licensure/ownership · PA-DOH-NCF"
          />
          <Stat
            label="DOH Home Health license rows"
            value={formatHubCount(hh.PA_HOME_HEALTH_ROWS)}
            note="Medicare-certified + licensed-only · not Home Care"
          />
          <Stat
            label="DOH Home Care license rows"
            value={formatHubCount(hc.PA_HOME_CARE_ROWS)}
            note="Agencies, agency/registry, and registry"
          />
          <Stat
            label="DOH Hospice license rows"
            value={formatHubCount(intel.hospice.PA_HOSPICE_ROWS)}
            note="Hospice is not Home Health"
          />
        </div>
        {trace("doh-nh") ? <Trace metric={trace("doh-nh")!} /> : null}
      </section>

      <section aria-labelledby="pa-pch-title">
        <div className="section-heading">
          <p className="eyebrow">DHS Personal Care Homes and Assisted Living</p>
          <h2 id="pa-pch-title">Current PCH and ALR rosters remain official search</h2>
          <p>
            The DHS Human Services Provider Directory is live search. This snapshot does not publish
            a current PCH or ALR facility count from that directory. The August 2026 PCH monthly
            report is an aggregate from the most recent inspection, which may be up to a year old.{" "}
            {formatHubCount(intel.pchMonthlyReport.PA_PCH_MONTHLY_REPORT_HOMES)} monthly-report
            homes are not PCH+ALR and are not facility identity records. Licensed capacity{" "}
            {formatHubCount(intel.pchMonthlyReport.PA_PCH_MONTHLY_LICENSED_CAPACITY)} is not{" "}
            {formatHubCount(intel.pchMonthlyReport.PA_PCH_MONTHLY_RESIDENTS)} residents.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="PCH monthly-report homes (Aug 2026)"
            value={formatHubCount(intel.pchMonthlyReport.PA_PCH_MONTHLY_REPORT_HOMES)}
            note="Not real-time · not a PCH roster"
          />
          <Stat label="Current PCH roster" value="Search only" note="OPEN_SEARCH_ONLY · not zero" />
          <Stat label="Current ALR roster" value="Search only" note="PCH is not ALR" />
        </div>
        {trace("pch-monthly") ? <Trace metric={trace("pch-monthly")!} /> : null}
      </section>

      <section aria-labelledby="pa-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal overlay</p>
          <h2 id="pa-cms-title">CMS Pennsylvania directories stay on CCN identity</h2>
          <p>
            CMS Nursing Home CCN is not a DOH facility ID. {formatHubCount(cms.nursingHomes)} CMS
            nursing homes versus {formatHubCount(nh.PA_NURSING_HOME_ROWS)} DOH license rows is not a
            bridge. Exact source-published 39xxxxx Medicare IDs: nursing homes{" "}
            {formatHubCount(intel.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES.nursing_home)}, Home
            Health Medicare{" "}
            {formatHubCount(intel.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES.home_health_medicare)},
            Hospice {formatHubCount(intel.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES.hospice)}. Home
            Care Medicare ID values are not CMS CCNs.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in Pennsylvania"
            value={formatHubCount(cms.nursingHomes)}
          />
          <Stat
            label="CMS Home Health Agencies in Pennsylvania"
            value={formatHubCount(cms.homeHealth)}
          />
          <Stat label="CMS Hospice providers in Pennsylvania" value={formatHubCount(cms.hospice)} />
        </div>
        {trace("cms-nh") ? <Trace metric={trace("cms-nh")!} /> : null}
      </section>

      <section aria-labelledby="pa-adverse-title">
        <div className="section-heading">
          <p className="eyebrow">Sanctions, surveys, inspections</p>
          <h2 id="pa-adverse-title">Sanctions are not surveys and not complaints</h2>
          <p>
            The DOH Q4 2025 sanctions PDF is a numbered-row extract with{" "}
            {formatHubCount(intel.nursingHomeSanctions.PA_NURSING_HOME_SANCTION_ROWS)} rows and{" "}
            {formatHubCount(intel.nursingHomeSanctions.PA_NURSING_HOME_UNIQUE_SANCTIONS)} unique
            facility-id + date matters. A sanction is not an inspection, not a complaint, and not a
            conviction. Statewide survey and DHS inspection tables remain search-only. Name-only
            adverse joins are unsafe. Exact profile attachments: 0.
          </p>
        </div>
      </section>

      <section aria-labelledby="pa-life-title">
        <div className="section-heading">
          <p className="eyebrow">Adult Day and LIFE/PACE</p>
          <h2 id="pa-life-title">Program centers are not facility license classes</h2>
          <p>
            Adult Day Centers remain official search/licensure. LIFE/PACE is a program network
            revised August 2026: {formatHubCount(intel.lifePace.PA_LIFE_PROVIDER_ROWS)} providers
            and {formatHubCount(intel.lifePace.PA_LIFE_CENTER_ROWS)} centers. LIFE participation is
            not a PCH, ALR, or nursing-home license. Philadelphia and Pittsburgh are not
            SeniorTrustHub intelligence routes.
          </p>
        </div>
      </section>

      <p className="hub-stat__note">
        No Trust Score. No AggregateRating. Missing and search-only evidence is unknown, not zero.
        Source clocks: DHH/NCF September 2026; PCH monthly August 2026; LIFE revised August 2026;
        sanctions PDF Q4 2025 compilation. retrievedAt is not sourceAsOf. Fingerprint{" "}
        {intel.fingerprint}.
      </p>
    </div>
  );
}
