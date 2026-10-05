import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/south-carolina-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/south-carolina");
  return {
    title: { absolute: "South Carolina Senior Care Licenses | SeniorTrustHub" },
    description:
      "South Carolina DPH license rows for nursing homes, community residential care, home health, hospice, adult day, in-home care, and intermediate care, counted separately.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function SouthCarolinaPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const nh = snapshot.nursingHomes;
  const crcf = snapshot.communityResidentialCare;
  const home = snapshot.homeHealth;
  const facility = snapshot.hospiceFacilities;
  const program = snapshot.hospicePrograms;
  const day = snapshot.adultDay;
  const inHome = snapshot.inHomeCare;
  const icf15 = snapshot.intermediateCare15OrFewer;
  const icf16 = snapshot.intermediateCare16OrMore;
  const lakeside = crcf.sameNameTwoLicenses;
  const adoration = home.sameNameTwoLicenses;
  const gentiva = program.sameNameTwoLicenses;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="sc-title">
        <p className="eyebrow">South Carolina senior care research</p>
        <h1 id="sc-title">South Carolina DPH licensed facility classes</h1>
        <p className="home-hero__lede">
          This page does not publish a combined South Carolina senior facility total. Nursing homes,
          community residential care facilities, home health, hospice facilities, hospice programs,
          adult day care, in-home care, and intermediate care keep their own permit types. A
          community residential care facility may be marketed as assisted living. That marketing
          name is not a separate license class, and unlike classes are not relabeled into one
          census. This page does not rank facilities.
        </p>
      </section>
      <section aria-labelledby="sc-rosters">
        <h2 id="sc-rosters">License rows on the DPH facility service</h2>
        <p>
          Source: the <a href={snapshot.source.mapPage}>DPH Find a Facility</a> map, served from the{" "}
          <a href={snapshot.source.featureService}>Health Facilities feature service</a>. Data last
          edit {snapshot.source.dataLastEditDate}. Retrieved {snapshot.source.retrievedAt}. A
          webpage update date is not this roster clock. Every kept row prints operating code ACT.
          That code is printed as ACT. SHA-256 of the class extract {snapshot.source.extractSha256}.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>DPH permit types, retrieved {snapshot.source.retrievedAt}</caption>
            <thead>
              <tr>
                <th scope="col">Permit type</th>
                <th scope="col">License rows</th>
                <th scope="col">Capacity as printed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Nursing homes</th>
                <td>{n(nh.rows)}</td>
                <td>{n(nh.licensedBedSum)} licensed beds</td>
              </tr>
              <tr>
                <th scope="row">Community residential care facilities</th>
                <td>{n(crcf.rows)}</td>
                <td>{n(crcf.licensedNumberSum)} licensed-number cells</td>
              </tr>
              <tr>
                <th scope="row">Home health agencies</th>
                <td>{n(home.rows)}</td>
                <td>Licensed-number column was not treated as beds</td>
              </tr>
              <tr>
                <th scope="row">Hospice facilities</th>
                <td>{n(facility.rows)}</td>
                <td>{n(facility.licensedBedSum)} licensed beds</td>
              </tr>
              <tr>
                <th scope="row">Hospice programs</th>
                <td>{n(program.rows)}</td>
                <td>Licensed number equals counties served, not beds</td>
              </tr>
              <tr>
                <th scope="row">Adult day care</th>
                <td>{n(day.rows)}</td>
                <td>
                  {n(day.participantSum)} participants on {n(day.participantNumericRows)} rows
                </td>
              </tr>
              <tr>
                <th scope="row">In-home care</th>
                <td>{n(inHome.rows)}</td>
                <td>Not a bed license</td>
              </tr>
              <tr>
                <th scope="row">Intermediate care, 15 or fewer beds</th>
                <td>{n(icf15.rows)}</td>
                <td>{n(icf15.licensedNumberSum)} licensed-number cells. Not a senior census</td>
              </tr>
              <tr>
                <th scope="row">Intermediate care, 16 or more beds</th>
                <td>{n(icf16.rows)}</td>
                <td>{n(icf16.licensedNumberSum)} licensed-number cells. Not a senior census</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="sc-nh">
        <h2 id="sc-nh">Nursing homes</h2>
        <p>
          Permit type {nh.permitType}. {n(nh.rows)} license rows and {n(nh.distinctLicenseNumbers)}{" "}
          license numbers. The DPH comparison document prints state licensure under{" "}
          {snapshot.regulations.nursingHomeStateLicensure}. That document is not this roster.
          Licensed beds sum to {n(nh.licensedBedSum)}. Nursing-home beds sum to{" "}
          {n(nh.nursingHomeBedSum)}, including {n(nh.nursingHomeBedPrintedZeroRows)} printed zero.{" "}
          {nh.printedZeroExample.licenseNumber} {nh.printedZeroExample.name} prints{" "}
          {nh.printedZeroExample.nursingHomeBeds} nursing-home beds and{" "}
          {nh.printedZeroExample.institutionalBeds} institutional beds. Institutional beds are
          numeric on {n(nh.institutionalBedNumericRows)} rows, sum {n(nh.institutionalBedSum)}, and
          blank on {n(nh.institutionalBedBlankRows)} rows. A blank is not zero. CMS indicator Y is
          printed on {n(nh.cmsIndicatorYes)} rows and blank on {n(nh.cmsIndicatorBlank)} rows. A
          blank indicator is not a finding that the facility is uncertified. Those identifiers were
          not joined to CMS surveys.
        </p>
      </section>
      <section aria-labelledby="sc-crcf">
        <h2 id="sc-crcf">Community residential care facilities</h2>
        <p>
          Permit type {crcf.permitType}. {n(crcf.rows)} license rows. Regulation{" "}
          {snapshot.regulations.communityResidentialCare}, as printed in the DPH comparison
          document, is the state licensure rule for this class. Facilities in this class may be
          called assisted living. They are not nursing homes, and the Alzheimer flags on the same
          rows are not another license class. Unit and care both Y:{" "}
          {n(crcf.alzheimerFlags.unitYCareY)}. Unit N and care N:{" "}
          {n(crcf.alzheimerFlags.unitNCareN)}. Unit N and care Y:{" "}
          {n(crcf.alzheimerFlags.unitNCareY)}. Unit Y and care N:{" "}
          {n(crcf.alzheimerFlags.unitYCareN)}. Licensed-number cells sum to{" "}
          {n(crcf.licensedNumberSum)}. CRC total beds are populated on{" "}
          {n(crcf.crcTotalBedsNumericRows)} rows and sum to {n(crcf.crcTotalBedsSum)}.{" "}
          {n(crcf.crcTotalBedsBlankRows)} rows leave CRC total beds blank, and a blank is not zero.
          Where both fields are populated they are not the same number on every row. {lakeside.name}{" "}
          is {lakeside.licenses[0]} and {lakeside.licenses[1]}, both in {lakeside.cities[0]}. Those
          are two license rows and were not collapsed. CMS indicator Y is printed on{" "}
          {n(crcf.cmsIndicatorYes)} rows.
        </p>
      </section>
      <section aria-labelledby="sc-home">
        <h2 id="sc-home">Home health, hospice, adult day, and in-home care</h2>
        <p>
          Home health, {home.permitType}: {n(home.rows)} license rows. This is not in-home care and
          not a senior-only census. {n(home.restrictionPrintedRows)} rows print a restriction,
          including obstetric patients only and pediatric patients only.{" "}
          {n(home.restrictionBlankRows)} leave the restriction blank, and a blank is not a finding
          of no restriction. {adoration.name} is {adoration.licenses[0]} in {adoration.cities[0]}{" "}
          and {adoration.licenses[1]} in {adoration.cities[1]}. The licensed-number column was not
          treated as beds.
        </p>
        <p>
          Hospice facilities, {facility.permitType}: {n(facility.rows)} license rows and{" "}
          {n(facility.licensedBedSum)} licensed beds. No facility row prints CMS indicator Y.
          Hospice programs, {program.permitType}: {n(program.rows)} license rows. On every program
          row the licensed number equals counties served. {n(program.rowsPrinting46Counties)} rows
          print 46. A sum of those county cells is not a county census and is not a bed count.{" "}
          {gentiva.name} is {gentiva.licenses[0]} in {gentiva.cities[0]} and {gentiva.licenses[1]}{" "}
          in {gentiva.cities[1]}. Facilities and programs are not added.
        </p>
        <p>
          Adult day care, {day.permitType}: {n(day.rows)} license rows. Participants sum to{" "}
          {n(day.participantSum)} on {n(day.participantNumericRows)} rows.{" "}
          {day.blankExample.licenseNumber} {day.blankExample.name} in {day.blankExample.city} leaves
          participants blank, and a blank is not zero.
        </p>
        <p>
          In-home care, {inHome.permitType}: {n(inHome.rows)} license rows. Every row prints{" "}
          {inHome.licensedNumberSentinel} in the licensed-number column. That sentinel is not a bed
          count and is not zero. Office state is South Carolina on {n(inHome.officeState.SC)} rows,
          North Carolina on {n(inHome.officeState.NC)}, and Georgia on {n(inHome.officeState.GA)}.
          An office outside South Carolina does not remove the license and is not a service area.
        </p>
      </section>
      <section aria-labelledby="sc-icf">
        <h2 id="sc-icf">Intermediate care</h2>
        <p>
          These building types are intermediate care facilities. They are not nursing homes and they
          are not a senior census. {icf15.layerTitle}: {n(icf15.rows)} license rows, licensed
          numbers summing to {n(icf15.licensedNumberSum)}. CMS indicator Y is printed on{" "}
          {n(icf15.cmsIndicatorYes)} rows and blank on {n(icf15.cmsIndicatorBlank)} row. A blank is
          not a finding of no certification. {icf16.layerTitle}: {n(icf16.rows)} license rows,
          licensed numbers summing to {n(icf16.licensedNumberSum)}, and CMS indicator Y on every
          row. The two building types are not added.
        </p>
      </section>
      <section aria-labelledby="sc-evidence">
        <h2 id="sc-evidence">Inspections, complaints, CMS, and administrators</h2>
        <p>
          The <a href={snapshot.inspectionSearchUrl}>CMS survey application</a> is KNOWN for
          certified nursing facilities. Inspection rows, deficiency rows, and complaint rows were
          NOT_ACQUIRED. That is not zero surveys and not zero complaints. A complaint is not a
          finding. Enforcement orders were NOT_ACQUIRED. Name-only adverse joins:{" "}
          {snapshot.nameOnlyAdverseJoins}. An open records request was NOT_FILED. CMS Care Compare
          was not bridged. Exact bridges: not attempted. A printed CMS certification identifier is
          not a survey finding.
        </p>
        <p>
          The comparison document says administrators are licensed by the{" "}
          {snapshot.regulations.administratorLicensor}. An administrator license is not a facility
          license. The administrator roster was NOT_ACQUIRED. Graph writes: {snapshot.graphWrites}.
          New canonical facilities: {snapshot.newCanonicalFacilities}.
        </p>
      </section>
      <section aria-labelledby="sc-geography">
        <h2 id="sc-geography">Geography</h2>
        <p>
          Charleston, Columbia, and Greenville are geography only. This research publishes no city
          route. <Link href="/">Existing CMS profiles</Link> keep their own source clock.
        </p>
      </section>
    </div>
  );
}
