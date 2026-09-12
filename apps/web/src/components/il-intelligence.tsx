import Link from "next/link";
import {
  formatHubCount,
  ilTraceMetrics,
  type IlPublicSnapshot,
  type IlTraceMetric,
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

function Trace({ metric }: { metric: IlTraceMetric }) {
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

export function IlIntelligenceView({ intel }: { intel: IlPublicSnapshot }) {
  const traces = ilTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const cms = intel.cmsOverlay;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="il-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="il-scale-title">Source families, not one Illinois senior-provider total</h2>
          <p>
            CMS Nursing Homes, IDPH Home Health licenses, IDPH Hospice programs, and HFS Supportive
            Living sites are not added together. A facility is not a license, not a CMS CCN, not an
            inspection, not a complaint, and not an administrator.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in Illinois"
            value={formatHubCount(cms.nursingHomes)}
            note={`CMS-certified providers · as of ${cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="IDPH licensed Home Health Agencies"
            value={formatHubCount(intel.idphHomeHealth.rows)}
            note={`State licenses · as of ${intel.idphHomeHealth.sourceAsOf}`}
          />
          <Stat
            label="HFS Supportive Living operational sites"
            value={formatHubCount(intel.supportiveLiving.operationalSites)}
            note={`Official PDF total · as of ${intel.supportiveLiving.sourceAsOf}`}
          />
          <Stat
            label="Current IDPH nursing-home license census"
            value="Search-only"
            note="LLCS lookup. Search-only is not zero."
          />
        </div>
        {trace("cms-nh") ? <Trace metric={trace("cms-nh")!} /> : null}
        {trace("state-nh") ? <Trace metric={trace("state-nh")!} /> : null}
      </section>

      <section aria-labelledby="il-nh-title">
        <div className="section-heading">
          <p className="eyebrow">Nursing homes / skilled nursing</p>
          <h2 id="il-nh-title">CMS Illinois nursing homes are the public headline grain</h2>
          <p>
            {formatHubCount(cms.nursingHomes)} CMS Nursing Home CCNs are in the accepted Illinois
            overlay. That is a federal certification directory, not a current IDPH license census.
            IDPH licenses, regulates, and inspects long-term care facilities and assists CMS with
            certification surveys. The live state listing is the{" "}
            <Link href={intel.regulatorMap.facilityLookup}>IDPH LLCS facility lookup</Link>. A
            2013-era GIS dump of 898 skilled-nursing rows is not a current roster and is not
            promoted to identity.
          </p>
        </div>
      </section>

      <section aria-labelledby="il-cms-title">
        <div className="section-heading">
          <p className="eyebrow">CMS federal certification</p>
          <h2 id="il-cms-title">Home Health and Hospice stay on their own CCN directories</h2>
          <p>
            CMS Home Health in Illinois: {formatHubCount(cms.homeHealth)}. CMS Hospice in Illinois:{" "}
            {formatHubCount(cms.hospice)}. These partitions already live in national CMS totals and
            are not added again. CMS CCN is not an IDPH license number. Exact CCN lookup still opens
            existing CMS routes, not /illinois.
          </p>
        </div>
        {trace("cms-hha") ? <Trace metric={trace("cms-hha")!} /> : null}
        {trace("cms-hospice") ? <Trace metric={trace("cms-hospice")!} /> : null}
      </section>

      <section aria-labelledby="il-idph-title">
        <div className="section-heading">
          <p className="eyebrow">State home-care licenses</p>
          <h2 id="il-idph-title">IDPH Home Health is not Home Nursing is not Home Services</h2>
          <p>
            Current IDPH Open Data directories (source as of 2026-04-28):{" "}
            {formatHubCount(intel.idphHomeHealth.rows)} Home Health licenses,{" "}
            {formatHubCount(intel.idphHomeNursing.rows)} Home Nursing licenses, and{" "}
            {formatHubCount(intel.idphHomeServices.rows)} Home Services licenses. Home Health
            requires skilled nursing plus another recognized service. Home Nursing is skilled
            nursing only. Home Services is not skilled home health. None of these rosters carry a
            CMS CCN, so EXACT_IL_STATE_TO_CMS_BRIDGES remains 0.
          </p>
        </div>
        {trace("idph-hha") ? <Trace metric={trace("idph-hha")!} /> : null}
      </section>

      <section aria-labelledby="il-hospice-title">
        <div className="section-heading">
          <p className="eyebrow">Hospice</p>
          <h2 id="il-hospice-title">Hospice programs are not hospice residences</h2>
          <p>
            IDPH currently lists {formatHubCount(intel.idphHospice.rows)} licensed Hospice programs
            and {formatHubCount(intel.idphHospiceResidence.rows)} Hospice Residences. A residence is
            a separately licensed 16-bed-cap building operated by a comprehensive hospice program.
            CMS Hospice certification is independent of state licensure.
          </p>
        </div>
        {trace("idph-hospice") ? <Trace metric={trace("idph-hospice")!} /> : null}
      </section>

      <section aria-labelledby="il-al-title">
        <div className="section-heading">
          <p className="eyebrow">Assisted living / shared housing</p>
          <h2 id="il-al-title">Assisted Living is not Shared Housing is not Supportive Living</h2>
          <p>
            Illinois distinguishes Assisted Living, Shared Housing, and other residential classes.
            No current official bulk roster was acquired. A stale 495-row listing with 2019–2020
            expirations is not a current identity file. Current verification is the IDPH LLCS
            facility lookup. Those classes are not summed and are not nursing homes.
          </p>
        </div>
      </section>

      <section aria-labelledby="il-slp-title">
        <div className="section-heading">
          <p className="eyebrow">Supportive Living Program</p>
          <h2 id="il-slp-title">HFS Supportive Living is a Medicaid program class</h2>
          <p>
            The official HFS operational list dated 2026-02-06 reports{" "}
            {formatHubCount(intel.supportiveLiving.operationalSites)} sites /{" "}
            {formatHubCount(intel.supportiveLiving.units)} units. Supportive Living != nursing home
            != assisted living != CMS SNF. Medicaid program participation is not a facility license.
          </p>
        </div>
        {trace("slp") ? <Trace metric={trace("slp")!} /> : null}
      </section>

      <section aria-labelledby="il-inspect-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections / surveys / deficiencies</p>
          <h2 id="il-inspect-title">Inspection is not deficiency is not complaint</h2>
          <p>
            State inspection files remain LLCS search-only. CMS survey, deficiency, penalty, and
            staffing evidence already on this hub stays on exact CMS CCNs and is reused, not
            recounted as new Illinois records. A complaint-triggered inspection is not a complaint
            count. Enforcement is not a criminal conviction. Count volume is not quality.
          </p>
        </div>
      </section>

      <section aria-labelledby="il-complaint-title">
        <div className="section-heading">
          <p className="eyebrow">Complaints / enforcement</p>
          <h2 id="il-complaint-title">Missing complaint bulk data is not zero complaints</h2>
          <p>
            IDPH operates a 24-hour Nursing Home Hotline ({intel.regulatorMap.hotline}) and an
            online complaint path. No structured statewide complaint observation file was acquired.
            A complaint is not a substantiated deficiency. Name-only attachment is unsafe.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.complaints}>IDPH health-care complaint information</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.facilityLookup}>File or look up a facility in LLCS</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="il-id-title">
        <div className="section-heading">
          <p className="eyebrow">How identities are matched</p>
          <h2 id="il-id-title">Source-native namespaces only</h2>
          <p>
            CMS:{"{CCN}"} remains the nursing-home identity on existing routes. Audited IDPH license
            namespaces: IL-IDPH-HHA, IL-IDPH-HOSPICE, IL-IDPH-HN, IL-IDPH-HS, and
            IL-IDPH-HOSPICE-RES. No current nursing-home or assisted-living namespace is created
            because those current rosters were not acquired. Name-only matching is unsafe. Name +
            address is review-required. Administrator licenses and the Health Care Worker Registry
            are person grains, not facilities. NHA != facility.
          </p>
        </div>
      </section>

      <section aria-labelledby="il-gaps-title">
        <div className="section-heading">
          <p className="eyebrow">Coverage / official verification</p>
          <h2 id="il-gaps-title">What this page does not claim</h2>
          <p>
            No Chicago or Cook intelligence routes. No combined Illinois senior-provider total. No
            Trust Score. No AggregateRating. No ranking of best or safest facilities.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.nursingHomes}>IDPH nursing homes</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.hfsSlp}>HFS Supportive Living Program</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.cmsCareCompare}>CMS Care Compare</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.workerRegistry}>
              Health Care Worker Registry (person grain)
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
