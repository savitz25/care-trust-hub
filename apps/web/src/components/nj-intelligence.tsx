import Link from "next/link";
import {
  NJ_SOURCE_CATALOG,
  formatHubCount,
  njTraceMetrics,
  type NjPublicSnapshot,
  type NjTraceMetric,
} from "@care/domain";
import { NjFacilityInventory } from "./nj-facility-inventory";
import { NjMedicaidRates } from "./nj-medicaid-rates";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: NjTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
      <p>{metric.computation}</p>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Source date: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
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

export function NjIntelligenceView({ intel }: { intel: NjPublicSnapshot }) {
  const traces = njTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const latest = intel.staffing.trend.at(-1);
  const rnMax = Math.max(...intel.staffing.trend.map((row) => row.dayRn ?? 0), 1);
  const classRows = Object.entries(intel.enforcement.byClass);
  const yearRows = Object.entries(intel.enforcement.byYear);

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="nj-scale-title">
        <div className="section-heading">
          <p className="eyebrow">New Jersey licensed identities</p>
          <h2 id="nj-scale-title">Separate universes, not one senior-care total</h2>
          <p>
            NJDOH All_LTC and All_Acute are different licensed universes. CMS Nursing Home, Home
            Health, and Hospice overlays are different again. SeniorTrustHub does not add them into
            one senior-provider denominator and does not rank facilities.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="All_LTC licensed identities"
            value={formatHubCount(intel.ltc.rows)}
            note={`${intel.ltc.types} official types · as of ${intel.ltcAsOf}`}
          />
          <Stat
            label="All_Acute licensed identities"
            value={formatHubCount(intel.acute.rows)}
            note={`${intel.acute.types} official types · as of ${intel.acuteAsOf}`}
          />
          <Stat
            label="CMS Nursing Homes in NJ"
            value={formatHubCount(intel.cmsOverlay.nursingHomes)}
            note="Independent overlay · not added to All_LTC"
          />
        </div>
        {trace("ltc-rows") ? <Trace metric={trace("ltc-rows")!} /> : null}
        {trace("acute-rows") ? <Trace metric={trace("acute-rows")!} /> : null}
      </section>

      <section aria-labelledby="nj-ltc-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH All_LTC</p>
          <h2 id="nj-ltc-title">Long-term care licensed types</h2>
          <p>
            {formatHubCount(intel.ltc.rows)} current identities across {intel.ltc.types} official
            types and {intel.ltc.counties} counties. FacID is not a license number. Owner is not
            administrator.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Official All_LTC types. All 19 source types are preserved.</caption>
            <thead>
              <tr>
                <th scope="col">Official type</th>
                <th scope="col">Identities</th>
              </tr>
            </thead>
            <tbody>
              {intel.ltc.byType.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="nj-acute-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH All_Acute</p>
          <h2 id="nj-acute-title">Acute, Home Health, and Hospice stay uncombined</h2>
          <p>
            Home Health Agency offices are physical locations, not service areas. Hospice Program,
            Hospice Branch, and Hospice Inpatient are different types. A branch does not inherit a
            CCN from a program.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="Home Health Agency offices" value={formatHubCount(intel.acute.hha)} />
          <Stat label="Hospice Care Program" value={formatHubCount(intel.acute.hospiceProgram)} />
          <Stat label="Hospice Care Branch" value={formatHubCount(intel.acute.hospiceBranch)} />
          <Stat
            label="Hospice Care — Inpatient"
            value={formatHubCount(intel.acute.hospiceInpatient)}
          />
        </div>
        {trace("hha-offices") ? <Trace metric={trace("hha-offices")!} /> : null}
        {trace("hospice-program") ? <Trace metric={trace("hospice-program")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Official All_Acute types. All 26 source types are preserved.</caption>
            <thead>
              <tr>
                <th scope="col">Official type</th>
                <th scope="col">Identities</th>
              </tr>
            </thead>
            <tbody>
              {intel.acute.byType.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {intel.acute.invalidCountyRows > 0 ? (
          <p>
            {formatHubCount(intel.acute.invalidCountyRows)} All_Acute rows have a missing or invalid
            county. They remain in the statewide count and are not silently converted to zero or
            forced into a county.
          </p>
        ) : null}
      </section>

      <NjFacilityInventory />

      <section aria-labelledby="nj-county-title">
        <div className="section-heading">
          <p className="eyebrow">County intelligence</p>
          <h2 id="nj-county-title">Physical location by county, not a county product</h2>
          <p>
            These are licensed-identity locations in the current workbooks. They are not service
            areas, market rankings, or county pages.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>All 21 New Jersey counties. All_LTC and All_Acute stay separate.</caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">All_LTC</th>
                <th scope="col">SNF/NF</th>
                <th scope="col">ALR</th>
                <th scope="col">CPCH</th>
                <th scope="col">ALP</th>
                <th scope="col">All_Acute</th>
                <th scope="col">HHA office</th>
                <th scope="col">Hospice Program</th>
                <th scope="col">Hospice Branch</th>
                <th scope="col">Hospice Inpatient</th>
              </tr>
            </thead>
            <tbody>
              {intel.counties.map((row) => (
                <tr key={row.county}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.ltc)}</td>
                  <td>{formatHubCount(row.nfSnf)}</td>
                  <td>{formatHubCount(row.alr)}</td>
                  <td>{formatHubCount(row.cpch)}</td>
                  <td>{formatHubCount(row.alp)}</td>
                  <td>{formatHubCount(row.acute)}</td>
                  <td>{formatHubCount(row.hha)}</td>
                  <td>{formatHubCount(row.hospiceProgram)}</td>
                  <td>{formatHubCount(row.hospiceBranch)}</td>
                  <td>{formatHubCount(row.hospiceInpatient)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="nj-staff-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH staffing</p>
          <h2 id="nj-staff-title">Residents per one staff member, by role</h2>
          <p>
            {intel.staffing.semantics} Latest populated quarter: {intel.staffing.latest}.{" "}
            {formatHubCount(intel.staffing.populatedQuarters)} populated quarters from{" "}
            {intel.staffing.first} through {intel.staffing.latest}. RN, LPN, and CNA stay separate.
            Staffing is not copied onto {intel.staffing.notAttachedTo.join(", ")}.
          </p>
        </div>
        {latest ? (
          <div className="hub-stat-grid">
            <Stat
              label="Day RN residents per staff"
              value={String(latest.dayRn)}
              note={`${latest.label} · ${formatHubCount(latest.facilities)} reporting facilities`}
            />
            <Stat label="Day LPN residents per staff" value={String(latest.dayLpn)} />
            <Stat label="Day CNA residents per staff" value={String(latest.dayCna)} />
          </div>
        ) : null}
        {trace("staffing-latest-rn") ? <Trace metric={trace("staffing-latest-rn")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>
              Statewide day shift residents per one RN, LPN, or CNA. Higher means more residents per
              staff member.
            </caption>
            <thead>
              <tr>
                <th scope="col">Quarter</th>
                <th scope="col">Day RN</th>
                <th scope="col">Day LPN</th>
                <th scope="col">Day CNA</th>
                <th scope="col">Reporting facilities</th>
              </tr>
            </thead>
            <tbody>
              {intel.staffing.trend.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.dayRn}
                    <span className="hub-bar" aria-hidden="true">
                      <span
                        className="hub-bar__fill"
                        style={{ width: `${Math.min(100, (100 * (row.dayRn ?? 0)) / rnMax)}%` }}
                      />
                    </span>
                  </td>
                  <td>{row.dayLpn}</td>
                  <td>{row.dayCna}</td>
                  <td>{formatHubCount(row.facilities)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Quarters without a populated official report are omitted. Missing is not displayed as
          zero.
        </p>
      </section>

      <section aria-labelledby="nj-enf-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH enforcement</p>
          <h2 id="nj-enf-title">Occurrences, documents, and identity coverage</h2>
          <p>
            {formatHubCount(intel.enforcement.indexed)} indexed occurrences,{" "}
            {formatHubCount(intel.enforcement.downloaded)} downloaded files, and{" "}
            {formatHubCount(intel.enforcement.uniqueHashes)} unique content hashes. An occurrence is
            not a canonical unique document. Absence of an attached action is not a clean history.
            This is not an enforcement ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="Indexed occurrences" value={formatHubCount(intel.enforcement.indexed)} />
          <Stat
            label="Unique content hashes"
            value={formatHubCount(intel.enforcement.uniqueHashes)}
          />
          <Stat
            label="Exact facility matches"
            value={formatHubCount(intel.enforcement.matchBuckets.EXACT)}
            note={`${formatHubCount(intel.enforcement.exactFacilities)} unique LTC facilities`}
          />
        </div>
        {trace("enforcement-indexed") ? <Trace metric={trace("enforcement-indexed")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Official action classes among indexed occurrences</caption>
            <thead>
              <tr>
                <th scope="col">Action class</th>
                <th scope="col">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {classRows.map(([label, count]) => (
                <tr key={label}>
                  <th scope="row">{label.replaceAll("_", " ")}</th>
                  <td>{formatHubCount(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>
              Identity resolution buckets. Unresolved evidence is not profile-attached.
            </caption>
            <thead>
              <tr>
                <th scope="col">Match bucket</th>
                <th scope="col">Occurrences</th>
                <th scope="col">Profile treatment</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">EXACT</th>
                <td>{formatHubCount(intel.enforcement.matchBuckets.EXACT)}</td>
                <td>May attach when FacID or license is exact</td>
              </tr>
              <tr>
                <th scope="row">HIGH_CONFIDENCE</th>
                <td>{formatHubCount(intel.enforcement.matchBuckets.HIGH_CONFIDENCE)}</td>
                <td>Neutral attributes only unless separately approved</td>
              </tr>
              <tr>
                <th scope="row">REVIEW_REQUIRED</th>
                <td>{formatHubCount(intel.enforcement.matchBuckets.REVIEW_REQUIRED)}</td>
                <td>Withheld from profiles</td>
              </tr>
              <tr>
                <th scope="row">UNSAFE_REJECTED</th>
                <td>{formatHubCount(intel.enforcement.matchBuckets.UNSAFE_REJECTED)}</td>
                <td>Not attached</td>
              </tr>
              <tr>
                <th scope="row">UNRESOLVED</th>
                <td>{formatHubCount(intel.enforcement.matchBuckets.UNRESOLVED)}</td>
                <td>Not attached</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Indexed occurrences by document year (partial history)</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map(([year, count]) => (
                <tr key={year}>
                  <th scope="row">{year}</th>
                  <td>{formatHubCount(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Coverage state: {intel.enforcement.coverage}.{" "}
          {formatHubCount(intel.enforcement.unavailable)} indexed URLs were unavailable. This page
          does not currently attach unresolved or review-required documents to facility profiles.
        </p>
      </section>

      <NjMedicaidRates
        listedRows={intel.medicaid.listedRows}
        minRate={intel.medicaid.minRate}
        maxRate={intel.medicaid.maxRate}
        effectiveOn={intel.medicaid.effectiveOn}
      />
      {trace("medicaid-listed-rows") ? <Trace metric={trace("medicaid-listed-rows")!} /> : null}

      <section aria-labelledby="nj-pace-title">
        <div className="section-heading">
          <p className="eyebrow">PACE</p>
          <h2 id="nj-pace-title">Organizations, centers, and service geography</h2>
          <p>
            {formatHubCount(intel.pace.organizations)} organizations on the current DoAS listing:{" "}
            {formatHubCount(intel.pace.operatingOrganizations)} operating and{" "}
            {formatHubCount(intel.pace.awardedOrganizations)} awarded.{" "}
            {formatHubCount(intel.pace.operatingCenters)} operating centers. A center address is not
            a full service area. Partial counties remain partial.
          </p>
        </div>
        {trace("pace-organizations") ? <Trace metric={trace("pace-organizations")!} /> : null}
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>PACE organizations. Operating is not awarded.</caption>
            <thead>
              <tr>
                <th scope="col">Organization</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {intel.pace.organizationsList.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>PACE centers. Center city/county is not the full service area.</caption>
            <thead>
              <tr>
                <th scope="col">Center</th>
                <th scope="col">Organization</th>
                <th scope="col">City</th>
                <th scope="col">County</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {intel.pace.centers.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{row.org}</td>
                  <td>{row.city}</td>
                  <td>{row.county}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="hub-plain-list">
          {intel.pace.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nj-ccrc-title">
        <div className="section-heading">
          <p className="eyebrow">CCRC</p>
          <h2 id="nj-ccrc-title">Certificate of Authority roster is not in the public files</h2>
          <p>
            Coverage: {intel.ccrc.coverage}. The published CCRC count is <strong>Unknown</strong> —
            not zero. A missing roster is not converted into a zero community count.
          </p>
        </div>
        {trace("ccrc-roster") ? <Trace metric={trace("ccrc-roster")!} /> : null}
      </section>

      <section aria-labelledby="nj-cms-title">
        <div className="section-heading">
          <p className="eyebrow">CMS overlay</p>
          <h2 id="nj-cms-title">National CMS New Jersey counts stay class-separate</h2>
          <p>
            These CMS denominators are independently established from the national snapshot. They
            are not row-linked to NJDOH FacIDs in this publication. Exact CMS profile links require
            a CCN join that is not yet production-accessible here.
          </p>
        </div>
        <div className="hub-class-grid">
          <article className="hub-card">
            <p className="eyebrow">CMS Nursing Homes in New Jersey</p>
            <h3>{formatHubCount(intel.cmsOverlay.nursingHomes)} current</h3>
            <p>
              Not equivalent to All_LTC SNF/NF identities. Overlay as of {intel.cmsOverlay.asOf}.
            </p>
            <Link className="text-link" href="/search?search=1&state=NJ">
              Research CMS Nursing Homes in New Jersey <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Home Health in New Jersey</p>
            <h3>{formatHubCount(intel.cmsOverlay.homeHealth)} current</h3>
            <p>
              Not equivalent to {formatHubCount(intel.acute.hha)} NJDOH Home Health offices. The CMS
              Home Health crosswalk remains incomplete.
            </p>
            <Link className="text-link" href="/home-health">
              Research CMS Home Health <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Hospice GI in New Jersey</p>
            <h3>{formatHubCount(intel.cmsOverlay.hospice)} current</h3>
            <p>
              Not equivalent to NJDOH Hospice Program, Branch, or Inpatient counts. The CMS Hospice
              crosswalk remains incomplete.
            </p>
            <Link className="text-link" href="/hospice">
              Research CMS Hospice <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
      </section>

      <section aria-labelledby="nj-catalog-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="nj-catalog-title">Source catalog</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>New Jersey source families, coverage, and identity linkage</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">As-of</th>
                <th scope="col">Grain</th>
                <th scope="col">Coverage</th>
                <th scope="col">Identity linkage</th>
              </tr>
            </thead>
            <tbody>
              {NJ_SOURCE_CATALOG.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.source}
                    <p className="hub-stat__note">{row.notes}</p>
                  </th>
                  <td>{row.asOf ?? "Unknown / source unavailable"}</td>
                  <td>{row.grain}</td>
                  <td>{row.coverage}</td>
                  <td>{row.identityLinkage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="nj-gaps-title">
        <div className="section-heading">
          <p className="eyebrow">What we don&apos;t yet know</p>
          <h2 id="nj-gaps-title">Coverage gaps stay visible</h2>
          <p>
            Unknown, source unavailable, and partial coverage are published as such. Missing
            evidence blocks that metric — not New Jersey.
          </p>
        </div>
        <ul className="hub-plain-list">
          {intel.gaps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
