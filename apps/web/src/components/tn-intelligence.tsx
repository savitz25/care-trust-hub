import {
  formatHubCount,
  tnTraceMetrics,
  type TnPublicSnapshot,
  type TnTraceMetric,
} from "@care/domain";
import type { TnFacilityLists } from "@/server/care/tn-intelligence";

type Action = TnFacilityLists["actions"][number];

const SETTING: Record<string, string> = {
  nursingHomes: "Nursing Home",
  aclf: "ACLF",
  rha: "RHA",
  homeHealth: "Home Health",
  adultCareHome: "Adult Care Home",
};

const ATTRIBUTION: Record<string, string> = {
  attached_exact_license_number_and_name_agrees: "Matches the July 2026 report row",
  standalone_license_number_found_but_name_differs:
    "Not attached: the license number is on the report under a different name",
  standalone_license_number_not_on_july_2026_report:
    "Not attached: license number not on the July 2026 report",
  standalone_no_state_roster_for_class: "Not attached: no state list for this class",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: TnTraceMetric }) {
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

function ActionTable({ rows }: { rows: Action[] }) {
  return (
    <div className="hub-table-scroll">
      <table className="hub-table">
        <thead>
          <tr>
            <th scope="col">Report month</th>
            <th scope="col">Licensee (as printed)</th>
            <th scope="col">Class · license</th>
            <th scope="col">Action (as printed)</th>
            <th scope="col">Link to state report row</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.reportMonth}</td>
              <td>
                {a.nameAsPrinted}, {a.cityAsPrinted}
              </td>
              <td>
                {SETTING[a.careSetting]} ({a.licenseClassAsPrinted}){" "}
                {a.licenseNumber !== null
                  ? `No. ${a.licenseNumber}`
                  : `applicant file ${a.applicantFileNumber}`}
              </td>
              <td>
                {a.orderSection}: {a.actionAsPrinted}
              </td>
              <td>
                {ATTRIBUTION[a.attribution]}
                {a.currentReportName &&
                a.attribution !== "attached_exact_license_number_and_name_agrees"
                  ? ` (${a.currentReportName})`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TnIntelligenceView({
  intel,
  lists,
}: {
  intel: TnPublicSnapshot;
  lists: TnFacilityLists;
}) {
  const traces = tnTraceMetrics(intel);
  const cms = intel.cmsOverlay;
  const nh = intel.nursingHomes;
  const aclf = intel.aclf;
  const rha = intel.rha;
  const hh = intel.homeHealth;
  const hospice = intel.hospice;
  const fa = intel.facilityActions;
  const cities = Object.entries(intel.cityContext.cities);

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="tn-state-title">
        <div className="section-heading">
          <p className="eyebrow">Tennessee state sources</p>
          <h2 id="tn-state-title">Each care setting has its own license and count</h2>
          <p>
            The Tennessee Health Facilities Commission (HFC) licenses Nursing Homes, Assisted Care
            Living Facilities (ACLF), Residential Homes for the Aged (RHA), Home Health agencies,
            and Hospices. The former Board for Licensing Health Care Facilities was folded into HFC
            on July 1, 2024. The facility counts below come from HFC&apos;s July 2026 Full Bed
            Reports. They are different kinds of providers and are never added into one Tennessee
            total.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="HFC Nursing Home licenses"
            value={formatHubCount(nh.distinctLicenseNumbers)}
            note={`${formatHubCount(nh.licensedBeds)} licensed beds · July 2026`}
          />
          <Stat
            label="HFC Assisted Care Living Facilities"
            value={formatHubCount(aclf.distinctLicenseNumbers)}
            note={`${formatHubCount(aclf.licensedBeds)} licensed beds · not a nursing home`}
          />
          <Stat
            label="HFC Residential Homes for the Aged"
            value={formatHubCount(rha.distinctLicenseNumbers)}
            note={`${formatHubCount(rha.licensedBeds)} licensed beds · not an ACLF`}
          />
          <Stat
            label="Home Health agencies on HFC county lists"
            value={formatHubCount(hh.distinctAgenciesAsPrinted)}
            note={`${formatHubCount(hh.countyServiceRows)} agency-county rows · list dated ${hh.sourceAsOf}`}
          />
          <Stat
            label="Hospice agencies on HFC county lists"
            value={formatHubCount(hospice.distinctAgenciesAsPrinted)}
            note={`${formatHubCount(hospice.countyServiceRows)} agency-county rows · list dated ${hospice.sourceAsOf}`}
          />
          <Stat
            label="HFC facility actions, senior classes"
            value={formatHubCount(fa.seniorClassActionRows)}
            note={`Monthly reports ${fa.window.replace("/", " to ")}`}
          />
        </div>
        {traces.map((metric) => (
          <Trace key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="hub-scale" aria-labelledby="tn-classes-title">
        <div className="section-heading">
          <p className="eyebrow">Care settings</p>
          <h2 id="tn-classes-title">
            Nursing Home, Assisted Care Living Facility, and Residential Home for the Aged are
            different
          </h2>
          <p>
            <strong>Nursing Homes</strong> are HFC-licensed facilities that provide ongoing nursing
            care. The July 2026 report lists {formatHubCount(nh.distinctLicenseNumbers)} licenses on{" "}
            {formatHubCount(nh.reportRows)} rows (one satellite shares its parent&apos;s license and
            bed figure, so its beds are counted once). By status as published:{" "}
            {Object.entries(nh.licenseStatusCounts)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
            .
          </p>
          <p>
            <strong>Assisted Care Living Facilities (ACLF)</strong> are Tennessee&apos;s licensed
            assisted-care-living category: housing with personal care and some health services, not
            nursing-home care. {formatHubCount(aclf.facilitiesWithSecuredBeds)} ACLFs report secured
            (memory-care) beds, {formatHubCount(aclf.securedBeds)} in all. By status as published:{" "}
            {Object.entries(aclf.licenseStatusCounts)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
            .
          </p>
          <p>
            <strong>Residential Homes for the Aged (RHA)</strong> are a separate, smaller HFC class
            that provides room, board, and personal services. HFC&apos;s report calls it &quot;Home
            for the Aged.&quot; An RHA is not an ACLF and not a nursing home.
          </p>
          <p>
            <strong>Adult Care Homes</strong> are another Tennessee license class. HFC publishes no
            statewide list for them, so none is shown, and they are not folded into RHA or ACLF.
          </p>
          <p>
            Beds are licensed capacity, not residents or occupancy. Bed counts are shown per class
            and never added across classes.
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="tn-hh-title">
        <div className="section-heading">
          <p className="eyebrow">Home Health and Hospice</p>
          <h2 id="tn-hh-title">Licensed to serve a county is not the same as an agency count</h2>
          <p>
            HFC publishes lists of the Home Health and Hospice agencies licensed to serve each of
            Tennessee&apos;s 95 counties. One agency is listed under every county it serves, so the{" "}
            {formatHubCount(hh.countyServiceRows)} Home Health rows describe{" "}
            {formatHubCount(hh.distinctAgenciesAsPrinted)} agencies, and the{" "}
            {formatHubCount(hospice.countyServiceRows)} Hospice rows describe{" "}
            {formatHubCount(hospice.distinctAgenciesAsPrinted)}. The lists print no license number,
            so agencies are told apart by the printed name and home county. The printed source dates
            are {hh.sourceAsOf} (Home Health) and {hospice.sourceAsOf} (Hospice), from before the
            July 2024 consolidation, so these lists are older than the bed reports.
          </p>
          <p>
            Separate HFC lists name agencies exempt for EEOICPA (
            {formatHubCount(hh.exemptionLists.eeoicpa.distinctAgenciesAsPrinted)} agencies) and
            pediatric care ({formatHubCount(hh.exemptionLists.pediatric.distinctAgenciesAsPrinted)}{" "}
            agencies). They are kept separate and not added to the main list.
          </p>
          <p>
            A state license is not CMS certification. CMS lists {formatHubCount(cms.homeHealth)}{" "}
            Home Health agencies and {formatHubCount(cms.hospice)} Hospices in Tennessee by office
            address. CMS started a six-month nationwide pause on initial Medicare enrollment of new
            Home Health agencies and hospices on May 20, 2026. That is a federal enrollment rule,
            not a Tennessee license suspension.
          </p>
        </div>
        <details className="intel-disclose">
          <summary>
            Home Health agencies on the HFC county list ({lists.homeHealthAgencies.length})
          </summary>
          <ul className="hub-plain-list">
            {lists.homeHealthAgencies.map((a) => (
              <li key={a.agency}>
                {a.agency} · licensed for {a.licensedCounties} of 95 counties
              </li>
            ))}
          </ul>
        </details>
        <details className="intel-disclose">
          <summary>
            Hospice agencies on the HFC county list ({lists.hospiceAgencies.length})
          </summary>
          <ul className="hub-plain-list">
            {lists.hospiceAgencies.map((a) => (
              <li key={a.agency}>
                {a.agency} · licensed for {a.licensedCounties} of 95 counties
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="hub-scale" aria-labelledby="tn-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal overlay</p>
          <h2 id="tn-cms-title">CMS certification is a separate lens</h2>
          <p>
            CMS lists {formatHubCount(cms.nursingHomes)} Nursing Homes,{" "}
            {formatHubCount(cms.homeHealth)} Home Health agencies, and {formatHubCount(cms.hospice)}{" "}
            Hospices in Tennessee (source {cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}).
            The HFC reports do not include a CMS Certification Number (CCN), so no HFC row is linked
            to a CMS profile here and nothing is matched by name. Zero proven links does not mean
            zero overlap: HFC&apos;s 2025 enforcement report says nearly all licensed nursing homes
            are CMS-certified, but this page does not claim which ones. CMS inspection, ownership,
            and penalty evidence stays on each CMS profile.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <a href="/search?search=1&state=TN&class=nursing_home">
              CMS nursing homes in Tennessee
            </a>
          </li>
          <li>
            <a href="/search?search=1&state=TN&class=home_health">CMS home health in Tennessee</a>
          </li>
          <li>
            <a href="/search?search=1&state=TN&class=hospice">CMS hospice in Tennessee</a>
          </li>
        </ul>
      </section>

      <section className="hub-scale" aria-labelledby="tn-actions-title">
        <div className="section-heading">
          <p className="eyebrow">State actions</p>
          <h2 id="tn-actions-title">HFC facility actions, 2024 to 2026</h2>
          <p>
            HFC publishes a monthly Facility Action and Abuse Report. This page reads{" "}
            {fa.monthsAcquired} reports from {fa.window.replace("/", " to ")} (January 2026 is not
            in HFC&apos;s archive). They list {formatHubCount(fa.seniorClassActionRows)} actions
            against Nursing Homes, ACLFs, RHAs, one Home Health agency, and one Adult Care Home,
            mostly civil monetary penalties ({formatHubCount(fa.withCivilMonetaryPenalty)}),
            probation ({formatHubCount(fa.withProbation)}), and admission or license suspensions.
            Actions against hospitals, surgery centers, and staffing agencies are left out.
          </p>
          <p>
            Each action prints a license class and number. An action is linked to a July 2026 report
            row only when the class and number match and the printed name agrees (
            {formatHubCount(fa.attachedToStateReportRow)} of{" "}
            {formatHubCount(fa.seniorClassActionRows)}). When the facility has since been renamed or
            sold, the name will not agree and the action is shown on its own. No action is linked to
            a CMS profile. An action is not an inspection result and not a complaint.
          </p>
          <p>
            The same reports list {formatHubCount(fa.abuseRegistryEntries)} Abuse Registry
            placements. Those name individual workers, not facilities, so the names are not
            republished here. Use HFC&apos;s Abuse Registry.
          </p>
        </div>
        <ActionTable rows={lists.actions.slice(0, 30)} />
        <details className="intel-disclose">
          <summary>Show all {lists.actions.length} actions</summary>
          <ActionTable rows={lists.actions} />
        </details>
      </section>

      <section className="hub-scale" aria-labelledby="tn-survey-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections and complaints</p>
          <h2 id="tn-survey-title">Inspections, enforcement reports, and complaints</h2>
          <p>
            HFC inspects nursing homes for the state and for CMS. Facility inspection results for
            Medicare or TennCare providers are CMS Statements of Deficiencies, which stay on each
            CMS profile and are not copied here. HFC&apos;s annual Nursing Home Inspection and
            Enforcement Report (the 2025 edition covers 2024:{" "}
            {intel.nursingHomeEnforcementReport.statedNursingHomesOperating2024} nursing homes
            operating, {intel.nursingHomeEnforcementReport.statedCmsCertified2024} CMS-certified) is
            statewide context, not facility data.
          </p>
          <p>
            HFC takes complaints through its public complaints portal. Complaint records and
            outcomes are not published in bulk, so none are shown (available by request only). A
            complaint is not a deficiency and not an enforcement finding.
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="tn-cities-title">
        <div className="section-heading">
          <p className="eyebrow">Places</p>
          <h2 id="tn-cities-title">Nashville, Memphis, Knoxville, and Chattanooga</h2>
          <p>
            City counts filter the statewide HFC reports by the city in the facility address. Home
            Health and Hospice use the county list for the city&apos;s county. There are no separate
            city pages.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <thead>
              <tr>
                <th scope="col">City (county)</th>
                <th scope="col">Nursing Homes</th>
                <th scope="col">ACLFs</th>
                <th scope="col">RHAs</th>
                <th scope="col">Home Health licensed for county</th>
                <th scope="col">Hospice licensed for county</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(([city, c]) => (
                <tr key={city}>
                  <th scope="row">
                    {city} ({c.county})
                  </th>
                  <td>{c.nursingHomes}</td>
                  <td>{c.aclf}</td>
                  <td>{c.rha}</td>
                  <td>{c.homeHealthAgenciesLicensedForCounty}</td>
                  <td>{c.hospiceAgenciesLicensedForCounty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="tn-lists-title">
        <div className="section-heading">
          <p className="eyebrow">Official lists</p>
          <h2 id="tn-lists-title">HFC July 2026 bed reports</h2>
          <p>
            Rows as published by HFC for July 2026, in license-number order, not ranked. License
            status is as printed; the reports give no license dates. Confirm current status with
            HFC&apos;s{" "}
            <a href={intel.regulatorMap.facilityListings} rel="noopener noreferrer">
              facility search
            </a>
            .
          </p>
        </div>
        <details className="intel-disclose">
          <summary>Assisted Care Living Facilities ({lists.aclf.length})</summary>
          <ul className="hub-plain-list">
            {lists.aclf.map((f) => (
              <li key={f.licenseNumber}>
                {f.name} · {f.street}, {f.city} {f.zip} ({f.county} County) · {f.totalBeds ?? "—"}{" "}
                beds{f.securedBeds ? `, ${f.securedBeds} secured` : ""} · {f.licenseStatus} · ACLF
                license {f.licenseNumber}
              </li>
            ))}
          </ul>
        </details>
        <details className="intel-disclose">
          <summary>Residential Homes for the Aged ({lists.rha.length})</summary>
          <ul className="hub-plain-list">
            {lists.rha.map((f) => (
              <li key={f.licenseNumber}>
                {f.name} · {f.street}, {f.city} {f.zip} ({f.county} County) · {f.totalBeds ?? "—"}{" "}
                beds · {f.licenseStatus} · RHA license {f.licenseNumber}
              </li>
            ))}
          </ul>
        </details>
        <details className="intel-disclose">
          <summary>Nursing Homes ({lists.nursingHomes.length} rows)</summary>
          <ul className="hub-plain-list">
            {lists.nursingHomes.map((f) => (
              <li key={`${f.licenseNumber}-${f.name}`}>
                {f.name} · {f.street}, {f.city} {f.zip} ({f.county} County) · {f.totalBeds ?? "—"}{" "}
                beds · {f.licenseStatus} · Nursing Home license {f.licenseNumber}
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="hub-scale" aria-labelledby="tn-limits-title">
        <div className="section-heading">
          <p className="eyebrow">Limits</p>
          <h2 id="tn-limits-title">What this page does not claim</h2>
        </div>
        <ul className="hub-plain-list">
          <li>
            No combined Tennessee senior-facility or bed total. Nursing Home is not ACLF is not
            Residential Home for the Aged is not Home Health is not Hospice.
          </li>
          <li>A state license is not CMS certification, and no HFC row is linked to a CMS CCN.</li>
          <li>
            Home Health and Hospice county rows are where an agency may serve, not a count of
            agencies. Missing is not zero.
          </li>
          <li>No ranking, recommendation, or Trust Score.</li>
          <li>
            Sources:{" "}
            <a href={intel.regulatorMap.healthFacilityReports} rel="noopener noreferrer">
              HFC Health Facility Reports
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.countyHomeHealthHospice} rel="noopener noreferrer">
              County Home Health &amp; Hospice lists
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.facilityActions} rel="noopener noreferrer">
              Facility Action and Abuse Reports
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.nursingHomeEnforcement} rel="noopener noreferrer">
              Nursing Home Inspection and Enforcement
            </a>{" "}
            ·{" "}
            <a href={intel.regulatorMap.complaints} rel="noopener noreferrer">
              File a complaint
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
