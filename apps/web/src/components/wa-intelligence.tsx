import Link from "next/link";
import {
  WA_SOURCE_CATALOG,
  formatHubCount,
  waTraceMetrics,
  type WaPublicSnapshot,
  type WaTraceMetric,
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

function Trace({ metric }: { metric: WaTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
      <p>{metric.computation}</p>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Agency clock: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
        <li>Source grain: {metric.sourceGrain}</li>
        <li>Identity: see catalog row for this metric</li>
        <li>Coverage: {metric.coverageState}</li>
        <li>Limitation: {metric.caveat}</li>
      </ul>
    </details>
  );
}

export function WaIntelligenceView({ intel }: { intel: WaPublicSnapshot }) {
  const traces = waTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const cms = intel.cmsOverlay;
  const gis = intel.dshsGis;
  const nh = intel.stateNursingHomeSource.acquired;
  const cross = intel.crosswalk.stateNhToCmsNh;
  const counties = gis.profile.county_table;
  const coreCounties = counties
    .map((row) => ({
      county: row.county,
      AF: row.AF,
      BH: row.BH,
      EF: row.EF,
    }))
    .filter((row) => row.AF + row.BH + row.EF > 0)
    .sort((a, b) => b.AF + b.BH + b.EF - (a.AF + a.BH + a.EF));

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="wa-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="wa-scale-title">Source families, not one Washington senior-provider total</h2>
          <p>
            Adult Family Homes, Assisted Living Facilities, Enhanced Services Facilities, CMS
            Nursing Homes, CMS Home Health, and CMS Hospice are not added together. A county on
            these records is a facility address county, not a service area.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Adult Family Homes"
            value={formatHubCount(intel.adultFamilyHomes.count)}
            note={`DSHS GIS current · as of ${intel.asOf}`}
          />
          <Stat
            label="Assisted Living Facilities"
            value={formatHubCount(intel.assistedLiving.count)}
            note={`DSHS GIS current · FacilityType BH · as of ${intel.asOf}`}
          />
          <Stat
            label="CMS Nursing Homes"
            value={formatHubCount(cms.nursingHomes)}
            note={`Independent overlay · as of ${cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Home Health"
            value={formatHubCount(cms.homeHealth)}
            note={`Independent overlay · as of ${cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Hospice"
            value={formatHubCount(cms.hospice)}
            note={`Independent overlay · as of ${cms.clocks.hospice.sourceModifiedAt.slice(0, 10)}`}
          />
        </div>
        {trace("afh") ? <Trace metric={trace("afh")!} /> : null}
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
      </section>

      <section aria-labelledby="wa-findings-title">
        <div className="section-heading">
          <p className="eyebrow">What the files show</p>
          <h2 id="wa-findings-title">Source-backed findings</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.findings.map((finding) => (
            <li key={finding.id}>
              <strong>{finding.title}.</strong> {finding.summary} This does not mean{" "}
              {finding.doesNotMean.join("; ")}.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="wa-regulate-title">
        <div className="section-heading">
          <p className="eyebrow">Question 1</p>
          <h2 id="wa-regulate-title">What senior-care classes does Washington regulate?</h2>
          <p>
            DSHS Residential Care Services licenses Adult Family Homes, Assisted Living Facilities,
            Enhanced Services Facilities, and Nursing Homes. CMS separately certifies Nursing Homes,
            Home Health, and Hospice. Supported living (SL) and Group Training (GT) appear in the
            same residential GIS layer but are not public senior-care core tiles.
          </p>
        </div>
      </section>

      <section aria-labelledby="wa-afh-title">
        <div className="section-heading">
          <p className="eyebrow">Questions 2–4</p>
          <h2 id="wa-afh-title">
            Adult Family Homes, Assisted Living, and Nursing Homes stay separate
          </h2>
          <p>
            Current GIS Adult Family Homes: {formatHubCount(intel.adultFamilyHomes.count)}. Current
            GIS Assisted Living Facilities: {formatHubCount(intel.assistedLiving.count)}. Enhanced
            Services Facilities: {formatHubCount(intel.enhancedServices.count)}. AFH is a small
            licensed home. ALF is a community assisted-living facility. A nursing home is a
            different DSHS license and, when Medicare/Medicaid certified, a CMS CCN. ALF is not SNF.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="AFH facility phones"
            value={`${formatHubCount(intel.adultFamilyHomes.phone_nonempty)} / ${formatHubCount(intel.adultFamilyHomes.count)}`}
            note="WA_DSHS_FACILITY_PHONE"
          />
          <Stat
            label="ALF facility phones"
            value={`${formatHubCount(intel.assistedLiving.phone_nonempty)} / ${formatHubCount(intel.assistedLiving.count)}`}
            note="WA_DSHS_FACILITY_PHONE"
          />
          <Stat
            label="Enhanced Services Facilities"
            value={formatHubCount(intel.enhancedServices.count)}
            note="Kept separate from Assisted Living"
          />
        </div>
        {trace("alf") ? <Trace metric={trace("alf")!} /> : null}
        {trace("esf") ? <Trace metric={trace("esf")!} /> : null}
      </section>

      <section aria-labelledby="wa-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Question 5</p>
          <h2 id="wa-cms-title">Which CMS-certified facilities can TrustHub research?</h2>
          <p>
            CMS Nursing Homes, Home Health, and Hospice in Washington use existing national CCN
            routes. Live unique CCN counts reconcile to {formatHubCount(cms.nursingHomes)} /{" "}
            {formatHubCount(cms.homeHealth)} / {formatHubCount(cms.hospice)}. Home Health office
            address is not a service area. Hospice is not Home Health.
          </p>
        </div>
        {trace("cms-hha-overlay") ? <Trace metric={trace("cms-hha-overlay")!} /> : null}
        {trace("cms-hospice-overlay") ? <Trace metric={trace("cms-hospice-overlay")!} /> : null}
      </section>

      <section aria-labelledby="wa-enf-title">
        <div className="section-heading">
          <p className="eyebrow">Question 6</p>
          <h2 id="wa-enf-title">What inspection and enforcement data is available?</h2>
          <p>
            Statewide DSHS AFH/ALF/ESF inspection and enforcement bulk was not acquired as CSV/API
            this ticket ({intel.enforcement.state.result}). Locator inspection pages remain
            search-only and are not scraped. CMS Nursing Home inspection, deficiency, penalty,
            staffing, and ownership stay on exact CCN. A complaint is not a violation. A deficiency
            is not a quality rank.
          </p>
        </div>
      </section>

      <section aria-labelledby="wa-verify-title">
        <div className="section-heading">
          <p className="eyebrow">Questions 7–8</p>
          <h2 id="wa-verify-title">How to verify, and what remains unavailable</h2>
          <p>
            TrustHub’s snapshot is the current GIS extract ({gis.current_rule}) as of{" "}
            {intel.retrievedAt}. Live status is on DSHS locators. Current GIS record is not
            independently license-in-good-standing. Email and website are not in the residential
            GIS. Service areas are not in these files.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.verifyAfh}>DSHS Adult Family Home locator</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.verifyAlf}>DSHS Assisted Living locator</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.verifyNh}>DSHS Nursing Home locator</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="wa-nh-title">
        <div className="section-heading">
          <p className="eyebrow">State nursing homes</p>
          <h2 id="wa-nh-title">DSHS nursing-home GIS is not the CMS directory</h2>
          <p>
            Current DSHS NH GIS rows: {formatHubCount(nh.current_count)} (
            {formatHubCount(nh.loc_type.NF)} NF and {formatHubCount(nh.loc_type.IM)} IM). Distinct
            federal provider numbers: {formatHubCount(nh.unique_ccn)}. Exact matches to CMS Nursing
            Homes: {formatHubCount(cross.exact_matches)}. Unmatched state{" "}
            {formatHubCount(cross.unmatched_state)}; unmatched CMS{" "}
            {formatHubCount(cross.unmatched_cms)}. Name and city are not used.
          </p>
        </div>
        {trace("state-nh-cms-exact") ? <Trace metric={trace("state-nh-cms-exact")!} /> : null}
      </section>

      <section aria-labelledby="wa-geo-title">
        <div className="section-heading">
          <p className="eyebrow">Facility address counties</p>
          <h2 id="wa-geo-title">County geography is not a ranking</h2>
          <p>
            {formatHubCount(gis.profile.distinct_counties)} counties appear on current GIS rows.
            This is facility address county, not a service area, and not best/worst counties.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>
              Current DSHS GIS counts by facility address county. Classes stay separate.
            </caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">Adult Family Home</th>
                <th scope="col">Assisted Living</th>
                <th scope="col">Enhanced Services</th>
              </tr>
            </thead>
            <tbody>
              {coreCounties.map((row) => (
                <tr key={row.county}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.AF)}</td>
                  <td>{formatHubCount(row.BH)}</td>
                  <td>{formatHubCount(row.EF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="wa-depth-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="wa-depth-title">What each source can support</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>Washington source catalog. Missing is unknown, not zero.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Agency</th>
                <th scope="col">Count</th>
                <th scope="col">Identity</th>
                <th scope="col">Access</th>
                <th scope="col">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {WA_SOURCE_CATALOG.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.source}</th>
                  <td>{row.agency}</td>
                  <td>{row.rows == null ? "Unknown / not acquired" : formatHubCount(row.rows)}</td>
                  <td>{row.identityKey}</td>
                  <td>{row.access}</td>
                  <td>{row.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
