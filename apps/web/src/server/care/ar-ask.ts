import snapshot from "@/data/arkansas-public-snapshot.json";

const OTHER = /\b(oklahoma|missouri|utah|mississippi|arizona)\b|\bin (?:ok|mo|ut|ms|az)\b/i;
const CITY = /\b(little rock|fayetteville|fort smith|jonesboro|springdale|bentonville)\b/i;

export function arkansasIntent(q: string, stateCode?: string): boolean {
  const explicit = /\barkansas\b/i.test(q) || /\bin ar\b/i.test(q);
  if (/\barizona\b/i.test(q)) return false;
  if (OTHER.test(q) && !explicit) return false;
  if (stateCode && stateCode !== "AR" && !explicit) return false;
  if (explicit || stateCode === "AR") return true;
  return false;
}

export function interpretArkansasAsk(q: string, stateCode?: string) {
  if (!arkansasIntent(q, stateCode)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Arkansas senior-care research at /arkansas."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Little Rock, Fayetteville, Fort Smith, Jonesboro, Springdale, and Bentonville are geography only. No city route is published."
    : "";
  const narrative = snapshot.narrativeResidence;
  const medicaid = snapshot.medicaidNursingClassification;
  const icf = snapshot.icfIidDivision;
  const surveys = snapshot.surveys;
  const complaints = snapshot.complaints;
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  ) {
    return answer(
      "SeniorTrustHub does not rank Arkansas facilities and does not publish a Trust Score.",
      "UNSUPPORTED",
    );
  }
  if (/\b(surveys?|inspections?|deficienc)/i.test(q)) {
    return answer(
      `DPSQA reports that the Office of Long Term Care performed ${surveys.focusedInfectionControl} focused infection-control surveys, ${surveys.complaintSurveys.toLocaleString("en-US")} complaint surveys, and ${surveys.recertificationSurveys} recertification surveys in SFY 2022. A survey is not a violation and is not a facility count.${geography}`,
      "PARTIAL",
    );
  }
  if (/\bcomplaints?\b/i.test(q)) {
    return answer(
      `SFY 2022 complaint intake was ${complaints.nursingHomeComplaintsReceived.toLocaleString("en-US")} nursing-home complaints and ${complaints.hcbsComplaintsReceived} home- and community-based complaints. Those intakes are not added. A complaint is not a finding. Complaint surveys are a separate count.${geography}`,
      "PARTIAL",
    );
  }
  if (/\b(enforcement|sanction|penalt|revok)\b/i.test(q)) {
    return answer(
      "An Arkansas enforcement-order roster was NOT_ACQUIRED. No adverse action was joined by name.",
      "NOT_ACQUIRED",
    );
  }
  if (/home health|hospice/i.test(q)) {
    return answer(
      `Current Arkansas home-health and hospice rosters were NOT_ACQUIRED. The SFY 2022 statistical report does not supply those class censuses.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/adult day/i.test(q)) {
    return answer(
      `A current Arkansas adult-day roster was NOT_ACQUIRED. The SFY 2022 adult-day chart was not published as a class census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/assisted living|residential care/i.test(q)) {
    return answer(
      `Current Arkansas assisted-living and residential-care rosters were NOT_ACQUIRED. The statistical report's license table was not published because its class pairings are not reliable.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/psychiatric/i.test(q)) {
    return answer(
      `The SFY 2022 narrative says residents live in ${narrative.psychiatricResidentialCareFacilities} psychiatric residential care facilities, alongside the nursing-facility and ICF/IID figures. Those classes are not added. This is not a current roster.${geography}`,
      "PARTIAL",
    );
  }
  if (/\bicf\b|intellectual/i.test(q)) {
    return answer(
      `The SFY 2022 narrative says ${narrative.icfIid} intermediate care facilities for individuals with intellectual disabilities. The same section divides that population into ${icf.stateOwnedHumanDevelopmentCenters} state-owned human development centers, ${icf.privatePediatricFacilities} private pediatric facilities, and ${icf.adultFacilitiesFifteenBedsOrFewer} adult facilities of 15 or fewer beds. That division is not added to nursing facilities.${geography}`,
      "PARTIAL",
    );
  }
  if (/nursing/i.test(q)) {
    return answer(
      `The SFY 2022 narrative says residents live in approximately ${narrative.nursingFacilities} nursing facilities. A separate Medicaid sentence counts ${medicaid.publicFacilities} public facility and ${medicaid.privateUnderMedicaid} private facilities under Medicaid, plus ${medicaid.additionalPrivateWithoutMedicaidFunding} additional private facility that does not receive Medicaid funding. Those sentences are not added, and neither is a current roster.${geography}`,
      "PARTIAL",
    );
  }
  if (/\b(how many|total|census)\b/i.test(q)) {
    return answer(
      `Arkansas senior classes stay separate. The SFY 2022 narrative prints approximately ${narrative.nursingFacilities} nursing facilities, ${narrative.icfIid} ICF/IID facilities, and ${narrative.psychiatricResidentialCareFacilities} psychiatric residential care facilities. Those figures cannot be combined into one senior census.${geography}`,
      "PARTIAL",
    );
  }
  return answer(
    `Arkansas Department of Human Services evidence is the SFY 2022 statistical report, covering July 1, 2021 through June 30, 2022. Nursing facilities, ICF/IID facilities, and psychiatric residential care facilities stay separate. Current assisted-living, adult-day, home-health, and hospice rosters were NOT_ACQUIRED.${geography}`,
    "PARTIAL",
  );
}
