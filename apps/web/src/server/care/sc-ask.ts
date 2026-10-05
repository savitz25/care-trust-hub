import snapshot from "@/data/south-carolina-public-snapshot.json";

const CITY = /\b(charleston|columbia|greenville)\b/i;
const n = (value: number) => value.toLocaleString("en-US");
const nh = snapshot.nursingHomes;
const crcf = snapshot.communityResidentialCare;
const home = snapshot.homeHealth;
const hospiceFacility = snapshot.hospiceFacilities;
const hospiceProgram = snapshot.hospicePrograms;
const day = snapshot.adultDay;
const inHome = snapshot.inHomeCare;
const icf15 = snapshot.intermediateCare15OrFewer;
const icf16 = snapshot.intermediateCare16OrMore;

export function southCarolinaIntent(q: string): boolean {
  return /\bsouth carolina\b/i.test(q) || /\bin sc\b/i.test(q);
}

export function interpretSouthCarolinaAsk(q: string) {
  if (!southCarolinaIntent(q)) return null;
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open South Carolina senior-care research at /south-carolina."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Charleston, Columbia, and Greenville are geography only. No city route is published."
    : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend South Carolina facilities. No provider winner is selected. Open /south-carolina.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt)\b/i.test(q))
    return answer(
      "A provider-level enforcement roster was NOT_ACQUIRED, which is not zero actions. No adverse action was joined by name. Open /south-carolina.",
      "NOT_ACQUIRED",
    );
  if (/\b(inspections?|surveys?|deficienc)/i.test(q))
    return answer(
      "DPH posts a searchable CMS survey application for certified nursing facilities. That search is KNOWN. Inspection and deficiency rows were NOT_ACQUIRED, which is not zero surveys. A CMS certification indicator on a license row was not joined to a survey. Open /south-carolina.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "Provider-level complaint rows were NOT_ACQUIRED. A complaint is not a finding. Open /south-carolina.",
      "NOT_ACQUIRED",
    );
  if (/\b(memory care|alzheimer|dementia)\b/i.test(q))
    return answer(
      `Alzheimer flags on Community Residential Care Facility rows are not a license class. Unit and care both Y: ${n(crcf.alzheimerFlags.unitYCareY)}. Unit N and care N: ${n(crcf.alzheimerFlags.unitNCareN)}. Unit N and care Y: ${n(crcf.alzheimerFlags.unitNCareY)}. Unit Y and care N: ${n(crcf.alzheimerFlags.unitYCareN)}. Those flags are not added into an assisted-living count. The CRCF license rows remain ${n(crcf.rows)}.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/\b(assisted living|community residential)\b/i.test(q))
    return answer(
      `Community Residential Care Facility is the South Carolina license class that may include facilities marketed as assisted living. The DPH service has ${n(crcf.rows)} CRCF license rows and ${n(crcf.distinctLicenseNumbers)} license numbers. That is not a nursing-home count and not a combined assisted-living census. Licensed-number cells sum to ${n(crcf.licensedNumberSum)}. CRC total beds are populated on ${n(crcf.crcTotalBedsNumericRows)} rows and sum to ${n(crcf.crcTotalBedsSum)}. ${n(crcf.crcTotalBedsBlankRows)} rows leave CRC total beds blank, and a blank is not zero. The two bed fields are not the same number. ${crcf.sameNameTwoLicenses.name} is printed on ${crcf.sameNameTwoLicenses.licenses[0]} and ${crcf.sameNameTwoLicenses.licenses[1]} and was not collapsed.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/\bin[- ]home care\b/i.test(q) && !/home health/i.test(q))
    return answer(
      `In-home care is permit type ${inHome.permitType}, with ${n(inHome.rows)} license rows. It is not home health. Every row prints ${inHome.licensedNumberSentinel} in the licensed-number column. That sentinel is not a bed count and is not zero. Office state is South Carolina on ${n(inHome.officeState.SC)} rows, North Carolina on ${n(inHome.officeState.NC)}, and Georgia on ${n(inHome.officeState.GA)}. An office outside South Carolina does not remove the South Carolina license and is not a service area.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/home health/i.test(q))
    return answer(
      `Home health is permit type ${home.permitType}, with ${n(home.rows)} license rows and ${n(home.distinctLicenseNumbers)} license numbers. It is not in-home care and it is not a senior-only census. ${n(home.restrictionPrintedRows)} rows print a license restriction. ${n(home.restrictionBlankRows)} leave that cell blank, and a blank is not a finding of no restriction. ${home.sameNameTwoLicenses.name} is ${home.sameNameTwoLicenses.licenses[0]} in ${home.sameNameTwoLicenses.cities[0]} and ${home.sameNameTwoLicenses.licenses[1]} in ${home.sameNameTwoLicenses.cities[1]}. Those rows were not collapsed. The licensed-number column was not treated as beds.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/\bhospice\b/i.test(q))
    return answer(
      `Hospice facilities and hospice programs are separate permit types and are not added. Facilities: ${n(hospiceFacility.rows)} license rows and ${n(hospiceFacility.licensedBedSum)} licensed beds. Programs: ${n(hospiceProgram.rows)} license rows. On every program row the licensed number equals counties served, and ${n(hospiceProgram.rowsPrinting46Counties)} rows print 46. A sum of those county cells is not a census. ${hospiceProgram.sameNameTwoLicenses.name} is printed on ${hospiceProgram.sameNameTwoLicenses.licenses[0]} and ${hospiceProgram.sameNameTwoLicenses.licenses[1]} and was not collapsed.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/adult day/i.test(q))
    return answer(
      `Adult day care has ${n(day.rows)} license rows. Participant cells are numeric on ${n(day.participantNumericRows)} rows and sum to ${n(day.participantSum)}. ${day.blankExample.licenseNumber} ${day.blankExample.name} leaves participants blank, and a blank is not zero. The licensed-number column matches participants on every row.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/\b(intermediate care|icf\/iid|icf)\b/i.test(q))
    return answer(
      `Intermediate care is not a nursing home and not a senior census. The 15-or-fewer bed building type has ${n(icf15.rows)} license rows and licensed numbers summing to ${n(icf15.licensedNumberSum)}. The 16-or-more bed building type has ${n(icf16.rows)} license rows and licensed numbers summing to ${n(icf16.licensedNumberSum)}. Those two permit types are not added.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  if (/nursing home|nursing facilit|skilled nursing/i.test(q))
    return answer(
      `Nursing homes are permit type ${nh.permitType}, with ${n(nh.rows)} license rows and ${n(nh.distinctLicenseNumbers)} license numbers. Licensed beds sum to ${n(nh.licensedBedSum)}. Nursing-home beds sum to ${n(nh.nursingHomeBedSum)}, including ${n(nh.nursingHomeBedPrintedZeroRows)} printed zero. ${nh.printedZeroExample.licenseNumber} ${nh.printedZeroExample.name} prints ${nh.printedZeroExample.nursingHomeBeds} nursing-home beds and ${nh.printedZeroExample.institutionalBeds} institutional beds. Institutional beds are blank on ${n(nh.institutionalBedBlankRows)} rows, and a blank is not zero. CMS indicator Y is printed on ${n(nh.cmsIndicatorYes)} rows. A blank CMS indicator is not a finding of no certification, and no CMS survey was joined.` +
        geography +
        " Open /south-carolina.",
      "KNOWN",
    );
  return answer(
    `SeniorTrustHub does not publish a combined South Carolina senior facility total. Nursing homes (${n(nh.rows)} license rows), community residential care facilities, home health, hospice facilities, hospice programs, adult day care, in-home care, and intermediate care stay separate. Those classes are not added. The service data clock is ${snapshot.source.dataLastEditDate}.` +
      geography +
      " Open /south-carolina.",
    "KNOWN",
  );
}
