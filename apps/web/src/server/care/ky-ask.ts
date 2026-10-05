import snapshot from "@/data/kentucky-public-snapshot.json";

const CARE =
  /nursing home|long[- ]term care|nursing facilit|skilled nursing|assisted living|memory care|dementia|personal care|family care|home health|hospice|senior|adult day|personal services|inspection|survey|enforcement|complaint/i;
const CITY = /\b(louisville|lexington)\b/i;
const OTHER =
  /\b(alabama|arizona|california|colorado|connecticut|florida|georgia|illinois|indiana|louisiana|maryland|massachusetts|michigan|minnesota|nevada|new jersey|new york|north carolina|ohio|oregon|pennsylvania|tennessee|texas|virginia|washington|wisconsin)\b/i;

const n = (value: number) => value.toLocaleString("en-US");
const ltc = snapshot.longTermCare;
const alc = snapshot.assistedLiving;
const pch = snapshot.personalCareHomes;
const fch = snapshot.familyCareHomes;
const day = snapshot.miscellaneous.adultDayHealth;
const home = snapshot.miscellaneous.homeHealth;
const hospice = snapshot.miscellaneous.hospice;
const psa = snapshot.personalServicesAgencies;

function explicitKentucky(q: string): boolean {
  return /\bkentucky\b/i.test(q) || /\bky\b/i.test(q);
}

export function kentuckyIntent(q: string, stateCode?: string): boolean {
  const explicit = explicitKentucky(q);
  if (stateCode && stateCode !== "KY" && !explicit) return false;
  if (OTHER.test(q) && !explicit) return false;
  if (explicit || stateCode === "KY") return true;
  return CITY.test(q) && CARE.test(q);
}

export function interpretKentuckyAsk(q: string, stateCode?: string) {
  if (!kentuckyIntent(q, stateCode)) return null;
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Kentucky senior-care research at /kentucky."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Louisville and Lexington are geography only: no city route and no city count."
    : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Kentucky facilities. No provider winner is selected. Open /kentucky.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt)\b/i.test(q))
    return answer(
      "A provider-level enforcement roster was NOT_ACQUIRED, which is not zero actions. No adverse action was joined by name. Open /kentucky.",
      "NOT_ACQUIRED",
    );
  if (/\b(inspections?|surveys?|deficienc)/i.test(q))
    return answer(
      "OIG posts a searchable nursing-home and personal-care-home inspection-findings database. That search is KNOWN. Inspection and deficiency rows were NOT_ACQUIRED, which is not zero surveys. A posted statement of deficiency is not a compliance census. CMS Care Compare was not bridged. Open /kentucky.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "The inspection page uses C as a complaint survey type. Provider-level complaint rows were NOT_ACQUIRED. A complaint is not a finding. Open /kentucky.",
      "NOT_ACQUIRED",
    );
  const hits: string[] = [];
  if (/adult day/i.test(q)) hits.push("adult-day");
  if (/personal services/i.test(q)) hits.push("psa");
  if (/family care/i.test(q)) hits.push("family-care");
  else if (/personal care/i.test(q)) hits.push("personal-care");
  if (/home health/i.test(q)) hits.push("home-health");
  if (/\bhospice\b/i.test(q)) hits.push("hospice");
  if (/memory care|dementia|\balc-dc\b/i.test(q)) hits.push("alc-dc");
  if (/\balc-bh\b|basic health/i.test(q)) hits.push("alc-bh");
  if (/assisted living/i.test(q)) hits.push("assisted-living");
  else if (/\balc\b/i.test(q) && !/\balc-(?:dc|bh)\b/i.test(q)) hits.push("assisted-living");
  if (/long[- ]term care|nursing home|nursing facilit|skilled nursing/i.test(q)) hits.push("ltc");
  const classes = [...new Set(hits)];
  if (classes.length !== 1)
    return answer(
      `OIG publishes separate October 2026 directories. SeniorTrustHub does not publish a combined Kentucky senior facility total and will not add long-term care, assisted living, personal care homes, family care homes, adult day health, home health, hospice, or personal services agencies. The miscellaneous workbook has ${n(snapshot.miscellaneous.rows)} rows and is not a senior census.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  const cls = classes[0]!;
  if (cls === "ltc")
    return answer(
      `The October 2026 Long Term Care directory has ${n(ltc.facilityRows)} facility rows and ${n(ltc.distinctLicenseNumbers)} license numbers. One extra sheet row prints "${ltc.noteRow}" and is not a facility. Certified beds sum to ${n(ltc.certifiedBedSum)} on ${n(ltc.certifiedBedNumericRows)} rows. ${n(ltc.certifiedBedBlankFacilityRows)} facility rows leave certified beds blank, and a blank is not zero. NF, NH, ICF, ALZ, PC, and ICF/IID cells were not added.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "alc-dc" && !/assisted living/i.test(q))
    return answer(
      `Memory care is not a separate directory. 902 KAR 20:480 ALC-DC is the assisted living category for dementia care in a secured unit. The October 2026 workbook prints ${n(alc.types["ALC-DC"])} ALC-DC type rows. They are not added to ${n(alc.types.ALC)} social-model ALC rows or ${n(alc.types["ALC-BH"])} ALC-BH rows.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "alc-bh")
    return answer(
      `ALC-BH is the 902 KAR 20:480 category for basic health and health-related services without a secured dementia unit. The workbook prints ${n(alc.types["ALC-BH"])} ALC-BH type rows. They are not added to ALC or ALC-DC.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "assisted-living" || cls === "alc-dc")
    return answer(
      `The October 2026 assisted living directory has ${n(alc.typeRows)} type rows: ALC ${n(alc.types.ALC)}, ALC-BH ${n(alc.types["ALC-BH"])}, and ALC-DC ${n(alc.types["ALC-DC"])}. Distinct printed license numbers: ${n(alc.distinctPrintedLicenseNumbers)}. Distinct facilities were not calculated. ${alc.rowWithoutLicenseNumber.name} in ${alc.rowWithoutLicenseNumber.city} has no license number. License ${alc.sameFacilityTwoTypes.licenseNumber} is one facility, ${alc.sameFacilityTwoTypes.name}, printed as ALC and ALC-DC. License ${alc.sameLicenseTwoFacilities.licenseNumber} is printed on ${alc.sameLicenseTwoFacilities.facilities[0]!.name} and ${alc.sameLicenseTwoFacilities.facilities[1]!.name}. Unit cells sum to ${n(alc.unitsCellSum)} and count the shared facility's ${n(alc.sameFacilityTwoTypes.unitsPrintedOnEachRow)} units twice. That sum is not a campus capacity. Pending Renewal is printed on ${n(alc.pendingRenewalRows)} rows and is not proof of current compliance.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "personal-care")
    return answer(
      `The October 2026 personal care home directory has ${n(pch.rows)} rows, ${n(pch.distinctLicenseNumbers)} license numbers, and ${n(pch.bedSum)} beds. Pending Renewal is printed on ${n(pch.pendingRenewalRows)} rows. Personal care homes are not assisted living communities.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "family-care")
    return answer(
      `The October 2026 family care home directory has ${n(fch.rows)} rows and ${n(fch.distinctLicenseNumbers)} license numbers. ${n(fch.bedsPrinted3)} rows print 3 beds and ${n(fch.bedsPrinted0)} rows print 0 beds. The printed bed-cell sum is ${n(fch.printedBedCellSum)}. A printed 0 is a printed zero, not an unknown capacity. Pending Renewal is printed on ${n(fch.pendingRenewalRows)} rows. Owner is blank on ${n(fch.ownerBlankRows)} rows.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "adult-day")
    return answer(
      `The miscellaneous directory label ADULT DAY HEALTH has ${n(day.rows)} rows and ${n(day.distinctFacilityIds)} facility IDs. Pending Renewal is printed on ${n(day.pendingRenewalRows)} rows. Those rows are not added to any other class. The miscellaneous file's ${n(snapshot.miscellaneous.rows)} rows are not an adult-day count.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "home-health")
    return answer(
      `The miscellaneous directory label Home Health Agency has ${n(home.rows)} rows and ${n(home.distinctFacilityIds)} distinct facility IDs. ${n(home.rowsWithoutFacilityId)} rows have no facility ID. Facility ID ${home.repeatedFacilityId} is printed twice on the same name, city, and expiration, and those two rows were not collapsed. ${n(home.rows)} is not an agency census. The owner column is not populated. ${n(home.renewalPendingRows)} rows print "${home.renewalPendingLabel}".` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  if (cls === "hospice")
    return answer(
      `The miscellaneous directory label Hospice has ${n(hospice.rows)} rows and ${n(hospice.distinctFacilityIds)} distinct facility IDs. Facility ID ${hospice.sharedLocationId} is printed on ${n(hospice.sharedLocationRows)} location rows and was not collapsed into one hospice and was not counted as ${n(hospice.sharedLocationRows)} hospices. The owner column is not populated.` +
        geography +
        " Open /kentucky.",
      "KNOWN",
    );
  return answer(
    `The October 2026 Personal Services Agency directory has ${n(psa.rows)} license rows and ${n(psa.distinctLicenseNumbers)} license numbers. This is not a facility license and it is not added to any facility class. Office state is Kentucky on ${n(psa.officeState.KY)} rows, Indiana ${n(psa.officeState.IN)}, Ohio ${n(psa.officeState.OH)}, Tennessee ${n(psa.officeState.TN)}, and West Virginia ${n(psa.officeState.WV)}. An office outside Kentucky does not remove the license and is not a service area. Pending Renewal is printed on ${n(psa.pendingRenewalRows)} rows.` +
      geography +
      " Open /kentucky.",
    "KNOWN",
  );
}
