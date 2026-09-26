import {
  formatHubCount,
  mnTraceMetrics,
  type MnPublicSnapshot,
  type MnTraceMetric,
} from "@care/domain";
import type { MnFacilityLists } from "@/server/care/mn-intelligence";

type Facility = MnFacilityLists["facilities"][number];

const BRIDGE_LABEL: Record<string, string> = {
  exact_same_class: "Printed Medicare number matches a CMS provider of the same class",
  none_printed: "No Medicare number printed",
  printed_not_a_ccn: "Printed value is not a CCN (kept as printed)",
  printed_ccn_not_a_cms_profile_of_this_class: "Printed number is not a CMS provider of this class",
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

function Trace({ metric }: { metric: MnTraceMetric }) {
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

function findings(f: Facility): string {
  const inv = Object.entries(f.investigationFindings)
    .map(([k, v]) => `${k.toLowerCase()} ${v}`)
    .join(", ");
  return `${f.evaluationCount} evaluation${f.evaluationCount === 1 ? "" : "s"} · ${f.investigationCount} investigation${f.investigationCount === 1 ? "" : "s"}${inv ? ` (${inv})` : ""}`;
}

function FacilityTable({
  rows,
  showType = false,
  showBeds = true,
  showCcn = false,
  cmsPath = "/facility/cms",
}: {
  rows: Facility[];
  showType?: boolean;
  showBeds?: boolean;
  showCcn?: boolean;
  cmsPath?: string;
}) {
  return (
    <div className="hub-table-scroll">
      <table className="hub-table">
        <thead>
          <tr>
            <th scope="col">Provider (as listed by MDH)</th>
            {showType ? <th scope="col">MDH license type</th> : null}
            <th scope="col">License · HFID</th>
            <th scope="col">City · county</th>
            {showBeds ? <th scope="col">Licensed beds</th> : null}
            {showCcn ? <th scope="col">CMS link</th> : null}
            <th scope="col">MDH results posted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => (
            <tr key={`${f.hfid}-${f.licenseNumber ?? f.recordNumber}-${i}`}>
              <td>{f.name}</td>
              {showType ? (
                <td>
                  {f.cls === "provisionalAssistedLivingDementiaCare"
                    ? "Provisional, with Dementia Care"
                    : "With Dementia Care"}
                </td>
              ) : null}
              <td>
                {f.licenseNumber ?? f.recordNumber ?? "—"} · HFID {f.hfid ?? "—"}
                {f.expires ? ` · expires ${f.expires}` : ""}
                {f.conditionalLicense ? " · conditional" : ""}
              </td>
              <td>
                {f.city ?? "—"}
                {f.county ? ` · ${f.county}` : ""}
              </td>
              {showBeds ? <td>{f.licensedBeds ?? "—"}</td> : null}
              {showCcn ? (
                <td>
                  {f.cmsBridge ? (
                    <a href={`${cmsPath}/${f.cmsBridge}/profile`}>CCN {f.cmsBridge}</a>
                  ) : (
                    BRIDGE_LABEL[f.medicareNumberState ?? "none_printed"]
                  )}
                </td>
              ) : null}
              <td>{findings(f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountyTable({ rows, label }: { rows: Facility[]; label: string }) {
  const counts = new Map<string, number>();
  for (const f of rows)
    counts.set(
      f.county ?? "County not printed",
      (counts.get(f.county ?? "County not printed") ?? 0) + 1,
    );
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return (
    <details className="intel-disclose">
      <summary>{label} by county of the physical address</summary>
      <div className="hub-table-scroll">
        <table className="hub-table">
          <thead>
            <tr>
              <th scope="col">County</th>
              <th scope="col">Licenses</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(([county, count]) => (
              <tr key={county}>
                <td>{county}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function MnIntelligenceView({
  intel,
  lists,
}: {
  intel: MnPublicSnapshot;
  lists: MnFacilityLists;
}) {
  const traces = mnTraceMetrics(intel);
  const cms = intel.cmsOverlay;
  const cw = intel.crosswalk;
  const fd = intel.findings;
  const reg = intel.regulatorMap.current;
  const by = (...cls: string[]) => lists.facilities.filter((f) => cls.includes(f.cls));
  const inv = Object.entries(fd.investigationFindingsAttached)
    .map(([k, v]) => `${k.toLowerCase()} ${formatHubCount(v)}`)
    .join(", ");

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="mn-state-title">
        <div className="section-heading">
          <p className="eyebrow">Minnesota state sources</p>
          <h2 id="mn-state-title">Each care setting has its own license and count</h2>
          <p>
            Minnesota health care providers are licensed by the {reg.division} of the{" "}
            {reg.authority}. The counts below come from MDH&apos;s Health Care Provider Directory,
            which MDH updates daily; it was downloaded {intel.retrievedAt.slice(0, 10)} and prints
            no as-of date. They are different kinds of providers and are never added into one
            Minnesota total. MDH&apos;s 2026 annual directory (as of {intel.annualDirectory.asOf})
            is used only as a cross-check.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="MDH Nursing Home licenses"
            value={formatHubCount(intel.nursingHome.distinctLicenses)}
            note={`${formatHubCount(intel.nursingHome.licensedBedsAsPrinted ?? 0)} licensed beds · CMS lists ${formatHubCount(cms.nursingHomes)}`}
          />
          <Stat
            label="Assisted Living Facility licenses"
            value={formatHubCount(intel.assistedLiving.distinctLicenses)}
            note={`plus ${formatHubCount(intel.provisionalAssistedLiving.distinctLicenses)} provisional`}
          />
          <Stat
            label="Assisted Living Facility with Dementia Care licenses"
            value={formatHubCount(intel.assistedLivingDementiaCare.distinctLicenses)}
            note={`plus ${formatHubCount(intel.provisionalAssistedLivingDementiaCare.distinctLicenses)} provisional · separate license type`}
          />
          <Stat
            label="Boarding Care Home licenses"
            value={formatHubCount(intel.boardingCare.distinctLicenses)}
            note="Separate from Nursing Homes"
          />
          <Stat
            label="Comprehensive Home Care licenses"
            value={formatHubCount(intel.comprehensiveHomeCare.distinctLicenses)}
            note={`plus ${formatHubCount(intel.basicHomeCare.distinctLicenses)} Basic and temporary licenses, counted separately`}
          />
          <Stat
            label="Home Health Agencies (MDH directory)"
            value={formatHubCount(intel.homeHealthAgency.distinctLicenses)}
            note={`CMS lists ${formatHubCount(cms.homeHealth)} Minnesota agencies`}
          />
          <Stat
            label="Hospice Provider licenses"
            value={formatHubCount(intel.hospiceProvider.distinctLicenses)}
            note={`plus ${formatHubCount(intel.residentialHospice.distinctLicenses)} residential hospices · CMS lists ${formatHubCount(cms.hospice)}`}
          />
        </div>
        {traces.map((metric) => (
          <Trace key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="hub-scale" id="nursing-homes" aria-labelledby="mn-nh-title">
        <div className="section-heading">
          <p className="eyebrow">Nursing Homes</p>
          <h2 id="mn-nh-title">A state Nursing Home license is not CMS certification</h2>
          <p>
            MDH lists {formatHubCount(intel.nursingHome.distinctLicenses)} Nursing Home licenses.
            CMS separately lists {formatHubCount(cms.nursingHomes)} certified Minnesota nursing
            homes. MDH prints a Medicare number on most rows;{" "}
            {formatHubCount(cw.cmsNursingHomesBridged)} of the {formatHubCount(cms.nursingHomes)}{" "}
            CMS nursing homes match an MDH row by that exact number and class. The other{" "}
            {formatHubCount(cw.cmsNursingHomesNotBridged)} are not linked: no match is not the same
            as no overlap, and nothing is matched by name.
          </p>
        </div>
        <FacilityTable rows={by("nursingHome")} showCcn />
      </section>

      <section className="hub-scale" id="assisted-living" aria-labelledby="mn-al-title">
        <div className="section-heading">
          <p className="eyebrow">Assisted Living</p>
          <h2 id="mn-al-title">Assisted Living Facility licenses</h2>
          <p>
            Minnesota licenses assisted living under Minnesota Statutes chapter 144G. MDH lists{" "}
            {formatHubCount(intel.assistedLiving.distinctLicenses)} Assisted Living Facilities (
            {formatHubCount(intel.assistedLiving.licensedBedsAsPrinted ?? 0)} licensed beds) and{" "}
            {formatHubCount(intel.provisionalAssistedLiving.distinctLicenses)} Provisional Assisted
            Living Facilities, one-year licenses given to new providers before their first survey.
            Assisted living is not a nursing home and is not CMS-certified. Use Ask with a license
            number or HFID to look up one facility.
          </p>
        </div>
        <CountyTable rows={by("assistedLiving")} label="Assisted Living Facility licenses" />
      </section>

      <section className="hub-scale" id="dementia-care" aria-labelledby="mn-alfdc-title">
        <div className="section-heading">
          <p className="eyebrow">Assisted Living with Dementia Care</p>
          <h2 id="mn-alfdc-title">Dementia care is its own MDH license</h2>
          <p>
            MDH lists {formatHubCount(intel.assistedLivingDementiaCare.distinctLicenses)} Assisted
            Living Facilities with Dementia Care (
            {formatHubCount(intel.assistedLivingDementiaCare.licensedBedsAsPrinted ?? 0)} licensed
            beds) and {formatHubCount(intel.provisionalAssistedLivingDementiaCare.distinctLicenses)}{" "}
            provisional dementia-care licenses. This is MDH&apos;s license type, not a
            facility&apos;s description of itself: &quot;memory care&quot; is not an MDH license
            name, and a facility that advertises it holds the dementia-care license only if it
            appears below.
          </p>
        </div>
        <FacilityTable
          rows={by("assistedLivingDementiaCare", "provisionalAssistedLivingDementiaCare")}
          showType
        />
      </section>

      <section className="hub-scale" id="boarding-care" aria-labelledby="mn-bch-title">
        <div className="section-heading">
          <p className="eyebrow">Boarding Care</p>
          <h2 id="mn-bch-title">A Boarding Care Home is not a nursing home</h2>
          <p>
            A Boarding Care Home provides personal or custodial care; nursing services are not
            required. MDH lists {formatHubCount(intel.boardingCare.distinctLicenses)} Boarding Care
            Home licenses;{" "}
            {formatHubCount(intel.boardingCare.withFederalNursingFacilityClassification)} carry a
            federal Nursing Facility classification, and the numbers MDH prints for them are not CMS
            CCNs. The annual directory counts{" "}
            {formatHubCount(intel.annualDirectory.table3.boardingCareHomes.facilities)} because it
            includes Boarding Care units of other facilities.
          </p>
        </div>
        <FacilityTable rows={by("boardingCare")} />
      </section>

      <section className="hub-scale" id="home-care" aria-labelledby="mn-hc-title">
        <div className="section-heading">
          <p className="eyebrow">Home Care</p>
          <h2 id="mn-hc-title">Home care licenses are separate types</h2>
          <p>
            MDH licenses home care providers at two levels, each with a one-year temporary license:{" "}
            {formatHubCount(intel.comprehensiveHomeCare.distinctLicenses)} Comprehensive,{" "}
            {formatHubCount(intel.temporaryComprehensiveHomeCare.distinctLicenses)} Temporary
            Comprehensive, {formatHubCount(intel.basicHomeCare.distinctLicenses)} Basic, and{" "}
            {formatHubCount(intel.temporaryBasicHomeCare.distinctLicenses)} Temporary Basic. It also
            lists {formatHubCount(intel.homeManagementRegistration.distinctLicenses)} Home
            Management registrations (a registration, not a license) and{" "}
            {formatHubCount(intel.homeCareBranch.rows)} branch rows; branches are not providers.
            Home care is not Home Health.
          </p>
        </div>
        <CountyTable
          rows={by(
            "comprehensiveHomeCare",
            "temporaryComprehensiveHomeCare",
            "basicHomeCare",
            "temporaryBasicHomeCare",
          )}
          label="Home care licenses (all four levels)"
        />
      </section>

      <section className="hub-scale" id="home-health" aria-labelledby="mn-hh-title">
        <div className="section-heading">
          <p className="eyebrow">Home Health</p>
          <h2 id="mn-hh-title">MDH Home Health listing and CMS certification are separate</h2>
          <p>
            MDH lists {formatHubCount(intel.homeHealthAgency.distinctLicenses)} Home Health
            Agencies. Minnesota licenses them as home care providers and prints the federal Home
            Health classification. CMS lists {formatHubCount(cms.homeHealth)} certified Minnesota
            Home Health agencies; {formatHubCount(cw.cmsHomeHealthBridged)} match an MDH row by
            exact printed CCN. MDH also licenses{" "}
            {formatHubCount(cw.outOfStateHomeHealthCcnsBridged)} agencies certified under a
            neighboring state&apos;s CCN. The state and CMS counts are never added.
          </p>
        </div>
        <FacilityTable
          rows={by("homeHealthAgency")}
          showBeds={false}
          showCcn
          cmsPath="/home-health/cms"
        />
      </section>

      <section className="hub-scale" id="hospice" aria-labelledby="mn-hospice-title">
        <div className="section-heading">
          <p className="eyebrow">Hospice</p>
          <h2 id="mn-hospice-title">
            Hospice provider, branch, and residential hospice are different
          </h2>
          <p>
            MDH lists {formatHubCount(intel.hospiceProvider.distinctLicenses)} Hospice Provider
            licenses, {formatHubCount(intel.hospiceBranch.rows)} branch rows, and{" "}
            {formatHubCount(intel.residentialHospice.distinctLicenses)} Residential Hospice licenses
            (home-like residential buildings). CMS lists {formatHubCount(cms.hospice)} certified
            Minnesota hospices; {formatHubCount(cw.cmsHospiceBridged)} match an MDH row by exact
            printed CCN. There is no combined hospice count.
          </p>
        </div>
        <FacilityTable
          rows={by("hospiceProvider", "residentialHospice")}
          showBeds={false}
          showCcn
          cmsPath="/hospice/cms"
        />
      </section>

      <section className="hub-scale" id="regulatory" aria-labelledby="mn-reg-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections / Regulatory Evidence</p>
          <h2 id="mn-reg-title">MDH evaluations and OHFC investigations</h2>
          <p>
            MDH posts evaluation (survey) results and Office of Health Facility Complaints
            investigation results by provider. {formatHubCount(fd.evaluationRowsAttached)}{" "}
            evaluations and {formatHubCount(fd.investigationRowsAttached)} investigations ({inv})
            are attached here to {formatHubCount(fd.attachedProviders)} providers by exact HFID in
            the same provider group; {formatHubCount(fd.unattachedProviders)} providers in
            MDH&apos;s results have no matching directory row and are not attached. Results
            concluded {intel.clocks.earliest_finding_concluded} to{" "}
            {intel.clocks.latest_finding_concluded}. The documents stay on MDH and their text was
            not copied. A state evaluation is not a CMS inspection. Fines and license actions were
            not parsed. <a href={reg.findings}>Search MDH evaluation and investigation results</a>
          </p>
        </div>
      </section>

      <section className="hub-scale" id="complaints" aria-labelledby="mn-complaints-title">
        <div className="section-heading">
          <p className="eyebrow">Complaints</p>
          <h2 id="mn-complaints-title">Complaints go to OHFC</h2>
          <p>
            MDH&apos;s Office of Health Facility Complaints takes and investigates complaints about
            health care facilities. Investigation results are public within MDH&apos;s retention
            window: {intel.findings.retention} Complaints that were not investigated are not
            published. A complaint is not a deficiency and not a sanction.{" "}
            <a href={reg.fileComplaint}>File a complaint with OHFC</a>
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="mn-limits-title">
        <div className="section-heading">
          <p className="eyebrow">Limitations</p>
          <h2 id="mn-limits-title">What this page does not claim</h2>
          <ul>
            <li>
              No combined Minnesota senior-facility or bed total. Classes are counted separately.
            </li>
            <li>
              Dementia care is shown only where MDH lists the dementia-care license, never from a
              name or advertising.
            </li>
            <li>The directory lists current licenses; closed facilities are not here.</li>
            <li>
              No state row is matched to CMS by name. Unmatched is not the same as no overlap.
            </li>
            <li>Licensed beds are capacity, not residents. City is context only; no city pages.</li>
            <li>Administrators, phone numbers, emails, and street addresses are not shown.</li>
            <li>No ranking, rating, or Trust Score.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
