import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/kentucky-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/kentucky");
  return {
    title: { absolute: "Kentucky Senior Care Licenses | SeniorTrustHub" },
    description:
      "Kentucky OIG October 2026 directories for long-term care, assisted living, personal care homes, family care homes, adult day health, home health, hospice, and personal services agencies, counted separately.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function KentuckyPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const ltc = snapshot.longTermCare;
  const alc = snapshot.assistedLiving;
  const pch = snapshot.personalCareHomes;
  const fch = snapshot.familyCareHomes;
  const misc = snapshot.miscellaneous;
  const day = misc.adultDayHealth;
  const home = misc.homeHealth;
  const hospice = misc.hospice;
  const psa = snapshot.personalServicesAgencies;
  const same = alc.sameLicenseTwoFacilities;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ky-title">
        <p className="eyebrow">Kentucky senior care research</p>
        <h1 id="ky-title">Kentucky OIG Health Care Facility Directories</h1>
        <p className="home-hero__lede">
          The Cabinet for Health and Family Services, Office of Inspector General, publishes license
          directories and says the files are updated at the beginning of each month. Inclusion is
          not an endorsement. Each class below keeps its own file or its own facility-type label.
          The classes are not added together. A mixed directory total is not a Kentucky senior
          census.
        </p>
      </section>
      <section aria-labelledby="ky-rosters">
        <h2 id="ky-rosters">October 2026 directory rows</h2>
        <p>
          Workbook sheet name: {snapshot.sheetName}. Retrieved {snapshot.retrievedAt}. The sheet
          name is the directory month. It is not a day-level effective date. The September 2026 PDFs
          were not used as this population. County-arrangement workbooks were not loaded, because
          they rearrange the same directories. Street addresses and phone numbers are not
          republished, except where a collision has to be identified.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              OIG directory grains, October 2026 sheet, retrieved {snapshot.retrievedAt}
            </caption>
            <thead>
              <tr>
                <th scope="col">Directory grain</th>
                <th scope="col">Rows used</th>
                <th scope="col">Distinct identifiers</th>
                <th scope="col">Capacity as printed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Long Term Care facility rows</th>
                <td>{n(ltc.facilityRows)}</td>
                <td>{n(ltc.distinctLicenseNumbers)} license numbers</td>
                <td>
                  {n(ltc.certifiedBedSum)} certified beds on {n(ltc.certifiedBedNumericRows)} rows
                </td>
              </tr>
              <tr>
                <th scope="row">Assisted living type rows</th>
                <td>{n(alc.typeRows)}</td>
                <td>{n(alc.distinctPrintedLicenseNumbers)} license numbers</td>
                <td>{n(alc.unitsCellSum)} unit cells, not a campus capacity</td>
              </tr>
              <tr>
                <th scope="row">Personal care homes</th>
                <td>{n(pch.rows)}</td>
                <td>{n(pch.distinctLicenseNumbers)} license numbers</td>
                <td>{n(pch.bedSum)} beds</td>
              </tr>
              <tr>
                <th scope="row">Family care homes</th>
                <td>{n(fch.rows)}</td>
                <td>{n(fch.distinctLicenseNumbers)} license numbers</td>
                <td>{n(fch.printedBedCellSum)} printed bed cells, including printed zeros</td>
              </tr>
              <tr>
                <th scope="row">Adult day health</th>
                <td>{n(day.rows)}</td>
                <td>{n(day.distinctFacilityIds)} facility IDs</td>
                <td>No capacity column in this file</td>
              </tr>
              <tr>
                <th scope="row">Home health agencies</th>
                <td>{n(home.rows)}</td>
                <td>{n(home.distinctFacilityIds)} facility IDs</td>
                <td>No bed column. Not an agency census</td>
              </tr>
              <tr>
                <th scope="row">Hospice</th>
                <td>{n(hospice.rows)}</td>
                <td>{n(hospice.distinctFacilityIds)} facility IDs</td>
                <td>No bed column</td>
              </tr>
              <tr>
                <th scope="row">Personal services agencies</th>
                <td>{n(psa.rows)}</td>
                <td>{n(psa.distinctLicenseNumbers)} license numbers</td>
                <td>Not a facility license and not a bed count</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="ky-ltc">
        <h2 id="ky-ltc">Long-term care</h2>
        <p>
          The long-term care sheet has {n(ltc.sheetRows)} rows. {n(ltc.facilityRows)} have a
          facility name and a license number, and those license numbers are distinct. One additional
          row prints &ldquo;{ltc.noteRow}&rdquo; and has no facility name. That note is not a
          facility. Certified beds are blank on {n(ltc.certifiedBedBlankFacilityRows)} facility
          rows. A blank is not zero, so the {n(ltc.certifiedBedSum)} figure is the sum of the{" "}
          {n(ltc.certifiedBedNumericRows)} numeric cells. The NF, NH, ICF, ALZ, PC, and ICF/IID
          columns were not added to certified beds and were not treated as separate facilities.
        </p>
      </section>
      <section aria-labelledby="ky-alc">
        <h2 id="ky-alc">Assisted living categories</h2>
        <p>
          <a href={snapshot.assistedLivingRegulation}>902 KAR 20:480</a> sets three licensure
          categories: social model ALC, ALC-BH for basic health and health-related services without
          a secured dementia care unit, and ALC-DC for dementia care in a secured unit. The workbook
          prints ALC {n(alc.types.ALC)}, ALC-BH {n(alc.types["ALC-BH"])}, and ALC-DC{" "}
          {n(alc.types["ALC-DC"])}. Those codes are type rows. They are not added into a facility
          census. Distinct facilities are not calculated.
        </p>
        <p>
          {alc.rowWithoutLicenseNumber.name} in {alc.rowWithoutLicenseNumber.city} is an{" "}
          {alc.rowWithoutLicenseNumber.type} row with {n(alc.rowWithoutLicenseNumber.units)} units
          and no license number. License {alc.sameFacilityTwoTypes.licenseNumber} is one facility,{" "}
          {alc.sameFacilityTwoTypes.name} in {alc.sameFacilityTwoTypes.city}, printed once as ALC
          and once as ALC-DC, with {n(alc.sameFacilityTwoTypes.unitsPrintedOnEachRow)} units on each
          row. License {same.licenseNumber} is printed on two different ALC-DC facilities:{" "}
          {same.facilities[0]!.name} in {same.facilities[0]!.city} and {same.facilities[1]!.name} in{" "}
          {same.facilities[1]!.city}. The rows were not collapsed. The unit-cell sum of{" "}
          {n(alc.unitsCellSum)} counts the shared facility&apos;s{" "}
          {n(alc.sameFacilityTwoTypes.unitsPrintedOnEachRow)} units twice and is not a
          distinct-campus capacity. Pending Renewal is printed on {n(alc.pendingRenewalRows)}{" "}
          assisted-living rows. That text is not an expiration date and is not proof that the
          license is current.
        </p>
      </section>
      <section aria-labelledby="ky-homes">
        <h2 id="ky-homes">Personal care homes and family care homes</h2>
        <p>
          Personal care homes: {n(pch.rows)} rows, {n(pch.distinctLicenseNumbers)} license numbers,{" "}
          {n(pch.bedSum)} beds. Pending Renewal is printed on {n(pch.pendingRenewalRows)} rows.
          Family care homes: {n(fch.rows)} rows and {n(fch.distinctLicenseNumbers)} license numbers.{" "}
          {n(fch.bedsPrinted3)} rows print 3 beds and {n(fch.bedsPrinted0)} rows print 0 beds. The
          printed bed-cell sum is {n(fch.printedBedCellSum)}. A printed 0 is a printed zero, not an
          unknown. Pending Renewal is printed on {n(fch.pendingRenewalRows)} family-care rows. Owner
          is blank on {n(fch.ownerBlankRows)} family-care rows. Personal care homes, family care
          homes, and assisted living communities stay separate.
        </p>
      </section>
      <section aria-labelledby="ky-misc">
        <h2 id="ky-misc">Three labels from the miscellaneous directory</h2>
        <p>
          The miscellaneous workbook has {n(misc.rows)} rows and {n(misc.typeLabels)} facility-type
          labels. It is not a senior census. Only three labels are used here. Leaving the other
          labels out is not a count of zero. Hospitals, rural health clinics, behavioral health, and
          the other labels were not given senior counts.
        </p>
        <p>
          Adult day health, label {day.label}: {n(day.rows)} rows and {n(day.distinctFacilityIds)}{" "}
          facility IDs, all with state KY. Pending Renewal is printed on {n(day.pendingRenewalRows)}{" "}
          rows.
        </p>
        <p>
          Home health, label {home.label}: {n(home.rows)} rows and {n(home.distinctFacilityIds)}{" "}
          distinct facility IDs. {n(home.rowsWithoutFacilityId)} rows have no facility ID. Facility
          ID {home.repeatedFacilityId} is printed on {n(home.repeatedFacilityIdRows)} rows with the
          same name, city, and expiration. Those two rows were not collapsed, and {n(home.rows)} is
          not an agency census. The owner column is not populated. {n(home.renewalPendingRows)} rows
          print &ldquo;{home.renewalPendingLabel}&rdquo;, which is a different string from Pending
          Renewal.
        </p>
        <p>
          Hospice, label {hospice.label}: {n(hospice.rows)} rows and{" "}
          {n(hospice.distinctFacilityIds)} distinct facility IDs. Facility ID{" "}
          {hospice.sharedLocationId} is printed on {n(hospice.sharedLocationRows)} location rows.
          Those rows were not collapsed into one hospice and were not counted as{" "}
          {n(hospice.sharedLocationRows)} hospices. The owner column is not populated. Every hospice
          row prints a date in the expiration column.
        </p>
      </section>
      <section aria-labelledby="ky-psa">
        <h2 id="ky-psa">Personal services agencies</h2>
        <p>
          The personal services agency directory is a separate October 2026 file with {n(psa.rows)}{" "}
          license rows and {n(psa.distinctLicenseNumbers)} license numbers. It is not a facility
          license and it is not added to the facility classes. Office state is Kentucky on{" "}
          {n(psa.officeState.KY)} rows, Indiana on {n(psa.officeState.IN)}, Ohio on{" "}
          {n(psa.officeState.OH)}, Tennessee on {n(psa.officeState.TN)}, and West Virginia on{" "}
          {n(psa.officeState.WV)}. An office outside Kentucky stays in the license count. It is not
          a service area and it does not remove the Kentucky license. Pending Renewal is printed on{" "}
          {n(psa.pendingRenewalRows)} rows.
        </p>
      </section>
      <section aria-labelledby="ky-inspections">
        <h2 id="ky-inspections">Inspections, complaints, and enforcement</h2>
        <p>
          <a href={snapshot.inspectionSearchUrl}>OIG posts inspection findings</a> for certified
          long-term care, and personal care home inspections are included beginning in 2024. The
          current files are searchable databases, not a bulk download acquired here. The search is
          KNOWN. Inspection rows, deficiency rows, and complaint rows were NOT_ACQUIRED. That is not
          zero surveys and not zero complaints. A complaint survey type is not a finding. The source
          says a facility is considered back in compliance when a statement of deficiency and plan
          of correction is posted. That posting rule is not a compliance census, because the rows
          were not acquired.
        </p>
        <p>
          A provider-level enforcement roster was NOT_ACQUIRED, not zero actions. No adverse action
          was joined by name. Name-only adverse joins: {snapshot.nameOnlyAdverseJoins}. An open
          records request was NOT_FILED. <a href={snapshot.openRecordsUrl}>OIG open records</a>{" "}
          remains available.
        </p>
      </section>
      <section aria-labelledby="ky-cms">
        <h2 id="ky-cms">CMS and Medicaid</h2>
        <p>
          CMS Care Compare is a federal overlay and was not bridged. Exact state-to-CMS bridges: not
          attempted. These directories do not print a CMS certification number, so no bridge count
          is published. Kentucky Medicaid provider enrollment was NOT_ACQUIRED. Facility licensure
          is not Medicaid enrollment. New canonical facilities: {snapshot.newCanonicalFacilities}.
          Existing <Link href="/">CMS provider profiles</Link> keep their own source clock.
        </p>
      </section>
      <section aria-labelledby="ky-geography">
        <h2 id="ky-geography">Geography</h2>
        <p>
          There is no city route. Louisville and Lexington are geography only. They are not separate
          license systems and they do not have their own counts on this page.
        </p>
      </section>
      <section aria-labelledby="ky-clocks">
        <h2 id="ky-clocks">Source clocks and limits</h2>
        <p>
          Directory index retrieved {snapshot.retrievedAt}. Directory month{" "}
          {snapshot.directoryMonth}. Graph writes: {snapshot.graphWrites}; claim eligibility
          changes: {snapshot.claimEligibilityChanges}; city routes: {snapshot.cityRoutes}. No
          quality ranking, winner, or combined class total is offered.
        </p>
      </section>
    </div>
  );
}
