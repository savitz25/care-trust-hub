import { NV_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/nevada-facility-lists.json";

// NV-SEN-001. Nevada guidance for questions the CMS directories cannot answer on their own:
// Residential Facilities for Groups and their Assisted Living / Alzheimer's endorsements, Homes for
// Individual Residential Care, Adult Day Care, HCQC license lookups, state inspections and sanctions,
// complaints, combined totals, and ranking. Plain CMS class questions ("nursing homes Nevada",
// "home health Nevada", "hospice Nevada") and CCN lookups return null so the existing CMS research
// path answers them.

export type NvAskAnswer = {
  message: string;
  alternatives: string[];
  coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";
};

type Facility = (typeof lists.facilities)[number];

const s = NV_PUBLIC_SNAPSHOT;
const n = (v: number) => v.toLocaleString("en-US");
const OPEN = "Open Nevada senior-care research.";
const CITY = /\b(las vegas|henderson|reno)\b/i;
const SENIOR =
  /nursing|skilled|assisted living|residential facilit|\brfg\b|group home|memory care|dementia|alzheimer|individual residential care|\bhirc?\b|senior|hospice|home health|adult day|long[- ]term care/i;

type City = keyof typeof s.cityContext.cities;

const CLASS_CODES: Record<string, string> = {
  SNF: "Facility for Skilled Nursing",
  SFD: "Skilled Nursing Facility Distinct Part of Hospital",
  AGC: "Residential Facility for Groups",
  HIC: "Home for Individual Residential Care",
  ADC: "Facility for the Care of Adults During the Day",
  HHA: "Home Health Agency",
  HBR: "Home Health branch office",
  HPC: "Hospice Care program",
  HFS: "Facility for Hospice Care",
};

const NV_IDENTIFIER = /\b\d{2,6}-(?:SNF|SFD|AGC|HIC|ADC|HHA|HBR|HPC|HFS)-\d{1,3}\b/i;
const NV_ONLY_TERMS =
  /\bresidential facilit(?:y|ies) for groups\b|\brfgs?\b|\bhomes? for individual residential care\b|\bhirc\b|\bhcqc\b/i;

export function nevadaIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "NV" && !/\bnevada\b/i.test(q)) return false;
  return (
    NV_IDENTIFIER.test(q) ||
    NV_ONLY_TERMS.test(q) ||
    /\bnevada\b/i.test(q) ||
    stateCode === "NV" ||
    (/\bnv\b/i.test(q) && SENIOR.test(q)) ||
    (CITY.test(q) &&
      SENIOR.test(q) &&
      !/\b(nm|new mexico|nc|north carolina|ky|kentucky|tn|tennessee|tx|texas)\b/i.test(q))
  );
}

function city(q: string): City | null {
  const m = q.match(CITY);
  if (!m) return null;
  const c = m[1].toLowerCase();
  return (c === "las vegas" ? "Las Vegas" : c[0].toUpperCase() + c.slice(1)) as City;
}

function describe(f: Facility): string {
  const endorse = f.endorsements.length
    ? ` Endorsements as printed: ${f.endorsements.join("; ")}.`
    : "";
  const cms = f.cmsBridge
    ? ` Its printed Federal Provider # ${f.cmsBridge} is a current CMS provider of the same class.`
    : " It is not linked to a CMS profile.";
  const sanc = f.sanctions.length
    ? ` ${f.sanctions.length} state sanction row${f.sanctions.length === 1 ? "" : "s"} on its HCQC page (latest ${f.sanctions[0].type}, ${f.sanctions[0].date}).`
    : " No state sanction is listed on its HCQC page.";
  return `HCQC ${CLASS_CODES[f.cls] ?? f.cls} ${f.credentialNumber}: ${f.name}, ${f.city ?? "city not printed"}, ${f.bedCount ?? "unknown"} beds, status ${f.status}${f.expires ? `, expires ${f.expires}` : ""}.${endorse}${cms}${sanc} ${f.inspectionCount} state inspection${f.inspectionCount === 1 ? "" : "s"} listed${f.latestInspection ? `, latest ${f.latestInspection}` : ""}. Open the Nevada research page.`;
}

function licenseLookup(q: string): NvAskAnswer | null {
  const full = q
    .toUpperCase()
    .match(/\b(\d{2,6})-(SNF|SFD|AGC|HIC|ADC|HHA|HBR|HPC|HFS)-(\d{1,3})\b/);
  if (full) {
    const f = lists.facilities.find((x) => x.credentialNumber === full[0]);
    return f
      ? { message: describe(f), alternatives: [OPEN], coverage: "KNOWN" }
      : {
          message: `No active HCQC license ${full[0]} is in the facility search download. That does not mean the facility never held one: closed and revoked licenses are not in the search. Check HCQC's facility search. Open the Nevada research page.`,
          alternatives: [OPEN],
          coverage: "KNOWN",
        };
  }
  const m = q.match(/\b(?:license|lic\.?|credential)\s*(?:no\.?|number|#)?\s*(\d{2,6})\b/i);
  if (!m) return null;
  const code = /\bsnf\b|skilled/i.test(q)
    ? "SNF"
    : /\brfg\b|residential facilit|group|assisted living|\bagc\b/i.test(q)
      ? "AGC"
      : /\bhirc?\b|individual residential/i.test(q)
        ? "HIC"
        : /home health|\bhha\b/i.test(q)
          ? "HHA"
          : /hospice/i.test(q)
            ? "HPC"
            : /adult day/i.test(q)
              ? "ADC"
              : null;
  if (!code) {
    return {
      message: `License number ${m[1]} alone does not say which Nevada facility class it belongs to; HCQC numbers are only unique with the class (for example 11168-AGC-3). Add the class, such as "RFG license ${m[1]}" or "SNF license ${m[1]}", or use HCQC's facility search. Open the Nevada research page.`,
      alternatives: [OPEN],
      coverage: "UNSUPPORTED",
    };
  }
  const rows = lists.facilities.filter(
    (x) =>
      x.licenseNumber === m[1] &&
      (x.cls === code ||
        (code === "SNF" && x.cls === "SFD") ||
        (code === "HPC" && x.cls === "HFS")),
  );
  if (rows.length === 1)
    return { message: describe(rows[0]), alternatives: [OPEN], coverage: "KNOWN" };
  return {
    message: rows.length
      ? `${rows.length} active HCQC licenses use number ${m[1]} in that class family: ${rows.map((r) => r.credentialNumber).join(", ")}. Ask for the full credential number. Open the Nevada research page.`
      : `No active ${CLASS_CODES[code]} license ${m[1]} is in HCQC's facility search download. Closed and revoked licenses are not in the search, and the number may belong to another class. Open the Nevada research page.`,
    alternatives: [OPEN],
    coverage: "KNOWN",
  };
}

export function interpretNevadaAsk(q: string, stateCode?: string): NvAskAnswer | null {
  if (!nevadaIntent(q, stateCode)) return null;
  if (/\b\d{6}\b/.test(q) && !/-(?:SNF|SFD|AGC|HIC|ADC|HHA|HBR|HPC|HFS)-/i.test(q)) return null; // exact CCN research stays on the CMS identifier path
  const lookup = licenseLookup(q);
  if (lookup) return lookup;
  const place = city(q);
  const counts = place ? s.cityContext.cities[place] : null;
  const rfg = s.rfg;

  if (/\b(best|safest|top|top-rated|worst|vetted|recommended)\b/i.test(q)) {
    return {
      message:
        "SeniorTrustHub does not rank Nevada facilities. CMS publishes federal measures on certified providers, and HCQC licenses facilities and publishes inspections and sanctions. TrustHub does not select a winner. Statewide research is on /nevada.",
      alternatives: [OPEN, "Show nursing homes in Nevada."],
      coverage: "UNSUPPORTED",
    };
  }
  if (
    /senior care|senior facilit|all nevada|how many facilities|long[- ]term care facilities/i.test(
      q,
    ) &&
    !/inspect|survey|deficienc|complaint|sanction|enforcement/i.test(q)
  ) {
    return {
      message:
        "Nevada senior care is class-specific: Skilled Nursing, Residential Facility for Groups (with or without the Assisted Living endorsement), Home for Individual Residential Care, Home Health, Hospice, and Adult Day Care are different settings. There is no combined Nevada senior-facility or bed total. Open the Nevada research page for each class.",
      alternatives: [OPEN, "Show nursing homes in Nevada."],
      coverage: "UNSUPPORTED",
    };
  }
  if (/memory care|dementia|alzheimer/i.test(q)) {
    return {
      message: `Nevada does not license "memory care" as its own facility. A Residential Facility for Groups can hold an Alzheimer's disease endorsement: ${n(rfg.alzheimerEndorsed)} of ${n(rfg.distinctCredentialNumbers)} RFGs print it (${n(rfg.assistedLivingAndAlzheimerEndorsed)} also hold Assisted Living), with ${n(rfg.categoryIIAlzheimerBedsPrinted)} Category II Alzheimer's beds printed. A facility that advertises memory care is state-endorsed only if its license shows the endorsement. Nursing homes may also serve residents with dementia. The endorsed list is on /nevada.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/individual residential care|\bhirc?\b/i.test(q)) {
    return {
      message: `Nevada Homes for Individual Residential Care (HIRC, HCQC code HIC) are a separate licensed class from Residential Facilities for Groups. HCQC's facility search lists ${n(s.hirc.distinctCredentialNumbers)} active HIRCs. They are not assisted living and not counted as RFGs. Open the Nevada research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/adult day/i.test(q)) {
    return {
      message: `Nevada Facilities for the Care of Adults During the Day (Adult Day Care) are a separate HCQC license class: ${n(s.adultDay.distinctCredentialNumbers)} active facilities in the facility search. They are not residential facilities. Open the Nevada research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/assisted living|residential facilit|\brfg\b|group home|\bagc\b/i.test(q)) {
    if (/complaint/i.test(q)) {
      return {
        message:
          "Complaints about Nevada Residential Facilities for Groups and assisted living go to the Nevada Health Authority's Bureau of Health Care Quality and Compliance (HCQC). Complaint records and outcomes are not published and were not acquired (request only). A complaint is not a deficiency and not an enforcement finding. HCQC inspection dates and state sanctions for each licensed RFG are on the Nevada research page.",
        alternatives: [OPEN],
        coverage: "REQUEST_ONLY",
      };
    }
    const local = counts
      ? ` ${counts.rfg} RFGs list an address in ${place}, ${counts.rfgAssistedLiving} of them with the Assisted Living endorsement.`
      : "";
    const askedAl = /assisted living/i.test(q);
    return {
      message: `${askedAl ? "In Nevada, assisted living is an endorsement, not a separate license. " : ""}A Residential Facility for Groups (RFG) is the base state license from the Nevada Health Authority's Bureau of Health Care Quality and Compliance (HCQC); an RFG must hold the Assisted Living endorsement before it may provide assisted living services. HCQC's facility search lists ${n(rfg.distinctCredentialNumbers)} active RFGs (${n(rfg.bedsAsPrinted)} beds); ${n(rfg.assistedLivingEndorsed)} print the Assisted Living endorsement.${local} Not every RFG is assisted living. Beds are capacity, not residents. An RFG is not a Skilled Nursing Facility and not CMS-certified. The list is on /nevada.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/sanction|enforcement|disciplin|fine|penalt|suspen|revok/i.test(q)) {
    const sc = s.stateSanctions;
    return {
      message: `HCQC facility pages list State Sanctions: ${n(sc.rows)} rows on ${n(sc.facilities)} active facilities (${Object.entries(
        sc.byType,
      )
        .map(([k, v]) => `${k} ${n(v)}`)
        .join(
          ", ",
        )}). Each sanction is shown only on the license page it came from; nothing is matched by name. Closed and revoked licenses are not in the facility search, so their sanctions are not here. A sanction is not an inspection result. Open the Nevada research page.`,
      alternatives: [OPEN],
      coverage: "PARTIAL",
    };
  }
  if (/survey|inspection|deficienc/i.test(q)) {
    return {
      message: `HCQC inspects Nevada health facilities for the state and, for certified nursing homes, for CMS. HCQC facility pages list ${n(s.inspections.indexRows)} state inspections (date, inspection number, grade) for ${n(s.inspections.facilitiesWithIndex)} active facilities; the findings stay on HCQC and were not copied. CMS Statements of Deficiencies stay on each CMS profile (${n(s.cmsOverlay.nursingHomes)} CMS nursing homes in Nevada). A state inspection is not a CMS inspection. Open the Nevada research page.`,
      alternatives: [OPEN, "Show nursing homes in Nevada."],
      coverage: "PARTIAL",
    };
  }
  if (/complaint/i.test(q)) {
    return {
      message:
        "The Nevada Health Authority's Bureau of Health Care Quality and Compliance (HCQC) takes complaints about licensed health facilities, including nursing homes and Residential Facilities for Groups. Complaint records and outcomes are not published in bulk and were not acquired (request only). A complaint is not a deficiency and not an enforcement finding. Open the Nevada research page.",
      alternatives: [OPEN],
      coverage: "REQUEST_ONLY",
    };
  }
  if (/licen[sc]e|\bhcqc\b|state list|\bbeds?\b/i.test(q)) {
    return {
      message: `HCQC's facility search lists ${n(s.skilledNursing.distinctCredentialNumbers)} Skilled Nursing licenses plus ${n(s.skilledNursingDistinctPart.distinctCredentialNumbers)} hospital distinct parts, ${n(rfg.distinctCredentialNumbers)} Residential Facilities for Groups (${n(rfg.assistedLivingEndorsed)} with the Assisted Living endorsement), ${n(s.hirc.distinctCredentialNumbers)} Homes for Individual Residential Care, ${n(s.homeHealth.distinctCredentialNumbers)} Home Health agencies, and ${n(s.hospiceProgram.distinctCredentialNumbers)} hospice programs, each counted on its own. ${n(s.crosswalk.cmsNursingHomesBridged)} of ${n(s.cmsOverlay.nursingHomes)} CMS nursing homes match a state SNF row by an exact printed CCN. Open the Nevada research page.`,
      alternatives: [OPEN, "Show nursing homes in Nevada."],
      coverage: "KNOWN",
    };
  }
  return null;
}
