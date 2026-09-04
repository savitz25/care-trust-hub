import Link from "next/link";
import {
  AZ_SOURCE_CATALOG,
  formatHubCount,
  azTraceMetrics,
  type AzPublicSnapshot,
  type AzTraceMetric,
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

function Trace({ metric }: { metric: AzTraceMetric }) {
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

export function AzIntelligenceView({ intel }: { intel: AzPublicSnapshot }) {
  const traces = azTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const cms = intel.cmsOverlay;
  const cross = intel.crosswalk.stateNhToCmsNh;
  const counties = intel.geography.county_table.filter(
    (row) => row.al_home + row.al_center + row.afc + row.nh > 0,
  );

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="az-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="az-scale-title">Source families, not one Arizona senior-provider total</h2>
          <p>
            Assisted Living Homes, Assisted Living Centers, Adult Foster Care, CMS Nursing Homes,
            CMS Home Health, and CMS Hospice are not added together. A county on these records is a
            facility address county, not a service area.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Assisted Living Homes"
            value={formatHubCount(intel.assistedLivingHomes.rows)}
            note={`ADHS GIS · as of ${intel.adhsGis.run_date}`}
          />
          <Stat
            label="Assisted Living Centers"
            value={formatHubCount(intel.assistedLivingCenters.rows)}
            note={`ADHS GIS · as of ${intel.adhsGis.run_date}`}
          />
          <Stat
            label="Adult Foster Care"
            value={formatHubCount(intel.adultFosterCare.rows)}
            note={`ADHS GIS · as of ${intel.adhsGis.run_date}`}
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
        {trace("al-home") ? <Trace metric={trace("al-home")!} /> : null}
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
      </section>

      <section aria-labelledby="az-findings-title">
        <div className="section-heading">
          <p className="eyebrow">What the files show</p>
          <h2 id="az-findings-title">Source-backed findings</h2>
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

      <section aria-labelledby="az-regulate-title">
        <div className="section-heading">
          <p className="eyebrow">Question 1</p>
          <h2 id="az-regulate-title">What senior-care classes does Arizona license?</h2>
          <p>
            ADHS licenses Assisted Living Homes, Assisted Living Centers, Adult Foster Care, Adult
            Day Health Care, Nursing Homes, Home Health Agencies, and Hospice through separate
            bureaus. CMS separately certifies Nursing Homes, Home Health, and Hospice. Child care,
            developmental-disability group homes, and behavioral-health residential facilities are
            excluded from SeniorTrustHub core tiles.
          </p>
        </div>
      </section>

      <section aria-labelledby="az-al-title">
        <div className="section-heading">
          <p className="eyebrow">Questions 2–3</p>
          <h2 id="az-al-title">
            Assisted Living Homes, Centers, and Adult Foster Care stay separate
          </h2>
          <p>
            ADHS GIS Assisted Living Homes: {formatHubCount(intel.assistedLivingHomes.rows)}.
            Assisted Living Centers: {formatHubCount(intel.assistedLivingCenters.rows)}. Adult
            Foster Care: {formatHubCount(intel.adultFosterCare.rows)}. A Home is ten or fewer
            residents. A Center is eleven or more. Adult Foster Care is a distinct class. None of
            these is a Nursing Home. Adult Day Health Care (
            {formatHubCount(intel.adultDayHealth.rows)}) is non-residential and is not added to
            those residential counts.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Home phones / addresses"
            value={`${formatHubCount(intel.assistedLivingHomes.phone_nonempty)} / ${formatHubCount(intel.assistedLivingHomes.address_nonempty)}`}
            note="AZ_ADHS_FACILITY_PHONE / ADDRESS"
          />
          <Stat
            label="Center phones / addresses"
            value={`${formatHubCount(intel.assistedLivingCenters.phone_nonempty)} / ${formatHubCount(intel.assistedLivingCenters.address_nonempty)}`}
            note="AZ_ADHS_FACILITY_PHONE / ADDRESS"
          />
          <Stat
            label="Adult Foster Care"
            value={formatHubCount(intel.adultFosterCare.rows)}
            note="Kept separate from Homes, Centers, and Nursing Homes"
          />
        </div>
        {trace("al-center") ? <Trace metric={trace("al-center")!} /> : null}
        {trace("afc") ? <Trace metric={trace("afc")!} /> : null}
      </section>

      <section aria-labelledby="az-nh-title">
        <div className="section-heading">
          <p className="eyebrow">Question 4</p>
          <h2 id="az-nh-title">State Nursing Homes are not the CMS directory</h2>
          <p>
            ADHS Nursing Home GIS rows: {formatHubCount(intel.stateNursingHomes.rows)} (
            {formatHubCount(intel.stateNursingHomes.unique_license)} distinct LICENSE_NUMBER). CMS
            Arizona Nursing Homes: {formatHubCount(cms.nursingHomes)}. Exact MEDICARE_ID matches:{" "}
            {formatHubCount(cross.exact_matches)}. Unmatched state{" "}
            {formatHubCount(cross.unmatched_state)}; unmatched CMS{" "}
            {formatHubCount(cross.unmatched_cms)}. Name and city are not used.
          </p>
        </div>
        {trace("state-nh-cms-exact") ? <Trace metric={trace("state-nh-cms-exact")!} /> : null}
      </section>

      <section aria-labelledby="az-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Questions 5–6</p>
          <h2 id="az-cms-title">Which CMS-certified facilities can TrustHub research?</h2>
          <p>
            CMS Nursing Homes, Home Health, and Hospice in Arizona use existing national CCN routes.
            Live unique CCN counts reconcile to {formatHubCount(cms.nursingHomes)} /{" "}
            {formatHubCount(cms.homeHealth)} / {formatHubCount(cms.hospice)}. Home Health office
            address is not a service area. Hospice is not Home Health. State Home Health GIS rows:{" "}
            {formatHubCount(intel.stateHomeHealth.rows)}. State Hospice GIS rows:{" "}
            {formatHubCount(intel.stateHospice.rows)}.
          </p>
        </div>
        {trace("cms-hha-overlay") ? <Trace metric={trace("cms-hha-overlay")!} /> : null}
        {trace("cms-hospice-overlay") ? <Trace metric={trace("cms-hospice-overlay")!} /> : null}
      </section>

      <section aria-labelledby="az-enf-title">
        <div className="section-heading">
          <p className="eyebrow">Question 7</p>
          <h2 id="az-enf-title">What licensing-history and enforcement evidence is available?</h2>
          <p>
            AZ Care Check is {intel.azCareCheck.AZ_CARE_CHECK}. No CSV/API bulk was acquired.
            Interactive search is the official path and is not scraped. CMS Nursing Home inspection,
            deficiency, penalty, staffing, and ownership stay on exact CCN. A complaint is not a
            violation. A deficiency is not a quality rank. No action found is not a clean record.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.verifyAzCareCheck}>AZ Care Check</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.officialHub}>ADHS Public Health Licensing</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="az-added-title">
        <div className="section-heading">
          <p className="eyebrow">Question 8</p>
          <h2 id="az-added-title">What did Arizona actually add to SeniorTrustHub?</h2>
          <p>
            Net-new canonical organizations:{" "}
            {formatHubCount(intel.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS)}. Net-new ADHS
            state identities: {formatHubCount(intel.expansionLedger.NET_NEW_STATE_IDENTITIES)}.
            Existing organizations enriched by exact federal ID:{" "}
            {formatHubCount(intel.expansionLedger.EXISTING_ORGANIZATIONS_ENRICHED)}. New evidence
            rows in this snapshot: {formatHubCount(intel.expansionLedger.NEW_EVIDENCE_ROWS)}. CMS
            Arizona CCNs were already in the national graph. Crosswalk is not a new organization.
            Assisted Living identities are published as a state directory, not thousands of profile
            routes. The GIS clock is {intel.adhsGis.run_date}; current monthly Excel tables were not
            acquired.
          </p>
        </div>
        {trace("net-new-canonical") ? <Trace metric={trace("net-new-canonical")!} /> : null}
        {trace("net-new-state") ? <Trace metric={trace("net-new-state")!} /> : null}
      </section>

      <section aria-labelledby="az-geo-title">
        <div className="section-heading">
          <p className="eyebrow">Facility address counties</p>
          <h2 id="az-geo-title">County geography is not a ranking</h2>
          <p>
            County on the GIS record is a facility address county, not a service area, and not
            best/worst counties. This page does not create Arizona county routes.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>ADHS GIS counts by facility address county. Classes stay separate.</caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">AL Home</th>
                <th scope="col">AL Center</th>
                <th scope="col">Adult Foster Care</th>
                <th scope="col">Nursing Home</th>
              </tr>
            </thead>
            <tbody>
              {counties.map((row) => (
                <tr key={row.county}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.al_home)}</td>
                  <td>{formatHubCount(row.al_center)}</td>
                  <td>{formatHubCount(row.afc)}</td>
                  <td>{formatHubCount(row.nh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="az-depth-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="az-depth-title">What each source can support</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>Arizona source catalog. Missing is unknown, not zero.</caption>
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
              {AZ_SOURCE_CATALOG.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.source}</th>
                  <td>{row.agency}</td>
                  <td>{row.rows == null ? "—" : formatHubCount(row.rows)}</td>
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
