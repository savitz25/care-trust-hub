import snapshot from "@/data/michigan-public-snapshot.json";

const SENIOR =
  /nursing home|home for the aged|adult foster care|\bafc\b|hospice|home health|alzheimer|dementia|senior|facility|inspection|disciplin|complaint/i;
const CITY = /\b(detroit|grand rapids|lansing|ann arbor)\b/i;
const OTHER_STATE = /\b(minnesota|nevada|tennessee|ohio|wisconsin|illinois|indiana)\b/i;
const OPEN = "Open Michigan senior-care research.";

export function michiganIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "MI" && !/\bmichigan\b/i.test(q)) return false;
  return (
    /\bmichigan\b|\blara\b|\bbchs\b/i.test(q) ||
    stateCode === "MI" ||
    (CITY.test(q) && SENIOR.test(q) && !OTHER_STATE.test(q))
  );
}

export function interpretMichiganAsk(
  q: string,
  stateCode?: string,
): {
  message: string;
  alternatives: string[];
  coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED";
} | null {
  if (!michiganIntent(q, stateCode)) return null;
  // Let the existing exact CMS identifier path handle federal certification.
  if (/\bCCN\s*#?\s*\d+\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  if (
    /\b(best|safest|recommended|most trustworthy|top[- ]rated|highest rated|number one|trust score|paid ranking|sponsored ranking)\b|#1\b/i.test(
      q,
    )
  )
    return {
      message:
        "SeniorTrustHub does not rank or recommend Michigan facilities. LARA licenses care settings and posts reports; CMS certification is separate. No provider winner is selected. Open /michigan for source-specific evidence.",
      alternatives: [OPEN],
      coverage: "UNSUPPORTED",
    };
  if (/\b(?:license|lic\.?|facility id)\s*(?:#|no\.?|number)?\s*[A-Z]{0,4}\d{4,}\b/i.test(q))
    return {
      message:
        "That labeled identifier may be checked in LARA Verify a License. Michigan state licenses and facility IDs are separate from CMS CCNs; this Ask summary does not claim a matched facility from a number alone. Open /michigan for the statewide evidence and official verification link.",
      alternatives: [OPEN],
      coverage: "PARTIAL",
    };
  if (/disciplin|suspend|revok|enforce|complaint/i.test(q))
    return {
      message: `LARA's AFC/HFA disciplinary closure list has ${snapshot.disciplineRows} published rows in the acquired snapshot. Exact matches to the current open-file license list: ${snapshot.disciplineCurrentOpenAttachments}; name-only attachments: 0. Complaint-related reports can be checked in Verify a License, but a provider-level complaint census and outcomes were not acquired. Actions are not interchangeable with complaints or abuse findings. Open /michigan.`,
      alternatives: [OPEN],
      coverage: "PARTIAL",
    };
  if (/inspection|survey|report/i.test(q))
    return {
      message:
        "LARA Verify a License exposes recent annual and complaint-related facility reports. One nursing-home licensure-survey index record was captured by exact state license; a statewide inspection corpus was not acquired. CMS surveys remain separate. Open /michigan.",
      alternatives: [OPEN],
      coverage: "PARTIAL",
    };
  if (/home health/i.test(q))
    return {
      message:
        "A Michigan state Home Health Agency roster was not acquired from the LARA facility export. The existing CMS home-health directory is a separate federal certification source, not a Michigan state-license census. Open /michigan.",
      alternatives: [OPEN],
      coverage: "NOT_ACQUIRED",
    };
  if (/\b(?:afc|adult foster care|home for the aged|assisted living|alzheimer|dementia)\b/i.test(q))
    return {
      message: `LARA's daily Michigan AFC/HFA open file has separate classes: AF family ${snapshot.afcClassCounts.AF}, AS small group ${snapshot.afcClassCounts.AS}, AM medium group ${snapshot.afcClassCounts.AM}, AL large group ${snapshot.afcClassCounts.AL}, AG congregate ${snapshot.afcClassCounts.AG}, AI county infirmary ${snapshot.afcClassCounts.AI}, AH Home for the Aged ${snapshot.afcClassCounts.AH}; XH exempt ${snapshot.afcClassCounts.XH} stays separate. Michigan has no generic assisted-living license. Service flags such as Alzheimer's are not separate license classes. Open /michigan.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  if (/hospice/i.test(q))
    return {
      message: `LARA's active Michigan export has ${snapshot.healthClassCounts["Hospice Agency"]} Hospice Agency and ${snapshot.healthClassCounts["Hospice Residence"]} Hospice Residence license rows. These are separate from CMS certification and are not summed with AFC/HFA. Open /michigan.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  return {
    message: `LARA's active Michigan export has ${snapshot.healthClassCounts["Nursing Home"]} Nursing Home state-license rows. The daily AFC/HFA file and hospice exports have separate class counts and clocks; none is a combined Michigan senior-facility total or CMS certification count. Open /michigan.`,
    alternatives: [OPEN],
    coverage: "KNOWN",
  };
}
