import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/alabama-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/alabama");
  return {
    title: { absolute: "Alabama Senior Care Licenses | SeniorTrustHub" },
    description:
      "Alabama Department of Public Health directory exports for nursing homes, assisted living, specialty care assisted living, home health, and hospice, counted separately.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function AlabamaPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const beds = (value: number | null) => (value === null ? "blank" : n(value));
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="al-title">
        <p className="eyebrow">Alabama senior care research</p>
        <h1 id="al-title">Alabama Department of Public Health Facility Directories</h1>
        <p className="home-hero__lede">
          The Bureau of Health Provider Standards directory lists health care facilities licensed by
          the Alabama State Board of Health and providers that are not subject to state licensure
          but participate in Medicare or Medicaid. Each class below keeps its own directory export
          and its own line on the Division of Provider Services statistical summary. The classes are
          not added together. A mixed directory total is not an Alabama license census. The
          statistical summary&apos;s all-facility grand total is not a senior census and is not used
          on this page.
        </p>
      </section>
      <section aria-labelledby="al-rosters">
        <h2 id="al-rosters">Statewide directory exports</h2>
        <p>
          Each export is one Facilities Directory report for one facility type, with county, city,
          and status set to All. Retrieved {snapshot.retrievedAt}. A Fac ID is the directory
          identifier. License number is {snapshot.licenseNumberColumn}. A repeated printed name
          stays its own row. Rows are not deduplicated licensed campuses.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              ADPH Facilities Directory exports by class, retrieved {snapshot.retrievedAt}
            </caption>
            <thead>
              <tr>
                <th scope="col">Directory class</th>
                <th scope="col">Directory rows</th>
                <th scope="col">Fac IDs</th>
                <th scope="col">Distinct names</th>
                <th scope="col">Licensed-bed sum</th>
                <th scope="col">Medicare number cells</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sources.map((source) => (
                <tr key={source.class}>
                  <th scope="row">{source.label}</th>
                  <td>{n(source.directoryRows)}</td>
                  <td>{n(source.distinctFacIds)}</td>
                  <td>{n(source.distinctPrintedNames)}</td>
                  <td>{beds(source.licensedBedsSum)}</td>
                  <td>{n(source.medicareNumberPrintedRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Home health has{" "}
          {n(snapshot.sources.find((s) => s.class === "home-health")!.directoryRows)} directory rows
          and {n(snapshot.sources.find((s) => s.class === "home-health")!.distinctPrintedNames)}{" "}
          distinct printed names. The licensed-beds column was blank on every home-health row, so no
          bed sum is published for that export. Every home-health row has license status &ldquo;Not
          subject to licensure.&rdquo; That row count is not a licensed-agency count and is not a
          certified-agency count.
        </p>
      </section>
      <section aria-labelledby="al-summary">
        <h2 id="al-summary">Statistical summary, same morning</h2>
        <p>
          {snapshot.statisticalSummary.issuer} {snapshot.statisticalSummary.title}, report clock{" "}
          {snapshot.statisticalSummary.reportClock}. The printed lines below are the senior classes
          on that report. Other facility types on the same report were not used as senior classes.
          Leaving a type out is not a count of zero.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Printed statistical-summary lines for the senior classes</caption>
            <thead>
              <tr>
                <th scope="col">Printed class</th>
                <th scope="col">Line</th>
                <th scope="col">Licensed facilities</th>
                <th scope="col">Certified facilities</th>
                <th scope="col">Licensed beds or stations</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.statisticalSummary.classes.map((cls) =>
                cls.lines.map((line) => (
                  <tr key={`${cls.class}-${line.label}`}>
                    <th scope="row">{cls.label}</th>
                    <td>{line.label}</td>
                    <td>{n(line.licensedFacilities)}</td>
                    <td>{n(line.certifiedFacilities)}</td>
                    <td>{n(line.licensedBedsOrStations)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p>
          The Nursing Homes printed total includes the ICF/IID line, the Nursing Facility line, and
          the Skilled Nursing Facility line. It is not a pure skilled-nursing census. The nursing
          directory has 232 rows because two ICF/IID rows are &ldquo;Not subject to
          licensure.&rdquo; The hospice statistical summary prints 100 licensed beds or stations.
          The hospice export bed sum is 99. Both figures stay. They were not forced to match.
        </p>
      </section>
      <section aria-labelledby="al-exceptions">
        <h2 id="al-exceptions">Status rows that explain the class counts</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Directory rows whose license status is not Regular</caption>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Facility</th>
                <th scope="col">Fac ID</th>
                <th scope="col">License status</th>
                <th scope="col">Class 1</th>
                <th scope="col">Licensed beds</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.directoryExceptions.map((row) => (
                <tr key={row.facId}>
                  <td>{row.class}</td>
                  <td>{row.name}</td>
                  <td>{row.facId}</td>
                  <td>{row.licenseStatus}</td>
                  <td>{row.class1}</td>
                  <td>{beds(row.licensedBeds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The Probational specialty-care status is the license-status cell on that directory row. It
          was not joined to a separate enforcement action.{" "}
          <a href={snapshot.descriptionsUrl}>ADPH&apos;s facility descriptions</a> say a specialty
          care assisted living facility meets the assisted-living definition and is specially
          licensed and staffed for residents whose cognitive impairment would ordinarily make them
          ineligible for assisted living. That class stays separate from assisted living. Memory
          care is not its own directory class.
        </p>
        <p>
          Hospice in-patient licensed beds on the export:{" "}
          {snapshot.hospiceInpatientBedRows
            .map((row) => `${row.name} ${n(row.licensedBeds)}`)
            .join("; ")}
          . Those seven beds sum to 99.
        </p>
      </section>
      <section aria-labelledby="al-owner">
        <h2 id="al-owner">Licensee type</h2>
        <p>
          Licensee type is a form label on the directory row. Owner legal name is{" "}
          {snapshot.ownerLegalNameColumn}. No organization was created from a form label. The home
          health label &ldquo;State of Alabama&rdquo; is that form label on 15 rows. It is not an
          owner record and it is not a program census.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Licensee-type labels by directory class</caption>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Licensee type</th>
                <th scope="col">Rows</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sources.flatMap((source) =>
                source.licenseeType.map((row) => (
                  <tr key={`${source.class}-${row.label}`}>
                    <th scope="row">{source.label}</th>
                    <td>{row.label}</td>
                    <td>{n(row.count)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="al-cms">
        <h2 id="al-cms">State directory rows and CMS certification</h2>
        <p>
          CMS Care Compare is a federal overlay and was not bridged. Exact state-to-CMS bridges:{" "}
          {snapshot.cmsExactBridges}. A Medicare number cell that is non-blank was counted in the
          table above. The numbers were not stored. Matching a cell count to a certified-facility
          count is not an identity bridge. Deemed status was blank on every nursing-home, assisted
          living, and specialty-care row. It was No on every home-health row. Hospice deemed status
          was Yes on 137 rows and No on 51 rows. New canonical facilities:{" "}
          {snapshot.newCanonicalFacilities}. Existing <Link href="/">CMS provider profiles</Link>{" "}
          keep their own source clock.
        </p>
        <p>
          <a href={snapshot.specialFocusFacility.sourceUrl}>
            ADPH names one CMS Special Focus Facility
          </a>
          : {snapshot.specialFocusFacility.name},{" "}
          {snapshot.specialFocusFacility.addressAsPrintedByAdph}, notified{" "}
          {snapshot.specialFocusFacility.notified}. That designation was not joined to a directory
          Fac ID. The nursing-home page update of {snapshot.specialFocusFacility.pageUpdated} is not
          a roster-as-of date.
        </p>
      </section>
      <section aria-labelledby="al-inspections">
        <h2 id="al-inspections">Inspections, deficiencies, and enforcement</h2>
        <p>
          <a href={snapshot.surveyProgramUrl}>The Bureau of Health Provider Standards</a> licenses
          and certifies health care facilities. The Division of Health Care Facilities conducts
          surveys. Noncompliance requires a corrective action plan. That survey program is KNOWN.{" "}
          <a href={snapshot.deficienciesUrl}>Health care facility deficiencies</a> are posted
          through an interactive session. Provider-level inspection rows were NOT_ACQUIRED.
          Deficiency rows were NOT_ACQUIRED. That is not zero surveys and not zero deficiencies.
        </p>
        <p>
          A statewide provider-level enforcement roster was NOT_ACQUIRED, not zero actions. Informal
          dispute resolution and independent informal dispute resolution are described processes for
          skilled nursing. They are not a sanction roster. No adverse action was joined by name.
          Name-only adverse joins: {snapshot.nameOnlyAdverseJoins}.
        </p>
      </section>
      <section aria-labelledby="al-complaints">
        <h2 id="al-complaints">Complaints</h2>
        <p>
          <a href={snapshot.complaintIntakeUrl}>ADPH posts complaint intake</a> for assisted living,
          for home health or hospice together, and for nursing homes. Specialty care assisted living
          visitation complaints use the assisted-living intake anchor on that page. Intake is KNOWN.
          The complaint page update of {snapshot.complaintPageUpdated} is not a complaint-row clock.
          Provider-level complaint rows were NOT_ACQUIRED. A complaint is not a finding.
        </p>
      </section>
      <section aria-labelledby="al-other">
        <h2 id="al-other">Classes left out of these counts</h2>
        <p>
          {snapshot.adultDay.reason} The Alabama Department of Senior Services is the{" "}
          {snapshot.alabamaDepartmentOfSeniorServices.role}. It was not used as the facility
          licensing roster. Hospitals, laboratories, end stage renal disease treatment centers, and
          the other non-senior types on the same directory were not given senior counts.
        </p>
      </section>
      <section aria-labelledby="al-geography">
        <h2 id="al-geography">Geography</h2>
        <p>
          There is no city route. Birmingham, Montgomery, Huntsville, Mobile, and Tuscaloosa are
          geography only. They are not separate license systems and they do not have their own
          counts on this page.
        </p>
      </section>
      <section aria-labelledby="al-clocks">
        <h2 id="al-clocks">Source clocks and limits</h2>
        <p>
          {snapshot.retrievedAtNote} The 2027 online license renewal season runs{" "}
          {snapshot.licenseRenewal.season}. ADPH says 2026 health care facility licenses expire{" "}
          {snapshot.licenseRenewal.statedExpirationOf2026Licenses}. That season is not the roster
          clock. Street addresses and phone numbers from the directory exports are not republished.
          The Special Focus Facility address above is the address ADPH printed with that
          designation.
        </p>
        <p>
          Graph writes: {snapshot.graphWrites}; claim eligibility changes:{" "}
          {snapshot.claimEligibilityChanges}; city routes: {snapshot.cityRoutes}. No quality
          ranking, winner, or combined class total is offered.
        </p>
      </section>
    </div>
  );
}
