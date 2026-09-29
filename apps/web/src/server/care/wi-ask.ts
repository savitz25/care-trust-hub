import snapshot from "@/data/wisconsin-public-snapshot.json";

const CARE =
  /nursing home|assisted living|\bcbrf\b|residential care|adult family home|hospice|home health|senior|inspection|survey|enforcement|complaint/i;
const CITY = /\b(milwaukee|madison|green bay|kenosha)\b/i;
const OTHER = /\b(maryland|connecticut|michigan|minnesota|nevada|tennessee|massachusetts)\b/i;

export function wisconsinIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "WI" && !/\bwisconsin\b/i.test(q)) return false;
  return (
    /\bwisconsin\b|\bdqa\b/i.test(q) ||
    stateCode === "WI" ||
    (CITY.test(q) && CARE.test(q) && !OTHER.test(q))
  );
}

export function interpretWisconsinAsk(q: string, stateCode?: string) {
  if (!wisconsinIntent(q, stateCode)) return null;
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Wisconsin senior-care research at /wisconsin."],
    coverage,
  });
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Wisconsin facilities. No provider winner is selected. Open /wisconsin.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt)\b/i.test(q))
    return answer(
      "Wisconsin DQA regulates facility sanctions. A clean 2022–2026 provider-level enforcement index was NOT_ACQUIRED; no adverse action was joined by name. Open /wisconsin.",
      "NOT_ACQUIRED",
    );
  if (/\b(inspections?|surveys?|deficienc|reports?)\b/i.test(q))
    return answer(
      `Wisconsin DQA's assisted-living monthly survey-document additions list ${snapshot.surveyAdditionsSource.rows} rows, ${snapshot.surveyAdditionsSource.exactRosterMatches} with exact AFH, CBRF or RCAC license matches. It is not a complete inspection census and has no inspection dates. CMS surveys remain separate. Open /wisconsin.`,
      "PARTIAL",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "Wisconsin DHS accepts health and residential-care complaints. Provider-level complaint rows were NOT_ACQUIRED; a complaint is not a final finding. Open /wisconsin.",
      "NOT_ACQUIRED",
    );
  const source = /\b(?:cbrf|community.based residential)\b/i.test(q)
    ? snapshot.sources[1]
    : /\b(?:rcac|residential care apartment)\b/i.test(q)
      ? snapshot.sources[2]
      : /adult family home/i.test(q)
        ? snapshot.sources[0]
        : /assisted living|residential care/i.test(q)
          ? null
          : /home health/i.test(q)
            ? snapshot.sources[5]
            : /hospice/i.test(q)
              ? snapshot.sources[4]
              : snapshot.sources[3];
  if (!source)
    return answer(
      "Wisconsin assisted living includes separate AFH, CBRF and RCAC directories. Choose the exact setting; no combined assisted-living count or facility winner is given. Open /wisconsin.",
      "KNOWN",
    );
  return answer(
    `Wisconsin DHS DQA's ${source.class} directory has ${source.rows} source rows and ${source.distinctLicenses} distinct printed IDs. Status must be reverified. Classes are separate; no combined senior total. Open /wisconsin.`,
    "KNOWN",
  );
}
