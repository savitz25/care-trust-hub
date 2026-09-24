import { TN_PUBLIC_SNAPSHOT } from "@care/domain";
import lists from "@/data/tennessee-facility-lists.json";

// TN-SEN-001. Tennessee guidance for questions the CMS directories cannot answer on their own:
// Assisted Care Living Facilities, Residential Homes for the Aged, HFC licensing and license-number
// lookups, HFC facility actions, inspections context, complaints, combined totals, and ranking.
// Plain CMS class questions ("nursing homes Tennessee", "home health Tennessee", "hospice
// Tennessee") and CCN lookups return null so the existing CMS research path answers them.

export type TnAskAnswer = {
  message: string;
  alternatives: string[];
  coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";
};

const s = TN_PUBLIC_SNAPSHOT;
const n = (v: number) => v.toLocaleString("en-US");
const OPEN = "Open Tennessee senior-care research.";
const CITY = /\b(nashville|memphis|knoxville|chattanooga)\b/i;
const SENIOR =
  /nursing|assisted (?:care )?living|\baclf\b|home for the aged|\brha\b|senior|hospice|home health|adult care home|long[- ]term care/i;

type City = keyof typeof s.cityContext.cities;

export function tennesseeIntent(q: string, stateCode?: string): boolean {
  return (
    /\btennessee\b/i.test(q) ||
    stateCode === "TN" ||
    (/\btn\b/i.test(q) && SENIOR.test(q)) ||
    (CITY.test(q) && SENIOR.test(q))
  );
}

function city(q: string): City | null {
  const m = q.match(CITY);
  return m ? ((m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as City) : null;
}

function licenseLookup(q: string): TnAskAnswer | null {
  const m = q.match(
    /\b(aclf|assisted care living|rha|home for the aged|nursing home)\b.*?\b(?:license|lic\.?)\s*(?:no\.?|number|#)?\s*(\d{1,4})\b/i,
  );
  if (!m) return null;
  const cls = /aclf|assisted/i.test(m[1])
    ? "aclf"
    : /rha|aged/i.test(m[1])
      ? "rha"
      : "nursingHomes";
  const label =
    cls === "aclf"
      ? "Assisted Care Living Facility"
      : cls === "rha"
        ? "Residential Home for the Aged"
        : "Nursing Home";
  const num = Number(m[2]);
  const row = (
    lists[cls] as Array<{
      licenseNumber: number;
      name: string;
      city: string;
      county: string;
      totalBeds: number | null;
      licenseStatus: string;
    }>
  ).find((f) => f.licenseNumber === num);
  const actions = lists.actions.filter(
    (a) => a.attachedLicenseNumber === num && a.careSetting === cls,
  ).length;
  if (!row) {
    return {
      message: `No ${label} license ${num} is on HFC's July 2026 ${label} bed report. That does not mean the facility is unlicensed or closed; the number may belong to another class. Check HFC's facility search. Open the Tennessee research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  return {
    message: `HFC ${label} license ${num}: ${row.name}, ${row.city} (${row.county} County), ${row.totalBeds ?? "unknown"} licensed beds, status as published ${row.licenseStatus} (July 2026 bed report). ${actions ? `${actions} HFC facility action${actions === 1 ? "" : "s"} from 2024-2026 match this license number and name.` : "No 2024-2026 HFC facility action is linked to this license."} The state license is not a CMS CCN and is not linked to a CMS profile. Open the Tennessee research page.`,
    alternatives: [OPEN],
    coverage: "KNOWN",
  };
}

export function interpretTennesseeAsk(q: string, stateCode?: string): TnAskAnswer | null {
  if (!tennesseeIntent(q, stateCode)) return null;
  if (/\b\d{6}\b/.test(q)) return null; // exact CCN research stays on the CMS identifier path
  const lookup = licenseLookup(q);
  if (lookup) return lookup;
  const place = city(q);
  const counts = place ? s.cityContext.cities[place] : null;

  if (/\b(best|safest|top|top-rated|worst|vetted|recommended)\b/i.test(q)) {
    return {
      message:
        "SeniorTrustHub does not rank Tennessee facilities. CMS publishes federal measures on certified providers, and the Health Facilities Commission licenses facilities and publishes its actions. TrustHub does not select a winner. Statewide research is on /tennessee.",
      alternatives: [OPEN, "Show nursing homes in Tennessee."],
      coverage: "UNSUPPORTED",
    };
  }
  if (/home for the aged|\brha\b|residential home/i.test(q)) {
    const local = counts ? ` ${counts.rha} list an address in ${place}.` : "";
    return {
      message: `Tennessee Residential Homes for the Aged (RHA) are a separate Health Facilities Commission license class. HFC's July 2026 report lists ${n(s.rha.distinctLicenseNumbers)} RHAs with ${n(s.rha.licensedBeds)} licensed beds.${local} An RHA is not an Assisted Care Living Facility and not a Nursing Home. Beds are capacity, not residents. The list is on /tennessee.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/adult care home/i.test(q)) {
    return {
      message:
        "Tennessee Adult Care Homes are a separate license class. HFC publishes no statewide Adult Care Home list, so none was acquired, and they are not counted as RHAs or ACLFs. Open the Tennessee research page.",
      alternatives: [OPEN],
      coverage: "NOT_ACQUIRED",
    };
  }
  if (/assisted (?:care )?living|\baclf\b/i.test(q)) {
    if (/inspection|complaint/i.test(q)) {
      return {
        message:
          "Tennessee Assisted Care Living Facilities are licensed by the Health Facilities Commission. ACLF inspection reports and complaint records were not acquired. HFC's monthly facility actions (civil penalties, probation) are on the Tennessee page. A complaint is not a finding.",
        alternatives: [OPEN],
        coverage: /complaint/i.test(q) ? "REQUEST_ONLY" : "NOT_ACQUIRED",
      };
    }
    const memory = /memory|dementia|secured/i.test(q)
      ? ` ${n(s.aclf.facilitiesWithSecuredBeds)} ACLFs report secured beds (${n(s.aclf.securedBeds)} in all).`
      : "";
    const local = counts ? ` ${counts.aclf} list an address in ${place}.` : "";
    return {
      message: `Tennessee calls assisted living an Assisted Care Living Facility (ACLF), licensed by the Health Facilities Commission. HFC's July 2026 report lists ${n(s.aclf.distinctLicenseNumbers)} ACLFs with ${n(s.aclf.licensedBeds)} licensed beds.${memory}${local} Beds are capacity, not residents. An ACLF is not a Nursing Home, not a Residential Home for the Aged, and not CMS-certified. The list is on /tennessee.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/enforcement|disciplin|action|penalt|probation|suspen|abuse/i.test(q)) {
    const fa = s.facilityActions;
    return {
      message: `The Health Facilities Commission's monthly Facility Action and Abuse Reports (${fa.window.replace("/", " to ")}, ${fa.monthsAcquired} reports) list ${n(fa.seniorClassActionRows)} actions against Nursing Homes, Assisted Care Living Facilities, Residential Homes for the Aged, and other senior settings, mostly civil monetary penalties. ${n(fa.attachedToStateReportRow)} match a July 2026 HFC report row by exact license class, number, and name; the rest stay standalone. None is linked to a CMS profile. Abuse Registry entries name individual workers and are not republished. An action is not an inspection result. Open the Tennessee research page.`,
      alternatives: [OPEN],
      coverage: "PARTIAL",
    };
  }
  if (/survey|inspection|deficienc/i.test(q)) {
    return {
      message: `Tennessee nursing-home inspections are done by the Health Facilities Commission for the state and for CMS. Facility inspection results for certified nursing homes are CMS Statements of Deficiencies and stay on each CMS profile (${n(s.cmsOverlay.nursingHomes)} CMS nursing homes in Tennessee). HFC's annual Nursing Home Inspection and Enforcement Report is statewide context, not facility data. HFC facility actions from 2024-2026 are on the Tennessee research page.`,
      alternatives: [OPEN, "Show nursing homes in Tennessee."],
      coverage: "PARTIAL",
    };
  }
  if (/complaint/i.test(q)) {
    return {
      message:
        "The Tennessee Health Facilities Commission takes complaints about licensed facilities through its public complaints portal. Complaint records and outcomes are not published in bulk and were not acquired (request only). A complaint is not a deficiency and not an enforcement finding. Open the Tennessee research page.",
      alternatives: [OPEN],
      coverage: "REQUEST_ONLY",
    };
  }
  if (/licen[sc]e|\bhfc\b|state list|\bbeds?\b/i.test(q)) {
    return {
      message: `HFC's July 2026 bed reports list ${n(s.nursingHomes.distinctLicenseNumbers)} Nursing Home licenses (${n(s.nursingHomes.licensedBeds)} beds), ${n(s.aclf.distinctLicenseNumbers)} Assisted Care Living Facilities (${n(s.aclf.licensedBeds)} beds), and ${n(s.rha.distinctLicenseNumbers)} Residential Homes for the Aged (${n(s.rha.licensedBeds)} beds), each counted on its own. The reports have no CMS Certification Number, so HFC rows are not linked to CMS profiles (${n(s.cmsOverlay.nursingHomes)} CMS nursing homes). Open the Tennessee research page.`,
      alternatives: [OPEN, "Show nursing homes in Tennessee."],
      coverage: "KNOWN",
    };
  }
  if (
    /senior care|senior facilit|all tennessee|how many facilities|long[- ]term care facilities/i.test(
      q,
    )
  ) {
    return {
      message:
        "Tennessee senior care is class-specific: Nursing Home, Assisted Care Living Facility, Residential Home for the Aged, Home Health, and Hospice are different settings. There is no combined Tennessee senior-facility or bed total. Open the Tennessee research page for each class.",
      alternatives: [OPEN, "Show nursing homes in Tennessee."],
      coverage: "UNSUPPORTED",
    };
  }
  return null;
}
