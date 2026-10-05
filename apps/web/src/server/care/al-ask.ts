import snapshot from "@/data/alabama-public-snapshot.json";

const CARE =
  /nursing home|nursing facilit|skilled nursing|\bsnf\b|assisted living|specialty care|home health|hospice|senior|inspection|survey|enforcement|complaint|memory care|adult day/i;
const CITY = /\b(birmingham|montgomery|huntsville|tuscaloosa)\b/i;
const OTHER =
  /\b(arizona|california|colorado|connecticut|florida|georgia|illinois|indiana|louisiana|maryland|massachusetts|michigan|minnesota|nevada|new jersey|new york|north carolina|ohio|oregon|pennsylvania|tennessee|texas|virginia|washington|wisconsin)\b/i;

const source = (cls: string) => snapshot.sources.find((s) => s.class === cls)!;
const summary = (cls: string) => snapshot.statisticalSummary.classes.find((s) => s.class === cls)!;
const n = (value: number) => value.toLocaleString("en-US");
const totalLine = (cls: string) => {
  const lines = summary(cls).lines;
  return lines[lines.length - 1]!;
};

function explicitAlabama(q: string): boolean {
  return /\balabama\b/i.test(q) || /\bAL\b/.test(q);
}

export function alabamaIntent(q: string, stateCode?: string): boolean {
  const explicit = explicitAlabama(q);
  if (/\bmobile\b/i.test(q) && !explicit) return false;
  if (stateCode && stateCode !== "AL" && !explicit) return false;
  if (explicit || stateCode === "AL") return true;
  return CITY.test(q) && CARE.test(q) && !OTHER.test(q);
}

function mentioned(q: string): string[] {
  const hits: string[] = [];
  const specialty = /specialty care/i.test(q);
  const assisted = /assisted living/i.test(q);
  const both = specialty && assisted && /\b(and|or|plus|versus|vs\.?)\b/i.test(q);
  if (/adult day/i.test(q)) hits.push("adult-day");
  if (both) hits.push("specialty-care-assisted-living", "assisted-living");
  else if (specialty) hits.push("specialty-care-assisted-living");
  else if (assisted) hits.push("assisted-living");
  if (/\bicf\b|intermediate care|intellectually disabled/i.test(q)) hits.push("nursing-home");
  if (/home health/i.test(q)) hits.push("home-health");
  if (/\bhospice\b/i.test(q)) hits.push("hospice");
  if (/nursing home|nursing facilit|skilled nursing|\bsnf\b/i.test(q)) hits.push("nursing-home");
  return [...new Set(hits)];
}

export function interpretAlabamaAsk(q: string, stateCode?: string) {
  if (!alabamaIntent(q, stateCode)) return null;
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Alabama senior-care research at /alabama."],
    coverage,
  });
  const geography =
    CITY.test(q) || /\bmobile,\s*alabama\b|\bmobile\s+alabama\b/i.test(q)
      ? " Birmingham, Montgomery, Huntsville, Mobile, and Tuscaloosa are geography only: no city route and no city count."
      : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Alabama facilities. No provider winner is selected. Open /alabama.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt|closure)\b/i.test(q))
    return answer(
      "The Bureau of Health Provider Standards describes surveys, corrective action plans, and skilled-nursing dispute processes. A provider-level enforcement roster was NOT_ACQUIRED, which is not zero actions. The one Probational specialty-care directory status was not joined to an enforcement action. No adverse action was joined by name. Open /alabama.",
      "NOT_ACQUIRED",
    );
  if (/\b(inspections?|surveys?|deficienc)/i.test(q))
    return answer(
      "The Division of Health Care Facilities conducts surveys and requires a corrective action plan when a facility is noncompliant. That survey program is KNOWN. The deficiencies application is an interactive session, and provider-level inspection and deficiency rows were NOT_ACQUIRED, which is not zero surveys. CMS Care Compare was not bridged. Open /alabama.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "ADPH posts separate complaint intake for assisted living, for home health or hospice, and for nursing homes. Intake is KNOWN. Provider-level complaint rows were NOT_ACQUIRED. A complaint is not a finding. Open /alabama.",
      "NOT_ACQUIRED",
    );
  if (/adult day/i.test(q))
    return answer(
      "The ADPH Facilities Directory facility-type list does not include adult day. No adult-day count is published. That is not a count of zero." +
        geography +
        " Open /alabama.",
      "KNOWN",
    );
  if (/memory care/i.test(q) && !/specialty care/i.test(q)) {
    const scalf = source("specialty-care-assisted-living");
    const assistedLiving = source("assisted-living");
    return answer(
      `Memory care is not a separate ADPH directory class. Specialty care assisted living is the class specially licensed and staffed for residents whose cognitive impairment would ordinarily make them ineligible for assisted living. That class has ${n(scalf.directoryRows)} directory rows. It is not added to the ${n(assistedLiving.directoryRows)} assisted living facility rows. No memory-care count is published.` +
        geography +
        " Open /alabama.",
      "KNOWN",
    );
  }
  const classes = mentioned(q).filter((cls) => cls !== "adult-day");
  if (classes.length !== 1)
    return answer(
      "ADPH publishes separate Facilities Directory exports for nursing homes, assisted living facilities, specialty care assisted living facilities, home health agencies, and hospices. SeniorTrustHub does not publish a combined Alabama senior facility total and will not add those classes." +
        geography +
        " Open /alabama.",
      "KNOWN",
    );
  const cls = classes[0]!;
  const s = source(cls);
  const printed = totalLine(cls);
  const lead = `The ADPH Facilities Directory export for ${s.label} (${snapshot.directoryUrl}) has ${n(s.directoryRows)} directory rows and ${n(s.distinctFacIds)} Fac IDs, retrieved ${s.retrievedAt}.`;
  const tail = ` License number is not a column. Fac ID is the directory identifier. A non-blank Medicare number cell was counted on ${n(s.medicareNumberPrintedRows)} rows and was not stored or bridged to CMS. This count is not added to any other class.${geography} Open /alabama.`;
  if (cls === "nursing-home") {
    const icf = snapshot.directoryExceptions.filter(
      (row) => row.facId === "N0806" || row.facId === "N6104",
    );
    return answer(
      lead +
        ` License status is Regular on 230 rows and Not subject to licensure on 2 rows. Those two rows are ${icf.map((row) => `${row.name} (Fac ID ${row.facId})`).join(" and ")}. Directory rows are not a licensed-only nursing-home census. The statistical summary Nursing Homes section total prints ${n(printed.licensedFacilities)} licensed facilities, ${n(printed.certifiedFacilities)} certified facilities, and ${n(printed.licensedBedsOrStations)} licensed beds or stations, and that printed total includes the ICF/IID line. The export licensed-bed sum is ${n(s.licensedBedsSum ?? 0)}.` +
        tail,
      "KNOWN",
    );
  }
  if (cls === "assisted-living")
    return answer(
      lead +
        ` License status is Regular on all ${n(s.directoryRows)} rows. The statistical summary prints ${n(printed.licensedFacilities)} licensed facilities, ${n(printed.certifiedFacilities)} certified facilities, and ${n(printed.licensedBedsOrStations)} licensed beds or stations. Assisted living is not specialty care assisted living.` +
        tail,
      "KNOWN",
    );
  if (cls === "specialty-care-assisted-living") {
    const probation = snapshot.directoryExceptions.find((row) => row.facId === "P4903")!;
    return answer(
      lead +
        ` License status is Regular on 106 rows and Probational on 1 row: ${probation.name}, Fac ID ${probation.facId}, ${probation.licensedBeds} licensed beds. That Probational value is the directory license status. It was not joined to an enforcement action. The statistical summary prints ${n(printed.licensedFacilities)} licensed facilities and ${n(printed.licensedBedsOrStations)} licensed beds or stations. Specialty care assisted living is not added to assisted living.` +
        tail,
      "KNOWN",
    );
  }
  if (cls === "home-health")
    return answer(
      lead +
        ` Every row has license status Not subject to licensure. Distinct printed names: ${n(s.distinctPrintedNames)}. Repeated names were not collapsed. The export licensed-beds column was blank on all ${n(s.directoryRows)} rows. The statistical summary prints ${n(printed.licensedFacilities)} licensed facilities, ${n(printed.certifiedFacilities)} certified facilities, and ${n(printed.licensedBedsOrStations)} licensed beds or stations. ${n(s.directoryRows)} is not a licensed-agency count and is not a certified-agency count. The Licensee Type value State of Alabama is a form label on 15 rows, not an owner record and not a separate program census.` +
        tail,
      "KNOWN",
    );
  const uncovered = snapshot.directoryExceptions.find((row) => row.facId === "E1004")!;
  return answer(
    lead +
      ` License status is Regular on 187 rows and Not subject to licensure on 1 row: ${uncovered.name}, Fac ID ${uncovered.facId}, licensed beds blank. The statistical summary prints ${n(printed.licensedFacilities)} licensed facilities, ${n(printed.certifiedFacilities)} certified facilities, and ${n(printed.licensedBedsOrStations)} licensed beds or stations. The export licensed-bed sum is ${n(s.licensedBedsSum ?? 0)}, from 7 in-patient rows. The summary figure ${n(printed.licensedBedsOrStations)} and the export sum ${n(s.licensedBedsSum ?? 0)} are both kept.` +
      tail,
    "KNOWN",
  );
}
