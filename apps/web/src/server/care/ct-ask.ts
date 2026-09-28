import snapshot from "@/data/connecticut-public-snapshot.json";
import orders from "@/data/connecticut-orders.json";

const CITY = /\b(hartford|new haven|stamford|bridgeport)\b/i;
const SENIOR =
  /\b(nursing home|residential care|assisted living|senior care|hospice|home health|facility|inspection|complaint|enforcement)\b/i;
const OTHER_STATE = /\b(michigan|minnesota|nevada|tennessee|massachusetts|new york|new jersey)\b/i;
const OPEN = "Open Connecticut senior-care research at /connecticut.";

export function connecticutIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "CT" && !/\bconnecticut\b/i.test(q)) return false;
  return (
    /\bconnecticut\b|\bct dph\b|\bflis\b/i.test(q) ||
    stateCode === "CT" ||
    (CITY.test(q) && SENIOR.test(q) && !OTHER_STATE.test(q))
  );
}

export function interpretConnecticutAsk(
  q: string,
  stateCode?: string,
): {
  message: string;
  alternatives: string[];
  coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED";
} | null {
  if (!connecticutIntent(q, stateCode)) return null;
  // A labeled CMS CCN continues to the existing exact federal-identity path.
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({ message, alternatives: [OPEN], coverage });
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Connecticut facilities. DPH licenses settings; CMS certification and inspection reports are separate evidence. No provider winner is selected. Open /connecticut.",
      "UNSUPPORTED",
    );
  if (
    /\b(?:license|lic\.?|credential|facility id)\s*(?:#|no\.?|number)?\s*[A-Z]{2,5}[. -]?\d{3,}\b/i.test(
      q,
    )
  )
    return answer(
      "Use the exact Connecticut DPH credential lookup on /connecticut and confirm current status in eLicense. State credential numbers are not CMS CCNs; no facility is matched by name or an unlabeled number.",
      "PARTIAL",
    );
  if (/\b(enforcement|disciplin|orders?|suspend|revok|penalt)\b/i.test(q))
    return answer(
      `The DPH facility-order index snapshot links ${orders.rows.length} selected 2023–2024 orders. Four documents print exact CCNH licenses; ${orders.exactCurrentRosterAttachments} match the current active-status roster. Two scanned documents remain unlinked. This is not a statewide enforcement census or complaint count; name-only adverse joins: 0. Open /connecticut.`,
      "PARTIAL",
    );
  if (/\b(inspections?|surveys?|reports?)\b/i.test(q))
    return answer(
      "DPH provides a date-window search for CCNH inspection documents. A statewide standalone inspection index was NOT_ACQUIRED; missing rows are not zero inspections. Existing CMS survey data remains separate. Open /connecticut.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "DPH FLIS accepts facility complaints. Provider-level complaint rows were NOT_ACQUIRED and outcomes are REQUEST_ONLY. A complaint is not a final finding. Open /connecticut.",
      "NOT_ACQUIRED",
    );
  if (/\b(assisted living|managed residential|\balsa\b)\b/i.test(q))
    return answer(
      `DPH's ${snapshot.retrievedAt} credential snapshot has ${snapshot.classCounts["Assisted Living Service Agency"]} ACTIVE or ACTIVE IN RENEWAL ALSA license rows. An ALSA is not a generic assisted-living building or a managed residential community. No combined senior-facility total. Open /connecticut.`,
      "KNOWN",
    );
  if (/\b(residential care|rest home|\brch\b)\b/i.test(q))
    return answer(
      `DPH's credential snapshot has ${snapshot.classCounts["Residential Care Facility"]} ACTIVE or ACTIVE IN RENEWAL Residential Care Facility rows. That class is separate from nursing homes and ALSAs. Current Rest Home with Nursing Supervision roster was not acquired as a clean positive class. Open /connecticut.`,
      "KNOWN",
    );
  if (/\bhome health\b/i.test(q))
    return answer(
      `DPH's credential snapshot has ${snapshot.classCounts["Home Health Care"]} Home Health Care license rows and ${snapshot.classCounts["Homemaker-Home Health Aide"]} separate Homemaker-Home Health Aide row with ACTIVE or ACTIVE IN RENEWAL status. State licenses are not CMS certifications. Open /connecticut.`,
      "KNOWN",
    );
  if (/\bhospice\b/i.test(q))
    return answer(
      `DPH's credential snapshot has ${snapshot.classCounts.Hospice} Hospice state-license rows with ACTIVE or ACTIVE IN RENEWAL status. State Hospice licenses are separate from CMS-certified hospice agencies. Open /connecticut.`,
      "KNOWN",
    );
  return answer(
    `DPH's ${snapshot.retrievedAt} credential snapshot has ${snapshot.classCounts["Chronic & Convalescent Nursing Home"]} ACTIVE or ACTIVE IN RENEWAL Chronic & Convalescent Nursing Home (CCNH) rows. Hartford, New Haven, Stamford and Bridgeport are search context, not separate license populations. State licenses, CMS CCNs and inspection reports remain separate. Open /connecticut.`,
    "KNOWN",
  );
}
