import snapshot from "@/data/maryland-public-snapshot.json";

const CARE =
  /nursing home|assisted living|senior care|hospice|home health|adult medical day|facility|inspection|survey|enforcement|complaint/i;
const CITY = /\b(baltimore|annapolis|frederick|rockville)\b/i;
const OTHER =
  /\b(connecticut|michigan|minnesota|nevada|tennessee|massachusetts|new york|new jersey)\b/i;
export function marylandIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "MD" && !/\bmaryland\b/i.test(q)) return false;
  return (
    /\bmaryland\b|\bohcq\b|\bmdh\b/i.test(q) ||
    stateCode === "MD" ||
    (CITY.test(q) && CARE.test(q) && !OTHER.test(q))
  );
}
export function interpretMarylandAsk(q: string, stateCode?: string) {
  if (!marylandIntent(q, stateCode)) return null;
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({ message, alternatives: ["Open Maryland senior-care research at /maryland."], coverage });
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Maryland facilities. OHCQ licensing and CMS certification are separate evidence. No facility winner is selected. Open /maryland.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt)\b/i.test(q))
    return answer(
      "OHCQ publishes assisted living final-action information. A clean 2022–2026 provider-level corpus was NOT_ACQUIRED; no adverse action was joined by name. Open /maryland.",
      "PARTIAL",
    );
  if (/\b(inspections?|surveys?|deficienc|reports?)\b/i.test(q))
    return answer(
      "OHCQ links nursing home deficiency reports through the Maryland Long Term Care Consumer Guide. A clean statewide state inspection index was NOT_ACQUIRED; CMS surveys remain separate. Open /maryland.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "OHCQ accepts facility complaints. Provider-level complaint rows were NOT_ACQUIRED and outcomes are REQUEST_ONLY. A complaint is not a final finding. Open /maryland.",
      "NOT_ACQUIRED",
    );
  const source = /assisted living/i.test(q)
    ? snapshot.sources[0]
    : /home health/i.test(q)
      ? snapshot.sources[2]
      : /hospice/i.test(q)
        ? snapshot.sources[3]
        : /adult medical day/i.test(q)
          ? snapshot.sources[4]
          : snapshot.sources[1];
  return answer(
    `OHCQ's ${source.sheet} directory lists ${source.rows} ${source.class} rows and ${source.distinctLicenses} distinct printed state license numbers. Individual status and CMS CCNs are not printed; no combined senior total or name-only federal bridge. Open /maryland.`,
    "KNOWN",
  );
}
