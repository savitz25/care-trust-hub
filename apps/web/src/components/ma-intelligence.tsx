import {
  formatHubCount,
  maTraceMetrics,
  type MaPublicSnapshot,
  type MaTraceMetric,
} from "@care/domain";
import type { MaFacilityLists } from "@/server/care/ma-intelligence";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: MaTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number: {metric.label}</summary>
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

export function MaIntelligenceView({
  intel,
  lists,
}: {
  intel: MaPublicSnapshot;
  lists: MaFacilityLists;
}) {
  const traces = maTraceMetrics(intel);
  const cms = intel.cmsOverlay;
  const alr = intel.assistedLiving;
  const dphDate = intel.dphWorkbook.sourceAsOf;
  const cities = Object.entries(intel.cityContext.cities);

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="ma-state-title">
        <div className="section-heading">
          <p className="eyebrow">Massachusetts state sources</p>
          <h2 id="ma-state-title">Each care setting has its own regulator and count</h2>
          <p>
            The Department of Public Health (DPH) licenses Nursing Homes and Rest Homes and lists
            Home Health, Hospice, and Adult Day Health providers in its facility workbook (dated{" "}
            {dphDate}). The Executive Office of Aging &amp; Independence (AGE) certifies Assisted
            Living Residences (list dated {alr.sourceAsOf}). These numbers are different kinds of
            providers and are never added into one Massachusetts total.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="DPH Nursing Homes"
            value={formatHubCount(intel.nursingHomes.rows)}
            note={`${formatHubCount(intel.nursingHomes.bedsSum)} beds listed · DPH ${dphDate}`}
          />
          <Stat
            label="DPH Rest Homes"
            value={formatHubCount(intel.restHomes.rows)}
            note={`${formatHubCount(intel.restHomes.bedsSum)} beds listed · not a nursing home`}
          />
          <Stat
            label="AGE-certified Assisted Living Residences"
            value={formatHubCount(alr.rows)}
            note={`${formatHubCount(alr.totalUnits)} units, ${formatHubCount(alr.specialCareUnits)} special-care · AGE ${alr.sourceAsOf}`}
          />
          <Stat
            label="DPH Certified Home Health Agencies"
            value={formatHubCount(intel.homeHealth.rows)}
            note="State listing · not a CMS CCN"
          />
          <Stat
            label="DPH Hospice programs"
            value={formatHubCount(intel.hospice.rows)}
            note={`Plus ${intel.hospiceInpatientSatellites.rows} inpatient satellites, counted separately`}
          />
          <Stat
            label="DPH Adult Day Health programs"
            value={formatHubCount(intel.adultDayHealth.rows)}
            note="Day program · not residential"
          />
        </div>
        {traces.map((metric) => (
          <Trace key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="hub-scale" aria-labelledby="ma-classes-title">
        <div className="section-heading">
          <p className="eyebrow">Care settings</p>
          <h2 id="ma-classes-title">Nursing Home, Rest Home, and Assisted Living are different</h2>
          <p>
            <strong>Nursing Homes</strong> are DPH-licensed long-term care facilities that provide
            ongoing nursing care. Many are also CMS-certified, which is a separate federal status.
          </p>
          <p>
            <strong>Rest Homes</strong> are DPH-licensed residential settings for people who need
            24-hour supervision but not routine nursing or medical care. A Rest Home is not a
            nursing home and is not assisted living.
          </p>
          <p>
            <strong>Assisted Living Residences</strong> must be certified by AGE before operating.
            They offer housing, meals, and personal care for a monthly fee. Certification is not a
            DPH license and not CMS certification. The AGE list reports{" "}
            {formatHubCount(alr.traditionalUnits)} traditional units and{" "}
            {formatHubCount(alr.specialCareUnits)} special-care units across{" "}
            {alr.residencesWithSpecialCareUnits} residences with special care; units are not
            residents or beds. The live Mass.gov directory showed{" "}
            {alr.liveDirectoryObservation.results} results when checked; the downloadable list dated{" "}
            {alr.sourceAsOf} has {alr.rows}.
          </p>
          <p>
            <strong>Home Health and Hospice</strong> appear twice: as DPH state listings and as
            CMS-certified providers. A state listing is not CMS certification, so the two are shown
            side by side and not added.
          </p>
          <p>
            AGE&apos;s 2026 census report (calendar year 2025) says{" "}
            {intel.alrCensus2026.statedCertifiedAlrsJanuary2026} certified ALRs were operating in
            January 2026 and {intel.alrCensus2026.respondingAlrs} reported data. That report is
            context; the residence list above is the identity source.
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="ma-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal overlay</p>
          <h2 id="ma-cms-title">CMS certification is a separate lens</h2>
          <p>
            CMS lists {formatHubCount(cms.nursingHomes)} Nursing Homes,{" "}
            {formatHubCount(cms.homeHealth)} Home Health agencies, and {formatHubCount(cms.hospice)}{" "}
            Hospice providers in Massachusetts (source{" "}
            {cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}). The DPH workbook does not
            include a CMS Certification Number (CCN), so no DPH row is linked to a CMS profile here
            and nothing is matched by name. Zero links is not zero overlap: most DPH nursing homes
            are probably CMS-certified, but this page does not claim which ones. CMS inspection,
            ownership, and penalty evidence stays on each CMS profile.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <a href="/search?search=1&state=MA&class=nursing_home">
              CMS nursing homes in Massachusetts
            </a>
          </li>
          <li>
            <a href="/search?search=1&state=MA&class=home_health">
              CMS home health in Massachusetts
            </a>
          </li>
          <li>
            <a href="/search?search=1&state=MA&class=hospice">CMS hospice in Massachusetts</a>
          </li>
        </ul>
      </section>

      <section className="hub-scale" aria-labelledby="ma-survey-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections and complaints</p>
          <h2 id="ma-survey-title">DPH survey results and complaints</h2>
          <p>
            DPH&apos;s{" "}
            <a href={intel.surveyTool.url} rel="noopener noreferrer">
              Nursing Home Survey Performance Tool
            </a>{" "}
            lists {intel.surveyTool.listedFacilities} surveyed nursing homes, reflecting surveys
            processed through {intel.surveyTool.processedThrough}. It scores 132 items from the last
            three standard surveys using DPH&apos;s own method. Those results are DPH evidence, not
            a TrustHub score, and they were not copied here: the tool is searched one facility at a
            time.
          </p>
          <p>
            DPH takes complaints about nursing homes and other licensed facilities. Provider-level
            complaint records are not published in bulk, so none are shown (available by request
            only). A complaint is not a deficiency unless a survey finds one. Nursing-home closure
            notices are published as individual documents and were not indexed.
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="ma-cities-title">
        <div className="section-heading">
          <p className="eyebrow">Places</p>
          <h2 id="ma-cities-title">Boston, Worcester, and Springfield</h2>
          <p>
            City counts filter the statewide lists by the address in the source. There are no
            separate city pages.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <thead>
              <tr>
                <th scope="col">City</th>
                <th scope="col">DPH Nursing Homes</th>
                <th scope="col">DPH Rest Homes</th>
                <th scope="col">AGE ALRs</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(([city, c]) => (
                <tr key={city}>
                  <th scope="row">{city}</th>
                  <td>{c.nursingHomes}</td>
                  <td>{c.restHomes}</td>
                  <td>{c.assistedLivingResidences}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="ma-lists-title">
        <div className="section-heading">
          <p className="eyebrow">Official lists</p>
          <h2 id="ma-lists-title">Rest Homes and Assisted Living Residences</h2>
          <p>
            Rows as published by DPH ({lists.dphSourceAsOf}) and AGE ({lists.alrSourceAsOf}). Listed
            in alphabetical order, not ranked. Neither list publishes a license status or expiration
            date; confirm current status with the agency.
          </p>
        </div>
        <details className="intel-disclose">
          <summary>DPH Rest Homes ({lists.restHomes.length})</summary>
          <ul className="hub-plain-list">
            {lists.restHomes.map((f) => (
              <li key={f.dphFacilityId}>
                {f.name} · {f.street}, {f.city} {f.zip} · {f.beds ?? "—"} beds · DPH ID{" "}
                {f.dphFacilityId}
              </li>
            ))}
          </ul>
        </details>
        <details className="intel-disclose">
          <summary>
            AGE-certified Assisted Living Residences ({lists.assistedLivingResidences.length})
          </summary>
          <ul className="hub-plain-list">
            {lists.assistedLivingResidences.map((a) => (
              <li key={`${a.name}|${a.street}`}>
                {a.name} · {a.street}, {a.city} · {a.totalUnits ?? "—"} units (
                {a.specialCareUnits ?? 0} special-care) · status as published: {a.statusAsPublished}
              </li>
            ))}
          </ul>
        </details>
        <details className="intel-disclose">
          <summary>DPH Nursing Homes ({lists.nursingHomes.length})</summary>
          <ul className="hub-plain-list">
            {lists.nursingHomes.map((f) => (
              <li key={f.dphFacilityId}>
                {f.name} · {f.street}, {f.city} {f.zip} · {f.beds ?? "—"} beds · DPH ID{" "}
                {f.dphFacilityId}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="hub-scale" aria-labelledby="ma-limits-title">
        <div className="section-heading">
          <p className="eyebrow">Limits</p>
          <h2 id="ma-limits-title">What this page does not claim</h2>
        </div>
        <ul className="hub-plain-list">
          <li>
            No combined Massachusetts senior-facility total. Nursing Home is not Rest Home is not
            Assisted Living is not Home Health is not Hospice.
          </li>
          <li>
            A state license or certification is not CMS certification, and no DPH row is linked to a
            CMS CCN.
          </li>
          <li>
            No ranking, recommendation, or Trust Score. DPH survey results remain DPH&apos;s own
            measure.
          </li>
          <li>
            MassGIS long-term-care data (late-2023 sources) is not used as a current list. Missing
            is not closed.
          </li>
          <li>
            Sources:{" "}
            <a href={intel.regulatorMap.dphFacilityList} rel="noopener noreferrer">
              DPH facility list
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.alrProgram} rel="noopener noreferrer">
              AGE Assisted Living
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.alrReports} rel="noopener noreferrer">
              ALR data reports
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.nursingHomeConsumerInfo} rel="noopener noreferrer">
              DPH nursing home consumer information
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
