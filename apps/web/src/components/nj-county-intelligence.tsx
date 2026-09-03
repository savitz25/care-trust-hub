import Link from "next/link";
import {
  formatHubCount,
  njCountyTraceMetrics,
  type NjCountyPublicSnapshot,
  type NjCountyTraceMetric,
} from "@care/domain";
import { NjFacilityInventory } from "./nj-facility-inventory";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: NjCountyTraceMetric }) {
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

export function NjCountyIntelligenceView({ intel }: { intel: NjCountyPublicSnapshot }) {
  const traces = njCountyTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const local = intel.localResources;
  const countyLabel = `${intel.county} County`;

  return (
    <div className="national-hub florida-intel">
      <nav aria-label="Breadcrumb" className="hub-stat__note">
        <Link href="/">Home</Link>
        {" / "}
        <Link href="/new-jersey">New Jersey</Link>
        {" / "}
        <span>{countyLabel}</span>
      </nav>

      <section className="hub-scale" aria-labelledby="nj-county-scale-title">
        <div className="section-heading">
          <p className="eyebrow">{countyLabel} senior care research</p>
          <h2 id="nj-county-scale-title">
            Licensed identities and county resources, kept separate
          </h2>
          <p>
            NJDOH All_LTC and All_Acute are different licensed universes. County aging programs,
            senior centers, planning-housing points, and grants are county resources, not licensed
            facilities. SeniorTrustHub does not rank facilities and does not publish a Trust Score.
            There is no Verified by New Jersey badge.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="All_LTC licensed identities"
            value={formatHubCount(intel.njdoh.ltc)}
            note={`as of ${intel.njdoh.ltcAsOf} · not added to All_Acute`}
          />
          <Stat
            label="All_Acute licensed identities"
            value={formatHubCount(intel.njdoh.acute)}
            note={`as of ${intel.njdoh.acuteAsOf} · office county is not a service area`}
          />
          <Stat
            label="SNF/NF in All_LTC"
            value={formatHubCount(intel.njdoh.nfSnf)}
            note="Official LONG TERM CARE FACILITY SNF/NF type"
          />
          <Stat
            label="Assisted Living Residences"
            value={formatHubCount(intel.njdoh.alr)}
            note="All_LTC ALR type · not a CMS count"
          />
        </div>
        {trace("ltc-rows") ? <Trace metric={trace("ltc-rows")!} /> : null}
        {trace("acute-rows") ? <Trace metric={trace("acute-rows")!} /> : null}
        <p className="hub-stat__note">
          Snapshot {intel.version} · FIPS {intel.countyFips} · as of {intel.asOf} · fingerprint{" "}
          {intel.fingerprint.slice(0, 12)}…
        </p>
      </section>

      <section aria-labelledby="nj-county-findings-title">
        <div className="section-heading">
          <p className="eyebrow">County findings</p>
          <h2 id="nj-county-findings-title">What this snapshot supports</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.findings.map((row) => (
            <li key={row.id}>{row.text}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nj-county-ltc-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH All_LTC</p>
          <h2 id="nj-county-ltc-title">{countyLabel} long-term care licensed types</h2>
          <p>{intel.njdoh.caveat}</p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="SNF/NF" value={formatHubCount(intel.njdoh.nfSnf)} />
          <Stat label="ALR" value={formatHubCount(intel.njdoh.alr)} />
          <Stat label="CPCH" value={formatHubCount(intel.njdoh.cpch)} />
          <Stat label="ALP" value={formatHubCount(intel.njdoh.alp)} />
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Official All_LTC types located in {countyLabel}.</caption>
            <thead>
              <tr>
                <th scope="col">Official type</th>
                <th scope="col">Identities</th>
              </tr>
            </thead>
            <tbody>
              {intel.njdoh.ltcByType.map((row) => (
                <tr key={row.typeKey}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="nj-county-acute-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH All_Acute</p>
          <h2 id="nj-county-acute-title">Acute, Home Health, and Hospice stay uncombined</h2>
          <p>
            Home Health Agency offices are physical locations, not service areas. Hospice Program,
            Hospice Branch, and Hospice Inpatient are different types.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="Home Health Agency offices" value={formatHubCount(intel.njdoh.hha)} />
          <Stat label="Hospice Care Program" value={formatHubCount(intel.njdoh.hospiceProgram)} />
          <Stat label="Hospice Care Branch" value={formatHubCount(intel.njdoh.hospiceBranch)} />
          <Stat
            label="Hospice Care — Inpatient"
            value={formatHubCount(intel.njdoh.hospiceInpatient)}
          />
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Official All_Acute types located in {countyLabel}.</caption>
            <thead>
              <tr>
                <th scope="col">Official type</th>
                <th scope="col">Identities</th>
              </tr>
            </thead>
            <tbody>
              {intel.njdoh.acuteByType.map((row) => (
                <tr key={row.typeKey}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <NjFacilityInventory defaultCounty={intel.county} lockCounty />

      <section aria-labelledby="nj-county-local-title">
        <div className="section-heading">
          <p className="eyebrow">County resources — not licensed facilities</p>
          <h2 id="nj-county-local-title">{countyLabel} aging and community resources</h2>
          <p>
            These rows are county program and directory information. They are not NJDOH licensed
            identities and are not merged to All_LTC or All_Acute by name. Inclusion is not an
            endorsement.
          </p>
        </div>
        {local.adrc ? (
          <div className="hub-card">
            <p className="eyebrow">Aging &amp; Disability Resource Connection</p>
            <h3>{local.adrc.agency}</h3>
            <p>
              Phone {local.adrc.phone}
              {local.adrc.tollFree ? ` · toll-free ${local.adrc.tollFree}` : ""}
              {local.adrc.adrcTollFree ? ` · ADRC ${local.adrc.adrcTollFree}` : ""}
            </p>
            {local.adrc.address ? <p>{local.adrc.address}</p> : null}
            {local.adrc.email ? <p>{local.adrc.email}</p> : null}
            {local.adrc.url ? (
              <p>
                <a className="text-link" href={local.adrc.url} rel="noopener noreferrer">
                  Official ADRC / county aging page
                </a>
              </p>
            ) : null}
            {local.adrc.resourceDirectoryPdf ? (
              <p>
                Resource directory PDF cited as of {local.adrc.resourceDirectoryAsOf}, not copied.
              </p>
            ) : null}
          </div>
        ) : null}

        {local.seniorGrant ? (
          <div className="hub-card">
            <p className="eyebrow">Union County Senior Home Improvement Grant</p>
            <h3>{local.seniorGrant.programName}</h3>
            <p>{local.seniorGrant.attribution}</p>
            <p>
              Benefit type: {local.seniorGrant.benefitType}. Published amount:{" "}
              {local.seniorGrant.benefitAmountPublished}. Source date:{" "}
              {local.seniorGrant.sourceAsOf}.
            </p>
            <p>
              This is not a guarantee of eligibility or current funding beyond the source date. It
              is not a county contractor license.
            </p>
            <p>
              <a className="text-link" href={local.seniorGrant.sourceUrl} rel="noopener noreferrer">
                County program page
              </a>
            </p>
          </div>
        ) : null}

        {local.homeImprovementProgram ? (
          <div className="hub-card">
            <p className="eyebrow">Aging-in-place program context</p>
            <h3>{local.homeImprovementProgram.programName}</h3>
            <p>
              According to the county&apos;s dated program information (
              {local.homeImprovementProgram.sourceAsOf}), this is a{" "}
              {local.homeImprovementProgram.benefitType.toLowerCase()} published at{" "}
              {local.homeImprovementProgram.benefitAmountPublished}.
            </p>
            <p>{local.homeImprovementProgram.agingInPlaceNote}</p>
          </div>
        ) : null}

        {local.seniorCenters ? (
          <>
            <h3>Senior centers</h3>
            <p>
              {formatHubCount(local.seniorCenters.count)} centers from the official county page as
              of {local.sourceAsOf}. Coverage: {local.seniorCenters.coverage}. A listed center is a
              county resource, not a licensed facility.
            </p>
            <div className="hub-table-scroll">
              <table className="hub-table hub-table--compact">
                <caption>{countyLabel} senior centers from the county directory.</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Municipality</th>
                    <th scope="col">Address</th>
                    <th scope="col">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {local.seniorCenters.rows.map((row) => (
                    <tr key={`${row.name}-${row.municipality}`}>
                      <th scope="row">{row.name}</th>
                      <td>{row.municipality}</td>
                      <td>{row.streetAddress}</td>
                      <td>{row.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {local.seniorCentersNotExtracted && local.seniorCentersNotExtracted.length > 0 ? (
              <p>
                Remaining municipalities on the same official page, not extracted in this snapshot:{" "}
                {local.seniorCentersNotExtracted.join("; ")}.
              </p>
            ) : null}
          </>
        ) : null}

        {local.otherServiceCenters.length > 0 ? (
          <>
            <h3>Other listed service centers</h3>
            <ul className="hub-plain-list">
              {local.otherServiceCenters.map((row) => (
                <li key={`${row.name}-${row.municipality}`}>
                  {row.name}, {row.municipality}
                  {row.phone ? ` · ${row.phone}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {local.congregateMealSites && local.congregateMealSites.length > 0 ? (
          <>
            <h3>Congregate meal sites</h3>
            <p>
              {formatHubCount(local.congregateMealSites.length)} official congregate meal sites.
              Coverage: {local.congregateMealSitesCoverage}. A listed nutrition site is not a
              finding about any resident.
            </p>
            <div className="hub-table-scroll">
              <table className="hub-table hub-table--compact">
                <caption>
                  {countyLabel} congregate meal sites from the county nutrition page.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Municipality</th>
                    <th scope="col">Hours</th>
                    <th scope="col">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {local.congregateMealSites.map((row) => (
                    <tr key={`${row.name}-${row.municipality}`}>
                      <th scope="row">{row.name}</th>
                      <td>{row.municipality}</td>
                      <td>{row.hours ?? "Not printed"}</td>
                      <td>{row.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {local.homeDeliveredMeals.length > 0 ? (
          <>
            <h3>Home-delivered meal resources</h3>
            <ul className="hub-plain-list">
              {local.homeDeliveredMeals.map((row) => (
                <li key={row.provider}>
                  {row.provider}
                  {row.phone ? ` · ${row.phone}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {local.housingInventory ? (
          <>
            <h3>Somerset County Housing Options planning inventory</h3>
            <p>
              {formatHubCount(local.housingInventory.seniorRelatedRecordCount)} senior-related
              records of {formatHubCount(local.housingInventory.totalRecords)} in the May 2023
              FeatureServer/0 planning inventory. Grain: {local.housingInventory.grain}. This is not
              current NJDOH licensure, not a CMS directory, and not the CCRC Certificate of
              Authority roster. Names are not merged to NJDOH identities.
            </p>
            <div className="hub-stat-grid">
              <Stat
                label="Senior Residence"
                value={formatHubCount(
                  local.housingInventory.categoryCounts["Senior Residence"] ?? 0,
                )}
              />
              <Stat
                label="Assisted Living Facility"
                value={formatHubCount(
                  local.housingInventory.categoryCounts["Assisted Living Facility"] ?? 0,
                )}
              />
              <Stat
                label="CCRC (planning category)"
                value={formatHubCount(
                  local.housingInventory.categoryCounts["Continuing Care Retirement Community"] ??
                    0,
                )}
                note="Not the Certificate of Authority roster"
              />
              <Stat
                label="Active Adult Community"
                value={formatHubCount(
                  local.housingInventory.categoryCounts["Active Adult Community"] ?? 0,
                )}
              />
            </div>
            <div className="hub-table-scroll">
              <table className="hub-table hub-table--compact">
                <caption>
                  58 senior-related Housing Options rows. Planning inventory, not a license list.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Facility</th>
                    <th scope="col">Municipality</th>
                    <th scope="col">Housing category</th>
                    <th scope="col">Living type</th>
                    <th scope="col">Tenure</th>
                  </tr>
                </thead>
                <tbody>
                  {local.housingInventory.rows.map((row) => (
                    <tr key={`${row.projectId}-${row.facility}`}>
                      <th scope="row">{row.facility}</th>
                      <td>{row.municipality}</td>
                      <td>{row.housingCategory}</td>
                      <td>{row.livingType}</td>
                      <td>{row.tenure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>{local.housingInventory.sourceAsOfNote}</p>
          </>
        ) : null}

        {local.nursingHomeGeocode ? (
          <>
            <h3>Nursing-home geocode points (planning context)</h3>
            <p>
              {formatHubCount(local.nursingHomeGeocode.count)} points from{" "}
              {local.nursingHomeGeocode.source}. {local.nursingHomeGeocode.semantic} They are not
              joined to NJDOH FacIDs by name.
            </p>
            <div className="hub-table-scroll">
              <table className="hub-table hub-table--compact">
                <caption>Geographic/planning points, not an NJDOH or CMS roster.</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Municipality</th>
                    <th scope="col">Address</th>
                    <th scope="col">Telephone</th>
                  </tr>
                </thead>
                <tbody>
                  {local.nursingHomeGeocode.rows.map((row) => (
                    <tr key={row.name}>
                      <th scope="row">{row.name}</th>
                      <td>{row.municipality}</td>
                      <td>{row.address}</td>
                      <td>{row.telephone ?? "Not printed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {local.notes.filter(Boolean).length > 0 ? (
          <ul className="hub-plain-list">
            {local.notes.filter(Boolean).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="nj-county-pace-title">
        <div className="section-heading">
          <p className="eyebrow">PACE</p>
          <h2 id="nj-county-pace-title">Center address county, not a service area</h2>
          <p>{intel.pace.caveat}</p>
        </div>
        {intel.pace.centersInCounty.length > 0 ? (
          <div className="hub-table-scroll">
            <table className="hub-table hub-table--compact">
              <caption>PACE centers whose published address county is {countyLabel}.</caption>
              <thead>
                <tr>
                  <th scope="col">Center</th>
                  <th scope="col">Organization</th>
                  <th scope="col">City</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {intel.pace.centersInCounty.map((row) => (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td>{row.org}</td>
                    <td>{row.city}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No PACE center on the current DoAS listing uses a {countyLabel} address.</p>
        )}
      </section>

      <section aria-labelledby="nj-county-staff-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH staffing</p>
          <h2 id="nj-county-staff-title">Statewide residents-per-staff context only</h2>
          <p>{intel.staffing.caveat}</p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label={`Statewide day RN (${intel.staffing.latest})`}
            value={String(intel.staffing.statewideDayRn)}
            note={`${formatHubCount(intel.staffing.statewideReportingFacilities)} reporting facilities · higher means more residents per RN`}
          />
          <Stat label="Statewide day LPN" value={String(intel.staffing.statewideDayLpn)} />
          <Stat label="Statewide day CNA" value={String(intel.staffing.statewideDayCna)} />
          <Stat label={`${countyLabel} staffing aggregate`} value="Omitted" />
        </div>
        {trace("staffing-county") ? <Trace metric={trace("staffing-county")!} /> : null}
      </section>

      <section aria-labelledby="nj-county-enf-title">
        <div className="section-heading">
          <p className="eyebrow">NJDOH enforcement</p>
          <h2 id="nj-county-enf-title">Statewide exact coverage, not a county clean bill</h2>
          <p>{intel.enforcement.caveat}</p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Statewide exact matches"
            value={formatHubCount(intel.enforcement.exactStatewide)}
            note={`${formatHubCount(intel.enforcement.exactFacilitiesStatewide)} unique LTC facilities`}
          />
          <Stat
            label="Statewide unresolved"
            value={formatHubCount(intel.enforcement.unresolvedStatewide)}
            note="Not county-assigned · not a clean history"
          />
          <Stat label={`${countyLabel} exact matches`} value="Unknown" />
        </div>
        {trace("enforcement-county") ? <Trace metric={trace("enforcement-county")!} /> : null}
      </section>

      <section aria-labelledby="nj-county-medicaid-title">
        <div className="section-heading">
          <p className="eyebrow">Medicaid listed rates</p>
          <h2 id="nj-county-medicaid-title">Statewide schedule, not county participation</h2>
          <p>{intel.medicaid.caveat}</p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Statewide listed rows"
            value={formatHubCount(intel.medicaid.listedRowsStatewide)}
            note={`${intel.medicaid.fiscalYear} · effective ${intel.medicaid.effectiveOn}`}
          />
          <Stat
            label="Listed daily-rate range"
            value={`${intel.medicaid.minRate}–${intel.medicaid.maxRate}`}
          />
          <Stat label={`${countyLabel} listed rows`} value="Unknown" />
        </div>
        {trace("medicaid-county") ? <Trace metric={trace("medicaid-county")!} /> : null}
      </section>

      <section aria-labelledby="nj-county-cms-title">
        <div className="section-heading">
          <p className="eyebrow">CMS overlay</p>
          <h2 id="nj-county-cms-title">Statewide New Jersey CMS context</h2>
          <p>{intel.cms.caveat}</p>
        </div>
        <div className="hub-class-grid">
          <article className="hub-card">
            <p className="eyebrow">CMS Nursing Homes in New Jersey</p>
            <h3>{formatHubCount(intel.cms.nursingHomesStatewide)} current statewide</h3>
            <p>Not equivalent to All_LTC SNF/NF identities. Overlay as of {intel.cms.asOf}.</p>
            <Link className="text-link" href="/search?search=1&state=NJ">
              Research CMS Nursing Homes in New Jersey <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Home Health in New Jersey</p>
            <h3>{formatHubCount(intel.cms.homeHealthStatewide)} current statewide</h3>
            <p>Not equivalent to NJDOH Home Health offices. Crosswalk remains incomplete.</p>
            <Link className="text-link" href="/home-health">
              Research CMS Home Health <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Hospice GI in New Jersey</p>
            <h3>{formatHubCount(intel.cms.hospiceStatewide)} current statewide</h3>
            <p>Not equivalent to NJDOH Hospice Program, Branch, or Inpatient counts.</p>
            <Link className="text-link" href="/hospice">
              Research CMS Hospice <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
        {trace("cms-county") ? <Trace metric={trace("cms-county")!} /> : null}
      </section>

      <section aria-labelledby="nj-county-ccrc-title">
        <div className="section-heading">
          <p className="eyebrow">CCRC</p>
          <h2 id="nj-county-ccrc-title">Certificate of Authority roster remains unknown</h2>
          <p>
            Coverage: {intel.ccrc.coverage}. The published CCRC count is <strong>Unknown</strong> —
            not zero. {intel.ccrc.caveat}
          </p>
        </div>
      </section>

      <section aria-labelledby="nj-county-gaps-title">
        <div className="section-heading">
          <p className="eyebrow">Coverage</p>
          <h2 id="nj-county-gaps-title">Source families and known gaps</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Source families used for this county page.</caption>
            <thead>
              <tr>
                <th scope="col">Source family</th>
                <th scope="col">Grain</th>
              </tr>
            </thead>
            <tbody>
              {intel.sourceFamilies.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  <td>{row.grain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="hub-plain-list">
          {intel.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
        <p>
          <Link className="text-link" href="/new-jersey">
            New Jersey statewide senior-care research <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>
    </div>
  );
}
