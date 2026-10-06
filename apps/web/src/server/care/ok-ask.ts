import snapshot from "@/data/oklahoma-public-snapshot.json";

const OTHER =
  /\b(arkansas|missouri|utah|mississippi)\b|\bin (?:ar|mo|ut|ms)\b/i;
const CITY = /\b(oklahoma city|tulsa|norman|lawton|edmond|broken arrow)\b/i;

export function oklahomaIntent(q: string, stateCode?: string): boolean {
  const explicit = /\boklahoma\b/i.test(q) || /\bin ok\b/i.test(q);
  if (OTHER.test(q) && !explicit) return false;
  if (stateCode && stateCode !== "OK" && !explicit) return false;
  if (explicit || stateCode === "OK") return true;
  return false;
}

export function interpretOklahomaAsk(q: string, stateCode?: string) {
  if (!oklahomaIntent(q, stateCode)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Oklahoma senior-care research at /oklahoma."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Oklahoma City, Tulsa, Norman, Lawton, Edmond, and Broken Arrow are geography only. No city route is published."
    : "";
  const dir = snapshot.directories;
  const call = snapshot.providerCall;
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  ) {
    return answer(
      "SeniorTrustHub does not rank Oklahoma facilities and does not publish a Trust Score.",
      "UNSUPPORTED",
    );
  }
  if (/\b(surveys?|inspections?|deficienc)/i.test(q)) {
    return answer(
      `The August 26, 2026 provider-call slide prints NH Survey Citations for SFY2026. The cells sum to ${snapshot.surveyCitationsSfy2026.printedCellSum}. That sum is not a facility count. Facility-linked survey rows are NOT_ACQUIRED. A citation is not a sanction.${geography}`,
      "PARTIAL",
    );
  }
  if (/\bcomplaints?\b/i.test(q)) {
    return answer(
      "Complaint records were NOT_ACQUIRED. A complaint is not a finding.",
      "NOT_ACQUIRED",
    );
  }
  if (/\b(enforcement|sanction|penalt|revok)\b/i.test(q)) {
    return answer(
      "An enforcement roster was NOT_ACQUIRED. No adverse action was joined by name.",
      "NOT_ACQUIRED",
    );
  }
  if (/home health|hospice/i.test(q)) {
    return answer(
      `Home health and hospice class censuses are NOT_SEPARATED. The July 8, 2026 Medical Facilities Service directory has ${snapshot.medicalFacilitiesDirectory.prefixDistinct.HC} distinct HC license numbers and ${snapshot.medicalFacilitiesDirectory.prefixDistinct.HO} distinct HO license numbers. A prefix count is not a class census.${geography}`,
      "PARTIAL",
    );
  }
  if (/adult day/i.test(q)) {
    return answer(
      `The April 6, 2026 adult-day directory prints ${dir.adultDay.printedCenters} centers. The August 26, 2026 slide prints ${call.adultDayCare}. Those clocks are not added.${geography}`,
      "KNOWN",
    );
  }
  if (/residential care/i.test(q)) {
    return answer(
      `The April 6, 2026 residential-care directory prints ${dir.residentialCare.printedFacilities} facilities. The August 26, 2026 slide prints ${call.residentialCareHomes}. Those clocks are not added.${geography}`,
      "KNOWN",
    );
  }
  if (/assisted living/i.test(q)) {
    return answer(
      `The April 1, 2026 assisted-living directory has ${dir.assistedLiving.facilityIds} facility IDs: ${dir.assistedLiving.alPrefix} AL, ${dir.assistedLiving.nursingIdWithAlSuffix} nursing IDs with an AL suffix, and ${dir.assistedLiving.continuumIdWithAlSuffix} continuum IDs with an AL suffix. The August 26, 2026 slide prints ${call.assistedLivingCenters} assisted living centers. Those clocks are not added.${geography}`,
      "KNOWN",
    );
  }
  if (/\bicf\b|intellectual/i.test(q)) {
    return answer(
      `An ICF/IID directory was NOT_ACQUIRED. The August 26, 2026 slide prints ${call.icfIid} ICF/IID facilities. That slide count is not a parsed roster.${geography}`,
      "PARTIAL",
    );
  }
  if (/continuum/i.test(q)) {
    return answer(
      `A standalone continuum-of-care directory was NOT_ACQUIRED. Six continuum IDs sit on the April 1 nursing-home list and seven continuum IDs with an AL suffix sit on the assisted-living list. They are not a continuum census.${geography}`,
      "PARTIAL",
    );
  }
  if (/nursing/i.test(q)) {
    return answer(
      `The April 1, 2026 nursing-home directory has ${dir.nursingHome.facilityIds} facility IDs, including ${dir.nursingHome.continuumPrefix} continuum IDs. The August 26, 2026 slide prints ${call.nursingHomesFederal} federal nursing homes and ${call.nursingHomesOther} other nursing homes. Those figures are not added to the directory.${geography}`,
      "KNOWN",
    );
  }
  if (/\b(how many|total|census)\b/i.test(q)) {
    return answer(
      `Oklahoma senior classes stay separate. The August 26, 2026 slide prints its own total of ${call.slideTotal}. That line is not a Trust Hub senior census, and it is not the April directory counts.${geography}`,
      "PARTIAL",
    );
  }
  return answer(
    `Oklahoma State Department of Health classes stay separate. April directories and the August 26, 2026 provider-call slide are different clocks. The slide total ${call.slideTotal} is not a combined senior denominator.${geography}`,
    "PARTIAL",
  );
}
