import { MN_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/minnesota-facility-lists.json";

// MN-SEN-001. Minnesota guidance for questions the CMS directories cannot answer on their own: Assisted
// Living Facilities and the separate Assisted Living Facility with Dementia Care license, Boarding Care
// Homes, the Home Care license family, MDH license / HFID lookups, MDH evaluation and OHFC investigation
// results, complaints, combined totals, and ranking. Plain CMS class questions ("nursing homes Minnesota",
// "home health agency Minnesota", "hospice Minnesota") and unlabeled six-digit numbers (CCNs) return null
// so the existing CMS research path answers them.

export type MnAskAnswer = {
  message: string;
  alternatives: string[];
  coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";
};

type Facility = (typeof lists.facilities)[number];

const s = MN_PUBLIC_SNAPSHOT;
const n = (v: number) => v.toLocaleString("en-US");
const OPEN = "Open Minnesota senior-care research.";
const CITY = /\b(minneapolis|st\.? paul|saint paul|duluth)\b/i;
const OTHER_STATE =
  /\b(ga|georgia|al|alabama|va|virginia|ar|arkansas|nc|north carolina|tx|texas|wi|wisconsin|nv|nevada|tn|tennessee)\b/i;
const SENIOR =
  /nursing|assisted living|memory care|dementia|alzheimer|boarding care|board (?:and|&) care|home care|home health|hospice|senior|long[- ]term care|supervised living/i;

const LABEL: Record<string, string> = {
  nursingHome: "Nursing Home",
  assistedLiving: "Assisted Living Facility",
  assistedLivingDementiaCare: "Assisted Living Facility with Dementia Care",
  provisionalAssistedLiving: "Provisional Assisted Living Facility",
  provisionalAssistedLivingDementiaCare: "Provisional Assisted Living Facility with Dementia Care",
  boardingCare: "Boarding Care Home",
  comprehensiveHomeCare: "Comprehensive Home Care provider",
  temporaryComprehensiveHomeCare: "Temporary Comprehensive Home Care provider",
  basicHomeCare: "Basic Home Care provider",
  temporaryBasicHomeCare: "Temporary Basic Home Care provider",
  homeManagementRegistration: "Home Management registration",
  homeCareBranch: "Home Care branch",
  homeHealthAgency: "Home Health Agency",
  hospiceProvider: "Hospice Provider license",
  hospiceBranch: "Hospice Provider branch",
  residentialHospice: "Residential Hospice license",
  supervisedLiving: "Supervised Living Facility",
  icfIid: "ICF for individuals with intellectual disabilities",
  prtf: "Psychiatric residential treatment facility",
};

export function minnesotaIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "MN" && !/\bminnesota\b/i.test(q)) return false;
  return (
    /\bminnesota\b/i.test(q) ||
    /\bmdh\b|\bohfc\b|\bhfid\b/i.test(q) ||
    stateCode === "MN" ||
    (/\bmn\b/i.test(q) && SENIOR.test(q)) ||
    (CITY.test(q) && SENIOR.test(q) && !OTHER_STATE.test(q))
  );
}

function cityOf(q: string): keyof typeof s.cityContext.cities | null {
  const m = q.match(CITY);
  if (!m) return null;
  const c = m[1].toLowerCase();
  if (c.startsWith("st") || c.startsWith("saint")) return "St. Paul";
  return (c[0].toUpperCase() + c.slice(1)) as keyof typeof s.cityContext.cities;
}

function describe(f: Facility): string {
  const id = f.licenseNumber
    ? `license ${f.licenseNumber}`
    : f.recordNumber
      ? `record ${f.recordNumber}`
      : "no license number printed";
  const cms = f.cmsBridge
    ? ` Its printed Medicare number ${f.cmsBridge} is a CMS provider of the same class.`
    : f.medicareNumberAsPrinted
      ? ` Medicare number as printed: ${f.medicareNumberAsPrinted} (not linked to a CMS profile of this class).`
      : " No Medicare number is printed.";
  const inv = Object.entries(f.investigationFindings)
    .map(([k, v]) => `${k.toLowerCase()} ${v}`)
    .join(", ");
  const findings = `${f.evaluationCount} MDH evaluation${f.evaluationCount === 1 ? "" : "s"}${f.latestEvaluation ? ` (latest concluded ${f.latestEvaluation})` : ""} and ${f.investigationCount} OHFC investigation${f.investigationCount === 1 ? "" : "s"}${inv ? ` (${inv})` : ""} are posted for HFID ${f.hfid ?? "not printed"}.`;
  return `MDH ${LABEL[f.cls] ?? f.cls}: ${f.name}, ${f.city ?? "city not printed"}${f.county ? `, ${f.county} County` : ""}, ${id}${f.hfid ? `, HFID ${f.hfid}` : ""}${f.expires ? `, expires ${f.expires}` : ""}${f.licensedBeds != null ? `, ${f.licensedBeds} licensed beds` : ""}${f.conditionalLicense ? ", conditional license flag set" : ""}.${cms} ${findings} Open the Minnesota research page.`;
}

function lookup(q: string): MnAskAnswer | null {
  const hfid = q.match(/\bhfid\s*(?:#|no\.?|number)?\s*(\d{5})\b/i);
  const lic = q.match(/\b(?:license|lic\.?)\s*(?:#|no\.?|number)?\s*(\d{5,6})\b/i);
  if (!hfid && !lic) return null;
  const rows = hfid
    ? lists.facilities.filter((f) => f.hfid === hfid[1])
    : lists.facilities.filter((f) => f.licenseNumber === lic![1]);
  const what = hfid ? `HFID ${hfid[1]}` : `license ${lic![1]}`;
  if (!rows.length) {
    return {
      message: `No row with ${what} is in MDH's Health Care Provider Directory for the care classes on this page (nursing homes, assisted living, boarding care, home care and home health, hospice, supervised living). Closed facilities are not in the directory, and the number may belong to another provider type. Open the Minnesota research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (rows.length === 1)
    return { message: describe(rows[0]), alternatives: [OPEN], coverage: "KNOWN" };
  const classes = [...new Set(rows.map((r) => LABEL[r.cls] ?? r.cls))];
  return {
    message: `${rows.length} MDH directory rows carry ${what}: ${rows
      .slice(0, 6)
      .map((r) => `${r.name} (${LABEL[r.cls] ?? r.cls}, ${r.city ?? "city not printed"})`)
      .join(
        "; ",
      )}${rows.length > 6 ? "; and more" : ""}. ${classes.length > 1 ? "They are different classes; " : ""}branches and a parent can share a license number. Name the facility or class to narrow it. Open the Minnesota research page.`,
    alternatives: [OPEN],
    coverage: "KNOWN",
  };
}

export function interpretMinnesotaAsk(q: string, stateCode?: string): MnAskAnswer | null {
  if (!minnesotaIntent(q, stateCode)) return null;
  const found = lookup(q);
  if (found) return found;
  if (/\b\d{6}\b/.test(q)) return null; // an unlabeled six-digit number stays on the CMS identifier path
  if (/\b(license|lic\.?)\b/i.test(q) && /\b\d{3,6}\b/.test(q)) {
    return {
      message:
        'That number does not match a Minnesota MDH license or HFID format on its own. MDH license numbers are six digits and HFIDs are five digits; add the label, for example "license 424820" or "HFID 00002". Open the Minnesota research page.',
      alternatives: [OPEN],
      coverage: "UNSUPPORTED",
    };
  }
  const place = cityOf(q);
  const local = place ? s.cityContext.cities[place] : null;
  if (/\b(best|safest|top|top-rated|worst|vetted|recommended)\b/i.test(q)) {
    return {
      message:
        "SeniorTrustHub does not rank Minnesota providers. CMS publishes federal measures on certified providers, and MDH licenses providers and posts evaluation and investigation results. TrustHub does not select a winner. Statewide research is on /minnesota.",
      alternatives: [OPEN, "Show nursing homes in Minnesota."],
      coverage: "UNSUPPORTED",
    };
  }
  if (
    /senior care|senior facilit|all minnesota|how many facilities|long[- ]term care facilities/i.test(
      q,
    ) &&
    !/inspect|survey|evaluation|investigat|complaint|enforcement|sanction|fine/i.test(q)
  ) {
    return {
      message:
        "Minnesota senior care is class-specific: Nursing Home, Assisted Living Facility, Assisted Living Facility with Dementia Care, Boarding Care Home, Home Care, Home Health, Hospice, and Supervised Living are different MDH license types. There is no combined Minnesota senior-facility or bed total. Open the Minnesota research page for each class.",
      alternatives: [OPEN, "Show nursing homes in Minnesota."],
      coverage: "UNSUPPORTED",
    };
  }
  if (/\b(complaint|investigat|maltreatment|substantiated)/i.test(q)) {
    const f = s.findings;
    return {
      message: `Complaints about Minnesota health care facilities go to MDH's Office of Health Facility Complaints (OHFC). MDH posts OHFC investigation results by provider: ${n(f.investigationRowsAttached)} investigation results are attached here by exact HFID (${Object.entries(
        f.investigationFindingsAttached,
      )
        .map(([k, v]) => `${k.toLowerCase()} ${n(v)}`)
        .join(
          ", ",
        )}). MDH keeps results seven years when substantiated, four when inconclusive, and three when unsubstantiated, and not for closed facilities. Complaints that were not investigated are not published. A complaint is not a deficiency and not a sanction. Open the Minnesota research page.`,
      alternatives: [OPEN],
      coverage: "PARTIAL",
    };
  }
  if (/\b(sanction|enforcement|disciplin|fine|penalt|suspen|revok|conditional)/i.test(q)) {
    return {
      message: `Fines, conditional licenses, and license actions for Minnesota providers appear inside MDH evaluation and OHFC investigation documents; they were not parsed, so there is no Minnesota sanction count here. MDH's directory flags ${n(s.sanctions.conditionalLicenseFlagRows)} rows with a conditional license, shown as printed. An investigation finding is not a sanction. Open the Minnesota research page for each provider's evaluation and investigation results.`,
      alternatives: [OPEN, "Show nursing homes in Minnesota."],
      coverage: "NOT_ACQUIRED",
    };
  }
  if (/survey|inspection|evaluation|deficienc/i.test(q)) {
    return {
      message: `MDH evaluates licensed Minnesota providers and, for certified nursing homes, surveys for CMS. ${n(s.findings.evaluationRowsAttached)} MDH evaluation results (number, dates, and MDH's PDF) are attached by exact HFID; the document text stays on MDH and was not copied. CMS Statements of Deficiencies stay on each CMS profile (${n(s.cmsOverlay.nursingHomes)} CMS nursing homes in Minnesota). A state evaluation is not a CMS inspection. Open the Minnesota research page.`,
      alternatives: [OPEN, "Show nursing homes in Minnesota."],
      coverage: "PARTIAL",
    };
  }
  if (/memory care|dementia|alzheimer/i.test(q)) {
    const dc = s.assistedLivingDementiaCare;
    return {
      message: `Minnesota licenses Assisted Living Facility with Dementia Care as its own license type. MDH's directory lists ${n(dc.distinctLicenses)} Assisted Living Facilities with Dementia Care${local ? ` (${local.assistedLivingDementiaCare} in ${place})` : ""} and ${n(s.provisionalAssistedLivingDementiaCare.distinctLicenses)} provisional dementia-care licenses, separate from ${n(s.assistedLiving.distinctLicenses)} Assisted Living Facilities. "Memory care" is not an MDH license name; a facility that advertises it holds the dementia-care license only if MDH lists it so. Nursing homes may also serve residents with dementia. The list is on /minnesota.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/boarding care|board (?:and|&) care/i.test(q)) {
    const b = s.boardingCare;
    return {
      message: `Minnesota Boarding Care Homes are a separate MDH license from Nursing Homes: personal or custodial care, nursing services not required. MDH's directory lists ${n(b.distinctLicenses)} Boarding Care Home licenses (${n(b.licensedBedsAsPrinted ?? 0)} licensed beds as printed); ${n(b.withFederalNursingFacilityClassification)} carry a federal Nursing Facility classification, and the numbers printed for them are not CMS CCNs. They are not counted as nursing homes. Open the Minnesota research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/home care|home management/i.test(q) && !/home health/i.test(q)) {
    return {
      message: `Minnesota home care is licensed by MDH in separate types: ${n(s.comprehensiveHomeCare.distinctLicenses)} Comprehensive Home Care, ${n(s.temporaryComprehensiveHomeCare.distinctLicenses)} Temporary Comprehensive, ${n(s.basicHomeCare.distinctLicenses)} Basic, and ${n(s.temporaryBasicHomeCare.distinctLicenses)} Temporary Basic licenses, plus ${n(s.homeManagementRegistration.distinctLicenses)} Home Management registrations and ${n(s.homeCareBranch.rows)} branch rows. Home care is not Home Health: MDH lists ${n(s.homeHealthAgency.distinctLicenses)} Home Health Agencies separately, and CMS certifies ${n(s.cmsOverlay.homeHealth)} Minnesota agencies. The counts are not added. Open the Minnesota research page.`,
      alternatives: [OPEN, "Show home health agencies in Minnesota."],
      coverage: "KNOWN",
    };
  }
  if (/assisted living/i.test(q)) {
    const al = s.assistedLiving;
    const localText = local
      ? ` ${local.assistedLiving} Assisted Living Facilities and ${local.assistedLivingDementiaCare} with Dementia Care list a physical address in ${place}; an address is not a service area.`
      : "";
    return {
      message: `Minnesota licenses assisted living under Minnesota Statutes chapter 144G in separate MDH license types: ${n(al.distinctLicenses)} Assisted Living Facilities, ${n(s.assistedLivingDementiaCare.distinctLicenses)} Assisted Living Facilities with Dementia Care, and ${n(s.provisionalAssistedLiving.distinctLicenses)} + ${n(s.provisionalAssistedLivingDementiaCare.distinctLicenses)} one-year provisional licenses of each kind.${localText} Licensed beds are capacity, not residents. Assisted living is not a nursing home and not CMS-certified. The lists are on /minnesota.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/supervised living/i.test(q)) {
    return {
      message: `Minnesota Supervised Living Facilities (${n(s.supervisedLiving.distinctLicenses)} Class A/B licenses in MDH's directory) serve people with developmental disabilities, chemical dependency, mental illness, or physical disabilities; they are not senior housing. ICFs for individuals with intellectual disabilities (${n(s.icfIid.distinctLicenses)}) are listed separately. Open the Minnesota research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/\blicen[sc]e|\bmdh\b|state list|\bbeds?\b/i.test(q)) {
    return {
      message: `MDH's daily directory lists ${n(s.nursingHome.distinctLicenses)} Nursing Homes, ${n(s.assistedLiving.distinctLicenses)} Assisted Living Facilities, ${n(s.assistedLivingDementiaCare.distinctLicenses)} Assisted Living Facilities with Dementia Care, ${n(s.boardingCare.distinctLicenses)} Boarding Care Homes, ${n(s.homeHealthAgency.distinctLicenses)} Home Health Agencies, and ${n(s.hospiceProvider.distinctLicenses)} Hospice Provider licenses, each counted on its own. ${n(s.crosswalk.cmsNursingHomesBridged)} of ${n(s.cmsOverlay.nursingHomes)} CMS nursing homes match an MDH row by an exact printed CCN. Open the Minnesota research page.`,
      alternatives: [OPEN, "Show nursing homes in Minnesota."],
      coverage: "KNOWN",
    };
  }
  return null;
}
