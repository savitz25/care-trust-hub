import {
  formatHubCount,
  ohTraceMetrics,
  type OhPublicSnapshot,
  type OhTraceMetric,
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

function Trace({ metric }: { metric: OhTraceMetric }) {
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

export function OhIntelligenceView({ intel }: { intel: OhPublicSnapshot }) {
  const traces = ohTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const nh = intel.nursingHomes;
  const rcf = intel.rcf;
  const cms = intel.cmsOverlay;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="oh-caveats-title">
        <div className="section-heading">
          <p className="eyebrow">Public page grain caveats</p>
          <h2 id="oh-caveats-title">Separate classes, not one Ohio senior-facilities total</h2>
          <p>
            Nursing Home ≠ Residential Care Facility. RCF is Ohio&apos;s formal assisted-living
            license class. State license ≠ CMS certification. Navigator quality/satisfaction is
            official evidence, not a TrustHub rating. Skilled ≠ nonmedical Home Health. Agency ≠
            nonagency. Home Health ≠ Hospice. PACE ≠ facility license. Medicaid waiver ≠ RCF
            license. Inspection ≠ complaint. Missing ≠ zero. No Trust Score. No AggregateRating. No
            ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="ODH nursing facility licenses"
            value={formatHubCount(nh.OH_NURSING_FACILITY_ROWS)}
            note={`OneSource ${nh.sourceAsOf} · OH##### · not CMS`}
          />
          <Stat
            label="ODH Residential Care Facility licenses"
            value={formatHubCount(rcf.OH_RCF_ROWS)}
            note={`OneSource ${rcf.sourceAsOf} · OHL##### · assisted living in consumer language`}
          />
          <Stat
            label="CMS Nursing Homes in Ohio"
            value={formatHubCount(cms.CMS_OH_NURSING_HOME_ROWS)}
            note="Federal overlay · not an ODH license census · not a bridge"
          />
          <Stat
            label="Exact ODH→CMS nursing-home bridges"
            value={formatHubCount(intel.crosswalk.EXACT_OH_STATE_TO_CMS_NURSING_HOME_BRIDGES)}
            note="Zero because OneSource has no CCN field · 923 vs 922 is not a match"
          />
        </div>
        {trace("odh-nh") ? <Trace metric={trace("odh-nh")!} /> : null}
        {trace("odh-rcf") ? <Trace metric={trace("odh-rcf")!} /> : null}
      </section>

      <section className="hub-scale" aria-labelledby="oh-nav-title">
        <div className="section-heading">
          <p className="eyebrow">Official comparison data</p>
          <h2 id="oh-nav-title">Long-Term Care Quality Navigator</h2>
          <p>
            Ohio Department of Aging publishes the Navigator as official comparison data. Coverage
            on this freeze: {intel.navigator.coverage}. It is not a TrustHub rating and is not
            AggregateRating markup. Quality measures are not a recommendation. Satisfaction survey
            periods stay on the Navigator clock, not a TrustHub clock.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Navigator nursing quality grains"
            value="Search only"
            note="Dashboard / Aging Compass · missing is not zero"
          />
          <Stat
            label="Navigator satisfaction grains"
            value="Search only"
            note="Official evidence · not AggregateRating"
          />
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="oh-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal overlay</p>
          <h2 id="oh-cms-title">CMS Ohio directories stay on CCN identity</h2>
          <p>
            CMS Nursing Home CCN is not an ODH license.{" "}
            {formatHubCount(cms.CMS_OH_NURSING_HOME_ROWS)} CMS nursing homes versus{" "}
            {formatHubCount(nh.OH_NURSING_FACILITY_ROWS)} ODH licenses is not a bridge. OneSource
            does not publish CCN, so exact state↔CMS bridges in this snapshot are 0. Matching
            counts are not a bridge.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in Ohio"
            value={formatHubCount(cms.CMS_OH_NURSING_HOME_ROWS)}
          />
          <Stat
            label="CMS Home Health Agencies in Ohio"
            value={formatHubCount(cms.CMS_OH_HOME_HEALTH_ROWS)}
          />
          <Stat
            label="CMS Hospice providers in Ohio"
            value={formatHubCount(cms.CMS_OH_HOSPICE_ROWS)}
          />
        </div>
        {trace("cms-nh") ? <Trace metric={trace("cms-nh")!} /> : null}
      </section>

      <section className="hub-scale" aria-labelledby="oh-adverse-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections, deficiencies, complaints</p>
          <h2 id="oh-adverse-title">Inspection is not a complaint and not a deficiency</h2>
          <p>
            ODH inspection events, nursing deficiencies, RCF violations, and complaints are kept as
            separate grains. None of those rows were frozen in bulk on this snapshot (
            {intel.inspections.coverage}; complaints {intel.complaints.coverage}). Do not add
            inspection + complaint + deficiency + enforcement into one adverse total. Missing is not
            zero.
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="oh-hh-title">
        <div className="section-heading">
          <p className="eyebrow">In-home, hospice, and program classes</p>
          <h2 id="oh-hh-title">Home Health, Hospice, PACE, Adult Day</h2>
          <p>
            Home Health agency/nonagency and skilled/nonmedical classes remain{" "}
            {intel.homeHealth.coverage} through the ODH Facility Listing extract. Hospice programs
            remain {intel.hospice.coverage}. License ≠ location. PACE is{" "}
            {intel.programs.OH_PACE_ROSTER_STATUS} and is not a facility license. Adult Day is{" "}
            {intel.programs.OH_ADULT_DAY_ROSTER_STATUS}. Assisted Living Medicaid Waiver is not the
            RCF license universe. Ownership is not facility identity.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Skilled Home Health agencies"
            value="Search only"
            note="Not nonmedical · not CMS"
          />
          <Stat label="Nonmedical Home Health" value="Search only" note="Not skilled · not CMS" />
          <Stat
            label="Hospice program licenses"
            value="Search only"
            note="License is not location"
          />
          <Stat label="PACE organizations" value="Search only" note="Not an ODH facility license" />
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="oh-clocks-title">
        <div className="section-heading">
          <p className="eyebrow">Source clocks</p>
          <h2 id="oh-clocks-title">There is no universal Ohio senior-care clock</h2>
          <p>
            Navigator source date, ODH license source date, inspection date, satisfaction survey
            period, quality-measure period, CMS sourceAsOf, Home Health license date, Hospice
            license date, PACE source date, retrievedAt, snapshotAsOf, and generatedAt stay
            separate.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="ODH nursing-home license source" value={nh.sourceAsOf} />
          <Stat label="ODH RCF license source" value={rcf.sourceAsOf} />
          <Stat label="Snapshot as-of" value={intel.clocks.snapshotAsOf} />
          <Stat
            label="Retrieved at"
            value={intel.clocks.retrievedAt}
            note="Retrieval is not the agency clock"
          />
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="oh-best-title">
        <div className="section-heading">
          <h2 id="oh-best-title">Ohio publishes evidence. TrustHub does not pick a winner.</h2>
          <p>
            Ohio publishes regulatory, compliance, and quality information. CMS publishes federal
            measures. The state Navigator provides comparison data. SeniorTrustHub does not rank
            nursing homes or Residential Care Facilities and does not publish a Trust Score.
          </p>
        </div>
      </section>

      <p>
        Official lookup: <a href={intel.regulatorMap.odhExtract}>ODH Facility Listing</a>
        {" · "}
        <a href={intel.regulatorMap.navigator}>Ohio Aging Compass / Navigator</a>
        {" · "}
        <a href={intel.regulatorMap.cmsCareCompare}>CMS Care Compare</a>
      </p>

      <p className="hub-stat__note">
        Snapshot {intel.version} · No Trust Score · No AggregateRating · Cleveland and Columbus are
        not SeniorTrustHub intelligence routes
      </p>
    </div>
  );
}
