import snapshot from "@/data/mississippi-public-snapshot.json";

const CARE =
  /nursing home|nursing facilit|personal care|assisted living|residential living|home health|hospice|icf|senior|memory care|dementia|survey|complaint|enforcement/i;
const OTHER =
  /\b(alabama|arizona|california|colorado|connecticut|florida|georgia|illinois|indiana|kentucky|louisiana|maryland|massachusetts|michigan|minnesota|missouri|nevada|new jersey|new york|north carolina|ohio|oregon|pennsylvania|south carolina|tennessee|texas|virginia|washington|wisconsin)\b/i;

export function mississippiIntent(q: string, stateCode?: string): boolean {
  const explicit = /\bmississippi\b/i.test(q) || /\bin ms\b/i.test(q);
  if (stateCode && stateCode !== "MS" && !explicit) return false;
  if (OTHER.test(q) && !explicit) return false;
  if (explicit || stateCode === "MS") return true;
  return false;
}

export function interpretMississippiAsk(q: string, stateCode?: string) {
  if (!mississippiIntent(q, stateCode)) return null;
  if (CARE.test(q) === false && /\bmississippi\b|\bin ms\b/i.test(q) === false) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Mississippi senior-care research at /mississippi."],
    coverage,
  });
  const geography = /\b(jackson|gulfport|biloxi)\b/i.test(q)
    ? " Jackson, Gulfport, and Biloxi are geography only. No city route is published."
    : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank Mississippi facilities. No provider winner is selected. Open /mississippi.",
      "UNSUPPORTED",
    );
  if (/\b(surveys?|inspections?|deficienc)/i.test(q))
    return answer(
      "MSDH posts a nursing-home and ICF/IID survey search. Survey rows were NOT_ACQUIRED. A survey is not a sanction. Open /mississippi.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "Complaint investigation records were NOT_ACQUIRED. A complaint is not a finding. Open /mississippi.",
      "NOT_ACQUIRED",
    );
  if (/\b(enforcement|sanction|penalt|revok)\b/i.test(q))
    return answer(
      "An enforcement roster was NOT_ACQUIRED. No adverse action was joined by name. Open /mississippi.",
      "NOT_ACQUIRED",
    );
  if (/home health/i.test(q))
    return answer(
      `The 18 Sep 2026 directory prints ${snapshot.homeHealthAgencies} home health agencies licensed in Mississippi and ${snapshot.homeHealthBranches} branches. Branches are not agencies. The printed parts ${snapshot.homeHealthHospitalBased}, ${snapshot.homeHealthMemphisBased}, and ${snapshot.homeHealthPrivateFreestanding} sum to ${snapshot.homeHealthPartsSum}, which is not the printed total.${geography}`,
      "KNOWN",
    );
  if (/\bhospice\b/i.test(q))
    return answer(
      `The directory prints ${snapshot.hospice} hospices. That figure includes one hospice certified by another state. Alternate sites are ${snapshot.hospiceAlternateSites} and are not added.${geography}`,
      "KNOWN",
    );
  if (/assisted living|personal care|residential living|memory care|dementia/i.test(q))
    return answer(
      `The directory prints ${snapshot.personalCareHomes} personal care homes. Assisted living is ${snapshot.personalCareAssistedLiving} and residential living is ${snapshot.personalCareResidentialLiving}. Those two sum to ${snapshot.personalCareHomes}. Alzheimer/dementia units are ${snapshot.personalCareAlzheimerUnits} and are not added to the home total.${geography}`,
      "KNOWN",
    );
  if (/icf|intellectual/i.test(q))
    return answer(
      `The directory prints ${snapshot.icfIidProviders} ICF/IID providers. Group-home address lines were not counted as a second population.${geography}`,
      "KNOWN",
    );
  if (/nursing/i.test(q))
    return answer(
      `The directory prints ${snapshot.nursingFacilities} nursing facilities. Facilities marked with an Alzheimer's unit are ${snapshot.nursingFacilitiesWithAlzheimersUnit} and are not added. A bed sum was not printed.${geography}`,
      "KNOWN",
    );
  return answer(
    `Mississippi senior classes stay separate. Nursing facilities are ${snapshot.nursingFacilities}. Personal care homes are ${snapshot.personalCareHomes}. Home health agencies are ${snapshot.homeHealthAgencies}. Hospices are ${snapshot.hospice}. ICF/IID providers are ${snapshot.icfIidProviders}. They are not added.${geography}`,
    "KNOWN",
  );
}
