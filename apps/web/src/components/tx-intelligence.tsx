import Link from "next/link";
import {
  TX_SOURCE_CATALOG,
  formatHubCount,
  txTraceMetrics,
  type TxPublicSnapshot,
  type TxTraceMetric,
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

function Trace({ metric }: { metric: TxTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
      <p>{metric.computation}</p>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Agency clock: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
        <li>Source grain: {metric.sourceGrain}</li>
        <li>
          Numerator: {metric.numerator == null ? "Not a rate" : formatHubCount(metric.numerator)}
        </li>
        <li>
          Denominator:{" "}
          {metric.denominator == null ? "Not a share" : formatHubCount(metric.denominator)}
        </li>
        <li>Coverage: {metric.coverageState}</li>
        <li>Caveat: {metric.caveat}</li>
      </ul>
    </details>
  );
}

export function TxIntelligenceView({ intel }: { intel: TxPublicSnapshot }) {
  const traces = txTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const nf = intel.hhscNursingFacilities;
  const alf = intel.hhscAssistedLiving;
  const hcssa = intel.hhscHcssa;
  const cms = intel.cmsOverlay;
  const cross = intel.crosswalk.nfToCmsNh;
  const pas = hcssa.by_service.find((row) => row.label === "Personal Assistance Services")?.count;
  const licensedHh = hcssa.by_service.find(
    (row) => row.label === "Licensed Home Health Services",
  )?.count;
  const certifiedHh = hcssa.by_service.find(
    (row) => row.label === "Licensed and Certified Home Health Services",
  )?.count;
  const hospiceSvc = hcssa.by_service.find((row) => row.label === "Hospice")?.count;
  const typeA = alf.by_type.find((row) => row.label === "TYPE A")?.count;
  const typeB = alf.by_type.find((row) => row.label === "TYPE B")?.count;
  const typeC = alf.by_type.find((row) => row.label === "TYPE C")?.count;
  const nhCounties = intel.cmsCounties.nursingHomes;
  const topCounties = nhCounties.slice(0, 12);

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="tx-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="tx-scale-title">Source families, not one Texas senior-provider total</h2>
          <p>
            CMS Nursing Homes, CMS Home Health, CMS Hospice, Texas HHSC/TULIP, and state enforcement
            coverage are not added together. A county on these records is a facility address county,
            not a service area.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in Texas"
            value={formatHubCount(cms.nursingHomes)}
            note={`Independent overlay · as of ${cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Home Health in Texas"
            value={formatHubCount(cms.homeHealth)}
            note={`Independent overlay · as of ${cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Hospice in Texas"
            value={formatHubCount(cms.hospice)}
            note={`Independent overlay · as of ${cms.clocks.hospice.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="Texas HHSC / TULIP"
            value="Search-only"
            note="TULIP verifies a license. It is not a bulk roster count."
          />
          <Stat
            label="State enforcement coverage"
            value="Partial"
            note="Closure Excel acquired. Inspection/SOD bulk not acquired."
          />
        </div>
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
        {trace("tulip-roster") ? <Trace metric={trace("tulip-roster")!} /> : null}
      </section>

      <section aria-labelledby="tx-questions-title">
        <div className="section-heading">
          <p className="eyebrow">What this page answers</p>
          <h2 id="tx-questions-title">Texas senior-care research, class by class</h2>
        </div>
        <ol className="hub-plain-list">
          <li>
            <strong>What senior-care classes exist in Texas?</strong> HHSC Long-term Care Regulation
            licenses Nursing Facilities, Assisted Living (Type A / Type B / Type C as published),
            HCSSA (home health, hospice, and personal assistance), DAHS, ICF/IID, and other
            programs. PPECC is pediatric and is excluded here. CMS separately certifies Nursing
            Homes, Home Health, and Hospice.
          </li>
          <li>
            <strong>What CMS facilities can TrustHub research statewide?</strong>{" "}
            {formatHubCount(cms.nursingHomes)} Nursing Homes, {formatHubCount(cms.homeHealth)} Home
            Health agencies, and {formatHubCount(cms.hospice)} Hospice providers in the current
            national overlays.
          </li>
          <li>
            <strong>How do CMS and Texas HHSC differ?</strong> CMS CERTIFIED != STATE LICENSED. HHSC
            NF.xlsx lists {formatHubCount(nf.source_row_count)} active-license nursing facilities as
            of {nf.source_as_of}. That is not the CMS overlay.
          </li>
          <li>
            <strong>How do consumers verify a Texas assisted-living facility?</strong> Look the
            provider up in TULIP, then use the official HHSC ALF directory identity (Facility ID /
            License Number). ALF is not a skilled-nursing facility.
          </li>
          <li>
            <strong>What state facility data is bulk versus search-only?</strong> NF.xlsx, al.xlsx,
            and HHA.xlsx (HCSSA) are official Excel directories. TULIP is open search without login
            and is not scraped.
          </li>
          <li>
            <strong>What inspection/enforcement evidence is available?</strong> CMS Nursing Home
            inspection, deficiency, penalty, staffing, and ownership evidence stays on existing CCN
            profiles. HHSC closure workbooks are historical license actions. State SOD/penalty bulk
            was not acquired.
          </li>
          <li>
            <strong>What does the data not establish?</strong> It does not rank facilities, invent a
            combined Texas senior-provider total, treat missing as zero, or prove a service area
            from a facility address.
          </li>
        </ol>
      </section>

      <section aria-labelledby="tx-findings-title">
        <div className="section-heading">
          <p className="eyebrow">What the files show</p>
          <h2 id="tx-findings-title">Source-backed findings</h2>
        </div>
        <ul className="hub-plain-list">
          <li>
            CMS Texas overlays: {formatHubCount(cms.nursingHomes)} Nursing Homes,{" "}
            {formatHubCount(cms.homeHealth)} Home Health agencies, and {formatHubCount(cms.hospice)}{" "}
            Hospice providers. Live unique CCN sets reconcile to the same three counts. They are not
            one senior-provider total.
          </li>
          <li>
            HHSC NF.xlsx as of {nf.source_as_of}: {formatHubCount(nf.source_row_count)}{" "}
            active-license nursing facilities, {formatHubCount(nf.certified_yes)} with Facility
            Certified = YES. Exact padded Medicare Provider Number matches{" "}
            {formatHubCount(cross.exact_matches)} of {formatHubCount(cross.source_native_ccns)}{" "}
            native numbers against {formatHubCount(cross.cms_rows)} CMS Nursing Home CCNs. Name and
            city are unused.
          </li>
          <li>
            HHSC al.xlsx as of {alf.source_as_of}: {formatHubCount(alf.source_row_count)} Assisted
            Living Facilities (TYPE A {formatHubCount(typeA ?? 0)}, TYPE B{" "}
            {formatHubCount(typeB ?? 0)}, TYPE C {formatHubCount(typeC ?? 0)}). Alzheimer
            Certificate Number is present on {formatHubCount(alf.alzheimer_certificate)} rows. ALF
            != SNF.
          </li>
          <li>
            HCSSA HHA.xlsx as of {hcssa.source_as_of}: {formatHubCount(hcssa.source_row_count)}{" "}
            directory rows. Personal Assistance Services appears on {formatHubCount(pas ?? 0)} rows;
            Licensed Home Health Services on {formatHubCount(licensedHh ?? 0)}; Licensed and
            Certified Home Health Services on {formatHubCount(certifiedHh ?? 0)}; Hospice on{" "}
            {formatHubCount(hospiceSvc ?? 0)}. Those labels overlap and are not added. HOME HEALTH
            != PERSONAL ASSISTANCE.
          </li>
          <li>
            CMS Nursing Home address counties cover {formatHubCount(nhCounties.length)} of{" "}
            {formatHubCount(intel.cmsCounties.texasCountyCount)} Texas counties. Harris has{" "}
            {formatHubCount(topCounties[0]?.count ?? 0)} CMS Nursing Homes. County is not a service
            area and is not a county page.
          </li>
          <li>
            TULIP remains search-only. Excel directories are not a complete LTC universe covering
            DAHS, ICF/IID, and every HCSSA status. Missing is unknown, not zero.
          </li>
        </ul>
      </section>

      <section aria-labelledby="tx-research-title">
        <div className="section-heading">
          <p className="eyebrow">Research lanes</p>
          <h2 id="tx-research-title">Open the class that matches the evidence</h2>
        </div>
        <div className="hub-class-grid">
          <article className="hub-card">
            <p className="eyebrow">CMS Nursing Homes in Texas</p>
            <h3>{formatHubCount(cms.nursingHomes)} current</h3>
            <p>Not equivalent to HHSC NF.xlsx. Overlay as of {cms.asOf}.</p>
            <Link className="text-link" href="/search?search=1&state=TX">
              Research CMS Nursing Homes in Texas <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Home Health in Texas</p>
            <h3>{formatHubCount(cms.homeHealth)} current</h3>
            <p>Not equivalent to HCSSA. Office location is not a service area.</p>
            <Link className="text-link" href="/search?class=home_health&search=1&state=TX">
              Research CMS Home Health in Texas <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Hospice in Texas</p>
            <h3>{formatHubCount(cms.hospice)} current</h3>
            <p>HOSPICE != HOME HEALTH. Not an HCSSA hospice-service row total.</p>
            <Link className="text-link" href="/search?class=hospice&search=1&state=TX">
              Research CMS Hospice in Texas <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">Verify a Texas state provider</p>
            <h3>TULIP lookup</h3>
            <p>
              Public LTC Provider Search. No login. This page does not scrape TULIP and does not
              invent a TULIP roster count.
            </p>
            <a className="text-link" href={intel.tulip.search} rel="noopener noreferrer">
              Open TULIP LTC Provider Search <span aria-hidden="true">→</span>
            </a>
          </article>
        </div>
      </section>

      <section aria-labelledby="tx-hhsc-title">
        <div className="section-heading">
          <p className="eyebrow">HHSC bulk directories · as of {nf.source_as_of}</p>
          <h2 id="tx-hhsc-title">State license files stay class-separate</h2>
          <p>
            These Excel directories are official HHSC listings. They are not TULIP, not CMS, and not
            a complete Texas LTC roster. Hospital-based NF.xlsx (
            {formatHubCount(intel.hhscHospitalBasedNf.source_row_count)}) is a sibling file and is
            not added to NF.xlsx.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="HHSC nursing facilities"
            value={formatHubCount(nf.source_row_count)}
            note={`${formatHubCount(nf.certified_yes)} Facility Certified = YES`}
          />
          <Stat
            label="HHSC assisted living"
            value={formatHubCount(alf.source_row_count)}
            note={`${formatHubCount(alf.alzheimer_certificate)} Alzheimer Certificate No`}
          />
          <Stat
            label="HHSC HCSSA rows"
            value={formatHubCount(hcssa.source_row_count)}
            note="HHA.xlsx is the HCSSA filename, not CMS Home Health"
          />
        </div>
        {trace("hhsc-nf") ? <Trace metric={trace("hhsc-nf")!} /> : null}
        {trace("hhsc-alf") ? <Trace metric={trace("hhsc-alf")!} /> : null}
        {trace("hcssa-rows") ? <Trace metric={trace("hcssa-rows")!} /> : null}
        {trace("nf-ccn-exact") ? <Trace metric={trace("nf-ccn-exact")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>HCSSA service labels as published. Labels overlap and are not added.</caption>
            <thead>
              <tr>
                <th scope="col">Official service label</th>
                <th scope="col">Rows containing the label</th>
              </tr>
            </thead>
            <tbody>
              {hcssa.by_service.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          HCSSA license status in this extract:{" "}
          {hcssa.by_status.map((row) => `${row.label} ${formatHubCount(row.count)}`).join(" · ")}.
          ENFORCEMENT ACTION PEND is official HHSC status wording. It is not a TrustHub score and is
          not attached to CMS profiles from this page.
        </p>
      </section>

      <section aria-labelledby="tx-counties-title">
        <div className="section-heading">
          <p className="eyebrow">CMS Nursing Home geography</p>
          <h2 id="tx-counties-title">Address county, not a service area</h2>
          <p>
            {formatHubCount(nhCounties.length)} of{" "}
            {formatHubCount(intel.cmsCounties.texasCountyCount)} Texas counties have at least one
            CMS Nursing Home in this overlay. There are no /texas/county routes. CMS Home Health in
            this extract has no county field.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>
              CMS Nursing Homes by facility address county. Not a ranking and not a county page.
            </caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">CMS Nursing Homes</th>
              </tr>
            </thead>
            <tbody>
              {nhCounties.map((row) => (
                <tr key={row.county}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="tx-enforcement-title">
        <div className="section-heading">
          <p className="eyebrow">Inspection and enforcement</p>
          <h2 id="tx-enforcement-title">Federal CMS architecture plus HHSC closures</h2>
          <p>{intel.enforcement.note}</p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="NF closures workbook"
            value={formatHubCount(intel.enforcement.nfClosures.source_row_count)}
            note={`as of ${intel.enforcement.nfClosures.source_as_of}`}
          />
          <Stat
            label="ALF closures workbook"
            value={formatHubCount(intel.enforcement.alfClosures.source_row_count)}
            note={`as of ${intel.enforcement.alfClosures.source_as_of}`}
          />
          <Stat
            label="HCSSA closures workbook"
            value={formatHubCount(intel.enforcement.hcssaClosures.source_row_count)}
            note="Historical license actions, not a current roster"
          />
        </div>
        <p>
          CMS inspection, deficiency, penalty, staffing, and ownership evidence remains on existing
          Nursing Home CCN profiles using national definitions. No facility ranking. Inspection
          deficiency != quality rank. No deficiency found != clean record.
        </p>
      </section>

      <section aria-labelledby="tx-depth-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="tx-depth-title">What each family can support</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Texas evidence depth. Missing is unknown, not zero.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Agency</th>
                <th scope="col">Rows</th>
                <th scope="col">As of</th>
                <th scope="col">Grain</th>
                <th scope="col">Identity</th>
                <th scope="col">Access</th>
                <th scope="col">Publication</th>
                <th scope="col">Coverage</th>
                <th scope="col">Limitations</th>
              </tr>
            </thead>
            <tbody>
              {TX_SOURCE_CATALOG.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.source}</th>
                  <td>{row.agency}</td>
                  <td>{row.rows == null ? "Unknown / not acquired" : formatHubCount(row.rows)}</td>
                  <td>{row.asOf ?? "Unknown"}</td>
                  <td>{row.grain}</td>
                  <td>{row.identityKey}</td>
                  <td>{row.access}</td>
                  <td>{row.publication}</td>
                  <td>{row.coverage}</td>
                  <td>{row.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="tx-gaps-title">
        <div className="section-heading">
          <p className="eyebrow">What we do not know</p>
          <h2 id="tx-gaps-title">Coverage gaps</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
        <p>
          Child-care CCL operations (
          {formatHubCount(intel.childCareExclusion.datasets["bc5r-88dy"].row_count ?? 0)} rows) and
          CCL inspections (
          {formatHubCount(intel.childCareExclusion.datasets["m5q4-3y3d"].row_count ?? 0)} rows) are
          deliberately excluded. CHILD CARE DATA != SENIOR CARE.
        </p>
      </section>
    </div>
  );
}
