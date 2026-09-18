import {
  formatHubCount,
  ncTraceMetrics,
  type NcPublicSnapshot,
  type NcTraceMetric,
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

function Trace({ metric }: { metric: NcTraceMetric }) {
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

export function NcIntelligenceView({ intel }: { intel: NcPublicSnapshot }) {
  const traces = ncTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const ach = intel.adultCareHomes;
  const fch = intel.familyCareHomes;
  const nh = intel.nursingHomes;
  const cms = intel.cmsOverlay;
  const star = intel.starRatings;
  const penalties = intel.adultCarePenalties;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="nc-caveats-title">
        <div className="section-heading">
          <p className="eyebrow">Public page grain caveats</p>
          <h2 id="nc-caveats-title">
            Separate classes, not one North Carolina senior-facilities total
          </h2>
          <p>
            ACH ≠ FCH ≠ Nursing Home. Home Care ≠ Home Health ≠ Hospice. Adult Day ≠ residential
            facility. PACE ≠ facility license. CCRC ≠ licensed DHSR component. State license ≠ CMS.
            State Star Rating ≠ TrustHub rating. Inspection ≠ complaint. Penalty ≠ conviction.
            Missing ≠ zero. No Trust Score. No AggregateRating. No ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Adult Care Home licenses"
            value={formatHubCount(ach.NC_ADULT_CARE_HOME_ROWS)}
            note="DHSR listing 2026-07-30 · HAL identity · not Family Care"
          />
          <Stat
            label="Family Care Home licenses"
            value={formatHubCount(fch.NC_FAMILY_CARE_HOME_ROWS)}
            note="DHSR listing 2026-07-30 · FCL identity · not Adult Care"
          />
          <Stat
            label="Nursing Home licenses"
            value={formatHubCount(nh.NC_NURSING_HOME_ROWS)}
            note="DHSR listing 2026-09-09 · NH identity · not CMS"
          />
          <Stat
            label="Home Health listing rows"
            value={formatHubCount(intel.homeHealth.NC_HOME_HEALTH_ROWS)}
            note="Separate Home Health file 2026-08-20 · not Home Care"
          />
        </div>
        {trace("dhsr-ach") ? <Trace metric={trace("dhsr-ach")!} /> : null}
      </section>

      <section aria-labelledby="nc-star-title">
        <div className="section-heading">
          <p className="eyebrow">Official state rating evidence</p>
          <h2 id="nc-star-title">NC DHSR Star Rating</h2>
          <p>
            North Carolina DHSR publishes an official Star Rating for Adult Care Homes and Family
            Care Homes. Source: DHSR Adult Care / Family Care listings updated 2026-07-30, plus the
            ACLS Inspections, Ratings and Penalties search. Facility identity is the HAL or FCL
            license, joined to DHSR FID where the official search publishes it. Regulatory context:
            the rating is a DHSR inspection-based certificate, not a TrustHub score, not a ranking,
            and not an AggregateRating. Issue dates are on each facility worksheet; they are not in
            the listing file. TrustHub does not decide what the rating means for a consumer choice
            and does not select a winner.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="NC DHSR Star Rating listing observations"
            value={formatHubCount(star.NC_LATEST_STAR_OBSERVATIONS)}
            note="Numeric stars on the 2026-07-30 listings · N/A is missing, not zero"
          />
          <Stat
            label="Exact license↔FID attachments"
            value={formatHubCount(star.fidIndex.EXACT_LICENSE_FID_ATTACHMENTS)}
            note="Official county search index · not a ranked list"
          />
          <Stat
            label="Star Rating issue-date history"
            value="Search only"
            note="facility.asp worksheets · OPEN_SEARCH_ONLY"
          />
        </div>
        {trace("dhsr-star") ? <Trace metric={trace("dhsr-star")!} /> : null}
      </section>

      <section aria-labelledby="nc-in-home-title">
        <div className="section-heading">
          <p className="eyebrow">In-home and hospice classes</p>
          <h2 id="nc-in-home-title">
            Home Care All is mixed. Hospice and Home Health stay separate.
          </h2>
          <p>
            The DHSR “Home Care All” download has{" "}
            {formatHubCount(intel.homeCareAllMixed.NC_HOME_CARE_ALL_MIXED_ROWS)} rows and includes
            Home Health licenses. It is not a Home Care agency count. Use the separate Home Health
            listing ({formatHubCount(intel.homeHealth.NC_HOME_HEALTH_ROWS)}) and Hospice listing (
            {formatHubCount(intel.hospice.NC_HOSPICE_ROWS)}). Nursing Pool (
            {formatHubCount(intel.nursingPool.NC_NURSING_POOL_ROWS)}) is not Home Care.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Hospice listing rows"
            value={formatHubCount(intel.hospice.NC_HOSPICE_ROWS)}
            note="HOS licenses 2026-08-20"
          />
          <Stat
            label="Home Care All mixed-file rows"
            value={formatHubCount(intel.homeCareAllMixed.NC_HOME_CARE_ALL_MIXED_ROWS)}
            note="Not a Home Care agency census"
          />
          <Stat
            label="Nursing Pool licenses"
            value={formatHubCount(intel.nursingPool.NC_NURSING_POOL_ROWS)}
            note="NP identity · not Home Care"
          />
        </div>
      </section>

      <section aria-labelledby="nc-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal overlay</p>
          <h2 id="nc-cms-title">CMS North Carolina directories stay on CCN identity</h2>
          <p>
            CMS Nursing Home CCN is not a DHSR NH license. {formatHubCount(cms.nursingHomes)} CMS
            nursing homes versus {formatHubCount(nh.NC_NURSING_HOME_ROWS)} DHSR license rows is not
            a bridge. DHSR listings do not publish Medicare IDs, so exact state↔CMS bridges in this
            snapshot are 0. Matching counts are not a bridge.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in North Carolina"
            value={formatHubCount(cms.nursingHomes)}
          />
          <Stat
            label="CMS Home Health Agencies in North Carolina"
            value={formatHubCount(cms.homeHealth)}
          />
          <Stat
            label="CMS Hospice providers in North Carolina"
            value={formatHubCount(cms.hospice)}
          />
        </div>
        {trace("cms-nh") ? <Trace metric={trace("cms-nh")!} /> : null}
      </section>

      <section aria-labelledby="nc-adverse-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections, penalties, surveys</p>
          <h2 id="nc-adverse-title">Penalty is not a complaint and not a conviction</h2>
          <p>
            ACLS penalties imposed in the previous 36 months:{" "}
            {formatHubCount(penalties.NC_ADULT_CARE_PENALTY_ROWS)} rows /{" "}
            {formatHubCount(penalties.NC_ADULT_CARE_PENALTY_DISTINCT_EVENTS)} distinct events /{" "}
            {formatHubCount(penalties.NC_ADULT_CARE_PENALTY_DISTINCT_LICENSES)} licenses. Listed
            amount total ${penalties.NC_ADULT_CARE_PENALTY_AMOUNT_TOTAL.toLocaleString("en-US")} is
            not a quality score. Adult Care inspection event tables remain search-only. Nursing Home
            SOD index covers{" "}
            {formatHubCount(intel.nursingHomeSodIndex.NC_NURSING_HOME_SOD_INDEX_ROWS)} facilities
            with posted SODs; that is not the 423-license census and not a complete SOD document
            universe. Nursing-home complaints remain search-only. Missing is not zero.
          </p>
        </div>
      </section>

      <section aria-labelledby="nc-program-title">
        <div className="section-heading">
          <p className="eyebrow">Adult Day, PACE, CCRC</p>
          <h2 id="nc-program-title">
            Program and continuing-care classes are not facility licenses
          </h2>
          <p>
            Adult Day certified directory dated 2026-04-21:{" "}
            {formatHubCount(intel.adultDay.NC_ADULT_DAY_CENTER_ROWS)} centers /{" "}
            {formatHubCount(intel.adultDay.NC_ADULT_DAY_CERTIFIED_SLOTS)} certified slots. Combined
            ADC/ADH programs are not double-counted as two centers. PACE is{" "}
            {formatHubCount(intel.pace.NC_PACE_ORGANIZATIONS)} organizations and{" "}
            {formatHubCount(intel.pace.NC_PACE_LOCATIONS)} locations (13 NPIs); organization ≠
            location ≠ DHSR facility license. NCDOI licensed CCRC map lists{" "}
            {formatHubCount(intel.ccrc.NC_CCRC_MAP_COMMUNITIES)} communities; handbook identity rows{" "}
            {formatHubCount(intel.ccrc.NC_CCRC_HANDBOOK_ID_ROWS)}. CCRC is not the sum of DHSR
            campus components. Continuing Care at Home:{" "}
            {formatHubCount(intel.continuingCareAtHome.NC_CCAH_ROWS)} licensed programs, not added
            to CCRC counts. Multi-Unit Assisted Housing remains official search-only. Charlotte and
            Raleigh are not SeniorTrustHub intelligence routes.
          </p>
        </div>
      </section>

      <p className="hub-stat__note">
        No Trust Score. No AggregateRating. Missing and search-only evidence is unknown, not zero.
        Source clocks: ACH/FCH 2026-07-30; Home Care/Home Health/Hospice/Nursing Pool 2026-08-20;
        Nursing Home 2026-09-09; Adult Day 2026-04-21; PACE page 2026-02-18; CMS overlay 2026-08-27.
        retrievedAt is not sourceAsOf. Fingerprint {intel.fingerprint}.
      </p>
    </div>
  );
}
