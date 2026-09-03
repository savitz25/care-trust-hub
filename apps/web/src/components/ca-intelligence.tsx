import {
  CA_SOURCE_CATALOG,
  formatHubCount,
  caTraceMetrics,
  type CaPublicSnapshot,
  type CaTraceMetric,
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

function Trace({ metric }: { metric: CaTraceMetric }) {
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

export function CaIntelligenceView({ intel }: { intel: CaPublicSnapshot }) {
  const traces = caTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const snf = intel.crosswalk.snf;
  const hha = intel.crosswalk.homeHealth;
  const hospice = intel.crosswalk.hospice;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="ca-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="ca-scale-title">Source families, not one California senior total</h2>
          <p>
            Each tile is its own regulator file. Counts are not added together. A county on these
            records is a facility address county, not a service area.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CDPH ELMS locations"
            value={formatHubCount(intel.elms.source_row_count)}
            note={`${intel.elms.byType.length} official types · as of ${intel.elms.source_as_of}`}
          />
          <Stat
            label="CCLD RCFE rows"
            value={formatHubCount(intel.rcfe.source_row_count)}
            note={`LICENSED ${formatHubCount(intel.rcfe.licensed)} · as of ${intel.rcfe.source_as_of}`}
          />
          <Stat
            label="HCAI current listing"
            value={formatHubCount(intel.hcai.source_row_count)}
            note={`Open ${formatHubCount(intel.hcai.open)} · as of ${intel.hcai.source_as_of}`}
          />
          <Stat
            label="Home Care Organizations"
            value={formatHubCount(intel.hco.source_row_count)}
            note={`LICENSED ${formatHubCount(intel.hco.byStatus.find((row) => row.label === "LICENSED")?.count ?? 0)} · as of ${intel.hco.source_as_of}`}
          />
          <Stat
            label="CMS Nursing Homes in CA"
            value={formatHubCount(intel.cmsOverlay.nursingHomes)}
            note={`Independent overlay · as of ${intel.cmsOverlay.asOf}`}
          />
        </div>
        {trace("elms-rows") ? <Trace metric={trace("elms-rows")!} /> : null}
        {trace("rcfe-licensed") ? <Trace metric={trace("rcfe-licensed")!} /> : null}
      </section>

      <section aria-labelledby="ca-findings-title">
        <div className="section-heading">
          <p className="eyebrow">What the files show</p>
          <h2 id="ca-findings-title">Source-backed findings</h2>
        </div>
        <ul className="hub-plain-list">
          <li>
            CDPH ELMS publishes facility phones on{" "}
            {formatHubCount(intel.elms.contact_fields.phone.present)} of{" "}
            {formatHubCount(intel.elms.source_row_count)} rows ({intel.elms.phonePct}%) and facility
            emails on {formatHubCount(intel.elms.contact_fields.email.present)} rows (
            {intel.elms.emailPct}
            %). That is a government-listed facility contact, not a verified endorsement.
          </li>
          <li>
            CCLD RCFE as of {intel.rcfe.source_as_of}: {formatHubCount(intel.rcfe.licensed)}{" "}
            LICENSED, {formatHubCount(intel.rcfe.closed)} CLOSED,{" "}
            {formatHubCount(intel.rcfe.pending)} PENDING, {formatHubCount(intel.rcfe.onProbation)}{" "}
            ON PROBATION. This is not a current September 2026 RCFE count and is not a
            skilled-nursing universe.
          </li>
          <li>
            ELMS source types include {formatHubCount(intel.elms.homeHealth)} Home Health Agency,{" "}
            {formatHubCount(intel.elms.hospice)} Hospice, and {formatHubCount(intel.elms.snf)}{" "}
            Skilled Nursing Facility rows. Those classes stay separate from RCFE and from CMS
            overlays.
          </li>
          <li>
            Exact padded CCN matches for Skilled Nursing: {formatHubCount(snf.exact_matches)} of{" "}
            {formatHubCount(snf.source_native_ccns)} source-native CCNs against{" "}
            {formatHubCount(snf.cms_rows)} CMS Nursing Home CCNs. Name and city are not used.
          </li>
        </ul>
      </section>

      <section aria-labelledby="ca-elms-title">
        <div className="section-heading">
          <p className="eyebrow">CDPH ELMS</p>
          <h2 id="ca-elms-title">Licensed and certified healthcare facility locations</h2>
          <p>
            FACID is the CDPH identity. LICENSE_STATUS ACTIVE is{" "}
            {formatHubCount(intel.elms.activeLicenseStatus)}. FAC_STATUS OPEN is{" "}
            {formatHubCount(intel.elms.openFacStatus)}. OPEN is not automatically ACTIVE.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="ACTIVE license status"
            value={formatHubCount(intel.elms.activeLicenseStatus)}
          />
          <Stat
            label="Facility phones"
            value={`${formatHubCount(intel.elms.contact_fields.phone.present)} (${intel.elms.phonePct}%)`}
            note="Facility contact from California state record"
          />
          <Stat
            label="Facility emails"
            value={`${formatHubCount(intel.elms.contact_fields.email.present)} (${intel.elms.emailPct}%)`}
            note={`As of ${intel.elms.source_as_of}`}
          />
        </div>
        {trace("elms-active") ? <Trace metric={trace("elms-active")!} /> : null}
        {trace("elms-phone") ? <Trace metric={trace("elms-phone")!} /> : null}
        {trace("elms-email") ? <Trace metric={trace("elms-email")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Official ELMS facility types. All source types are preserved.</caption>
            <thead>
              <tr>
                <th scope="col">Official type</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              {intel.elms.byType.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ca-rcfe-title">
        <div className="section-heading">
          <p className="eyebrow">CCLD RCFE · as of {intel.rcfe.source_as_of}</p>
          <h2 id="ca-rcfe-title">Residential Care Facilities for the Elderly</h2>
          <p>
            RCFE is not SNF. LICENSED is not CMS certified. ON PROBATION is the official CCLD
            wording, not a SeniorTrustHub quality score. County below is the facility address
            county.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="LICENSED" value={formatHubCount(intel.rcfe.licensed)} />
          <Stat label="CLOSED" value={formatHubCount(intel.rcfe.closed)} />
          <Stat label="PENDING" value={formatHubCount(intel.rcfe.pending)} />
          <Stat label="ON PROBATION" value={formatHubCount(intel.rcfe.onProbation)} />
        </div>
        {trace("rcfe-licensed") ? <Trace metric={trace("rcfe-licensed")!} /> : null}
        <p>
          Capacity is present on {formatHubCount(intel.rcfe.capacityRows)} rows
          {intel.rcfe.capacityMin != null && intel.rcfe.capacityMax != null
            ? ` (source values ${intel.rcfe.capacityMin}–${intel.rcfe.capacityMax})`
            : ""}
          . Phone is present on {formatHubCount(intel.rcfe.phonePresent)} rows. There is no email
          field.
        </p>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>
              LICENSED RCFE identities by facility address county. Not a county page.
            </caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">LICENSED rows</th>
              </tr>
            </thead>
            <tbody>
              {intel.rcfe.counties.map((row) => (
                <tr key={row.county}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ca-hco-title">
        <div className="section-heading">
          <p className="eyebrow">CCLD Home Care Organizations · as of {intel.hco.source_as_of}</p>
          <h2 id="ca-hco-title">Home care organizations stay out of home health</h2>
          <p>{intel.hco.note}</p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Home Care Organization statuses in the May 2025 CCLD extract.</caption>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              {intel.hco.byStatus.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ca-hcai-title">
        <div className="section-heading">
          <p className="eyebrow">HCAI · as of {intel.hcai.source_as_of}</p>
          <h2 id="ca-hcai-title">An independent facility-market listing</h2>
          <p>{intel.hcai.note} No phone or email fields.</p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>HCAI license categories. Not added to CDPH or CCLD.</caption>
            <thead>
              <tr>
                <th scope="col">License category</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              {intel.hcai.byCategory.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ca-cms-title">
        <div className="section-heading">
          <p className="eyebrow">CMS overlay and exact CCN joins</p>
          <h2 id="ca-cms-title">Federal directories stay independent</h2>
          <p>
            CMS class profiles remain on existing national CCN routes. This page does not mint
            California profile URLs from state rows or from name matching.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes (national overlay)"
            value={formatHubCount(intel.cmsOverlay.nursingHomes)}
            note={`as of ${intel.cmsOverlay.asOf}`}
          />
          <Stat
            label="CMS Home Health (national overlay)"
            value={formatHubCount(intel.cmsOverlay.homeHealth)}
          />
          <Stat
            label="CMS Hospice (national overlay)"
            value={formatHubCount(intel.cmsOverlay.hospice)}
            note={`Live CA CCN set ${formatHubCount(intel.cmsOverlay.liveDirectoryCaUniqueCcn.hospice ?? 0)}`}
          />
        </div>
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Exact padded CCN intersection. Name and city are unused.</caption>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">State rows</th>
                <th scope="col">CMS CCNs</th>
                <th scope="col">Native CCNs</th>
                <th scope="col">Exact matches</th>
                <th scope="col">Unmatched CDPH</th>
                <th scope="col">Unmatched CMS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Skilled Nursing</th>
                <td>{formatHubCount(snf.state_rows)}</td>
                <td>{formatHubCount(snf.cms_rows)}</td>
                <td>{formatHubCount(snf.source_native_ccns)}</td>
                <td>{formatHubCount(snf.exact_matches)}</td>
                <td>{formatHubCount(snf.unmatched_cdph)}</td>
                <td>{formatHubCount(snf.unmatched_cms)}</td>
              </tr>
              <tr>
                <th scope="row">Home Health</th>
                <td>{formatHubCount(hha.state_rows)}</td>
                <td>{formatHubCount(hha.cms_rows)}</td>
                <td>{formatHubCount(hha.source_native_ccns)}</td>
                <td>{formatHubCount(hha.exact_matches)}</td>
                <td>{formatHubCount(hha.unmatched_cdph)}</td>
                <td>{formatHubCount(hha.unmatched_cms)}</td>
              </tr>
              <tr>
                <th scope="row">Hospice</th>
                <td>{formatHubCount(hospice.state_rows)}</td>
                <td>{formatHubCount(hospice.cms_rows)}</td>
                <td>{formatHubCount(hospice.source_native_ccns)}</td>
                <td>{formatHubCount(hospice.exact_matches)}</td>
                <td>{formatHubCount(hospice.unmatched_cdph)}</td>
                <td>{formatHubCount(hospice.unmatched_cms)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {trace("snf-ccn-exact") ? <Trace metric={trace("snf-ccn-exact")!} /> : null}
        <p>
          Official ELMS–HCAI crosswalk: {formatHubCount(intel.crosswalk.hcaiElms.exact.rows)} rows,{" "}
          {formatHubCount(intel.crosswalk.hcaiElms.exact.elms_and_hcai)} exact ELMS_FACID↔HCAI_ID
          pairs, {formatHubCount(intel.crosswalk.hcaiElms.exact.elms_and_ccn)} exact ELMS_FACID↔CCN
          pairs, 0 one-to-many conflicts in this file.
        </p>
      </section>

      <section aria-labelledby="ca-depth-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="ca-depth-title">What each family can support</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>California evidence depth. Missing is unknown, not zero.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Agency</th>
                <th scope="col">Rows</th>
                <th scope="col">As of</th>
                <th scope="col">Grain</th>
                <th scope="col">Identity key</th>
                <th scope="col">Contact coverage</th>
                <th scope="col">Status coverage</th>
                <th scope="col">Profile attachment</th>
                <th scope="col">Coverage</th>
                <th scope="col">Limitations</th>
              </tr>
            </thead>
            <tbody>
              {CA_SOURCE_CATALOG.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.source}</th>
                  <td>{row.agency}</td>
                  <td>{row.rows == null ? "Unknown / not acquired" : formatHubCount(row.rows)}</td>
                  <td>{row.asOf ?? "Unknown"}</td>
                  <td>{row.grain}</td>
                  <td>{row.identityKey}</td>
                  <td>{row.contactCoverage}</td>
                  <td>{row.statusCoverage}</td>
                  <td>{row.profileAttachment}</td>
                  <td>{row.coverage}</td>
                  <td>{row.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="ca-gaps-title">
        <div className="section-heading">
          <p className="eyebrow">What we do not know</p>
          <h2 id="ca-gaps-title">Coverage gaps</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
        <p>
          Adult Residential ({formatHubCount(intel.arf.source_row_count)} rows) remains
          researched-not-published because it is not a senior-care denominator. State
          inspection/enforcement was not acquired as structured bulk. CMS inspection evidence stays
          on CMS class profiles.
        </p>
      </section>
    </div>
  );
}
