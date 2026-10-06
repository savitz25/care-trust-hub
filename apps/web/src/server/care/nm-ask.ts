import snapshot from "@/data/new-mexico-public-snapshot.json";

const CITY = /\b(albuquerque|santa fe)\b/i;

export function newMexicoIntent(q: string, stateCode?: string): boolean {
  const named = /\bnew mexico\b/i.test(q) || /\bin nm\b/i.test(q);
  if (stateCode && stateCode !== "NM" && !named) return false;
  return named;
}

export function interpretNewMexicoAsk(q: string, stateCode?: string) {
  if (!newMexicoIntent(q, stateCode)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open New Mexico senior-care research at /new-mexico."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Albuquerque and Santa Fe are geography only. No city route is published."
    : "";
  const classes = snapshot.classes.map((row) => row.name.toLowerCase()).join(", ");
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  ) {
    return answer(
      "SeniorTrustHub does not rank New Mexico facilities and does not publish a Trust Score.",
      "UNSUPPORTED",
    );
  }
  if (/\b(temporary|provisional)\b/i.test(q)) {
    return answer(
      `Temporary or provisional New Mexico license counts were NOT_ACQUIRED. A temporary license is not a full license.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(beds?|capacity|slots?)\b/i.test(q)) {
    return answer(
      `New Mexico licensed capacity was NOT_ACQUIRED. A bed or slot figure was not published.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(enforcement|sanction|penalt|revok)\b/i.test(q)) {
    return answer(
      `New Mexico enforcement counts were NOT_ACQUIRED. No adverse action was joined by name. Name-only adverse joins: ${snapshot.nameOnlyAdverseJoins}.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(surveys?|inspections?|deficienc)/i.test(q)) {
    return answer(
      `New Mexico survey and deficiency counts were NOT_ACQUIRED. The DHI survey-report search points to ${snapshot.federalOverlays.join(" and ")} as federal overlays. CMS certification was not downloaded. A survey is not a facility count and is not a finding.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\bcomplaints?\b/i.test(q)) {
    return answer(
      `New Mexico complaint counts were NOT_ACQUIRED. Complaint intake is not a complaint census. A complaint is not a finding.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(cms|qcor|nursing home compare|care compare)\b/i.test(q)) {
    return answer(
      `CMS certification for New Mexico was not downloaded. Nursing Home Compare and S&C QCOR stay federal overlays. No state-to-CMS bridge was made. A federal overlay is not a state license roster.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/adult residential/i.test(q)) {
    return answer(
      `A New Mexico adult-residential-care roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/adult day/i.test(q)) {
    return answer(
      `A New Mexico adult-day roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\bicf\b|intellectual/i.test(q)) {
    return answer(
      `A New Mexico ICF/IID roster was NOT_ACQUIRED. Community waiver survey reports are not an ICF/IID census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/assisted living/i.test(q)) {
    return answer(
      `A New Mexico assisted-living roster was NOT_ACQUIRED. The Licensed Oversight Bureau search is interactive. No official facility-directory export was downloaded. A search is not a roster.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/home health/i.test(q) && /hospice/i.test(q)) {
    return answer(
      `New Mexico home-health and hospice rosters were NOT_ACQUIRED. Home care in the licensing scope is not a home-health census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/home health/i.test(q)) {
    return answer(
      `A New Mexico home-health roster was NOT_ACQUIRED. Home care in the licensing scope is not a home-health census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/hospice/i.test(q)) {
    return answer(
      `A New Mexico hospice roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/nursing/i.test(q)) {
    return answer(
      `A New Mexico nursing-facility roster was NOT_ACQUIRED. Health Facility Licensing and Certification covers long-term care, and that scope is not a license count. CMS certification was not downloaded and was not bridged to a state roster.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(how many|total|census|combined)\b/i.test(q)) {
    return answer(
      `New Mexico senior classes stay separate. State rosters were NOT_ACQUIRED for ${classes}. Those classes cannot be combined into one senior-facility census. Association directories, third-party CMS recounts, and magazine figures are not state license counts.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  return answer(
    `${snapshot.regulator} evidence is a licensing limit, not a facility census. ${snapshot.licensingScope} State rosters were NOT_ACQUIRED for ${classes}. The Licensed Oversight Bureau facility search is interactive, and no official directory export was downloaded. The FY2025 facility resource directory, revised ${snapshot.resourceGuide.revised}, is a bureau contact and rules guide. The guide is not a roster. ${snapshot.recordsPath} is a records path, not a census.${geography}`,
    "NOT_ACQUIRED",
  );
}
