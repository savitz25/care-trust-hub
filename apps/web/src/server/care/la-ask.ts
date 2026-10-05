import snapshot from "@/data/louisiana-public-snapshot.json";

const CARE =
  /nursing home|nursing facilit|skilled nursing|\bsnf\b|assisted living|adult residential|adult day|memory care|\bicf\b|intermediate care|developmentally disabled|hospice|home health|senior|inspection|survey|enforcement|complaint/i;
const CITY = /\b(new orleans|baton rouge|shreveport|lafayette)\b/i;
const OTHER =
  /\b(alabama|arizona|california|colorado|connecticut|florida|georgia|illinois|indiana|maryland|massachusetts|michigan|minnesota|nevada|new jersey|new york|north carolina|ohio|oregon|pennsylvania|tennessee|texas|virginia|washington|wisconsin)\b/i;

const source = (cls: string) => snapshot.sources.find((s) => s.class === cls)!;
const n = (value: number) => value.toLocaleString("en-US");

export function louisianaIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "LA" && !/\blouisiana\b/i.test(q)) return false;
  return (
    /\blouisiana\b|\bldh\b/i.test(q) ||
    stateCode === "LA" ||
    (CITY.test(q) && CARE.test(q) && !OTHER.test(q))
  );
}

function mentioned(q: string): string[] {
  const hits: string[] = [];
  if (/adult day/i.test(q)) hits.push("adult-day-health-care");
  if (/adult residential|\bassisted living\b/i.test(q)) hits.push("adult-residential-care");
  if (/\bicf\b|intermediate care|developmentally disabled|intellectually disabled/i.test(q))
    hits.push("icf-iid");
  if (/home health/i.test(q)) hits.push("home-health");
  if (/\bhospice\b/i.test(q)) hits.push("hospice");
  if (/nursing home|nursing facilit|skilled nursing|\bsnf\b/i.test(q)) hits.push("nursing-home");
  return hits;
}

export function interpretLouisianaAsk(q: string, stateCode?: string) {
  if (!louisianaIntent(q, stateCode)) return null;
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Louisiana senior-care research at /louisiana."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " New Orleans, Baton Rouge, Shreveport, and Lafayette are geography only: no parish route and no city count."
    : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Louisiana facilities. No provider winner is selected. Open /louisiana.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt|closure)\b/i.test(q))
    return answer(
      "Louisiana Health Standards can survey and sanction licensed providers, but a provider-level enforcement index was NOT_ACQUIRED, not zero actions. No adverse action was joined by name. Open /louisiana.",
      "NOT_ACQUIRED",
    );
  if (/\b(inspections?|surveys?|deficienc)/i.test(q))
    return answer(
      "Health Standards is Louisiana's state survey agency and conducts periodic surveys and complaint surveys. That survey program is KNOWN. Provider-level inspection or survey event rows were NOT_ACQUIRED, which is not zero surveys. CMS Care Compare was not bridged. Open /louisiana.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "LDH Health Standards accepts complaints for licensed providers, with separate intake for nursing homes, adult residential care, adult day care, home health and hospice, and ICF/DD. Intake is KNOWN. Provider-level complaint rows were NOT_ACQUIRED. A complaint is not a finding. Open /louisiana.",
      "NOT_ACQUIRED",
    );
  if (/memory care/i.test(q) && !/adult residential/i.test(q))
    return answer(
      "Memory care is not a separate Health Standards directory class. Adult residential care is the Louisiana assisted-living class and is not a memory-care census. No memory-care count is published." +
        geography +
        " Open /louisiana.",
      "KNOWN",
    );
  const classes = mentioned(q);
  if (classes.length !== 1)
    return answer(
      "Louisiana Health Standards publishes separate directories for nursing homes, adult residential care, home health, hospice, adult day health care, and ICF/IID. SeniorTrustHub does not publish a combined Louisiana facility total and will not add those classes." +
        geography +
        " Open /louisiana.",
      "KNOWN",
    );
  const s = source(classes[0]!);
  const names =
    s.distinctPrintedNames === s.rowCount
      ? `${n(s.rowCount)} source rows`
      : `${n(s.rowCount)} source rows and ${n(s.distinctPrintedNames)} distinct printed names`;
  const assisted =
    s.class === "adult-residential-care"
      ? " Adult residential care is the Louisiana assisted-living class. It is not a generic assisted-living census and it is not mixed with nursing homes, adult day health care, home health, hospice, or ICF/IID."
      : "";
  return answer(
    `The LDH directory "${s.label}" (${s.sourceUrl}) has ${names} across ${n(s.pageCount)} pages, retrieved ${s.retrievedAt}. Rows are not deduplicated licensed campuses. This count is not added to any other class and is not a combined Louisiana total.${assisted}${geography} Open /louisiana.`,
    "KNOWN",
  );
}
