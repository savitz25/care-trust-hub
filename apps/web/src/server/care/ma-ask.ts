import { MA_PUBLIC_SNAPSHOT } from "@care/domain";

// MA-SEN-001. Massachusetts guidance for questions the CMS directories cannot answer on their own:
// Rest Homes, AGE-certified Assisted Living Residences, DPH state licensing, the DPH survey tool,
// complaints, combined totals, and ranking. Plain CMS class questions ("nursing homes
// Massachusetts", "home health Massachusetts", "hospice Massachusetts") and CCN lookups return null
// so the existing CMS research path answers them.

export type MaAskAnswer = {
  message: string;
  alternatives: string[];
  coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";
};

const s = MA_PUBLIC_SNAPSHOT;
const n = (v: number) => v.toLocaleString("en-US");
const OPEN = "Open Massachusetts senior-care research.";

export function massachusettsIntent(q: string, stateCode?: string): boolean {
  return (
    /\bmassachusetts\b/i.test(q) ||
    stateCode === "MA" ||
    (/\b(boston|worcester)\b/i.test(q) &&
      /nursing|rest home|assisted living|\balr\b|senior|hospice|home health|adult day/i.test(q))
  );
}

function city(q: string): "Boston" | "Worcester" | "Springfield" | null {
  if (/\bboston\b/i.test(q)) return "Boston";
  if (/\bworcester\b/i.test(q)) return "Worcester";
  if (/\bspringfield\b/i.test(q) && /\bmassachusetts\b/i.test(q)) return "Springfield";
  return null;
}

export function interpretMassachusettsAsk(q: string, stateCode?: string): MaAskAnswer | null {
  if (!massachusettsIntent(q, stateCode)) return null;
  if (/\b\d{6}\b/.test(q)) return null; // exact CCN research stays on the CMS identifier path
  const place = city(q);
  const counts = place ? s.cityContext.cities[place] : null;
  const alr = s.assistedLiving;

  if (/\b(best|safest|top|top-rated|worst|vetted|recommended)\b/i.test(q)) {
    return {
      message:
        "SeniorTrustHub does not rank Massachusetts facilities and does not turn DPH survey results into a TrustHub score. CMS publishes federal measures on certified providers, DPH publishes its own survey performance tool, and AGE certifies assisted living. TrustHub does not select a winner. Statewide research is on /massachusetts.",
      alternatives: [OPEN, "Show nursing homes in Massachusetts."],
      coverage: "UNSUPPORTED",
    };
  }
  if (/rest home/i.test(q)) {
    const local = counts ? ` ${counts.restHomes} list an address in ${place}.` : "";
    return {
      message: `Massachusetts Rest Homes are a separate DPH license class for people who need 24-hour supervision but not routine nursing care. The DPH facility list dated ${s.restHomes.sourceAsOf} has ${n(s.restHomes.rows)} Rest Homes with ${n(s.restHomes.bedsSum)} beds.${local} A Rest Home is not a Nursing Home and not an Assisted Living Residence. The list is on /massachusetts.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/assisted living|\balr\b/i.test(q)) {
    if (/inspection|complaint/i.test(q)) {
      return {
        message:
          "Massachusetts Assisted Living Residences are certified by the Executive Office of Aging & Independence (AGE). ALR inspection and complaint records were not acquired. A complaint is not a finding. Open the Massachusetts research page.",
        alternatives: [OPEN],
        coverage: /complaint/i.test(q) ? "REQUEST_ONLY" : "NOT_ACQUIRED",
      };
    }
    const special = /special care|memory|dementia/i.test(q)
      ? ` ${n(alr.residencesWithSpecialCareUnits)} residences report special-care units (${n(alr.specialCareUnits)} special-care units in total).`
      : "";
    const local = counts ? ` ${counts.assistedLivingResidences} list an address in ${place}.` : "";
    return {
      message: `Massachusetts Assisted Living Residences must be certified by AGE. The AGE list dated ${alr.sourceAsOf} has ${n(alr.rows)} certified residences with ${n(alr.totalUnits)} units (${n(alr.traditionalUnits)} traditional, ${n(alr.specialCareUnits)} special-care).${special}${local} Units are not residents. An ALR is not a Rest Home, not a Nursing Home, and not CMS-certified. The list is on /massachusetts.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (/survey|inspection|deficienc/i.test(q) && /nursing home|dph|massachusetts/i.test(q)) {
    return {
      message: `DPH's Nursing Home Survey Performance Tool lists ${s.surveyTool.listedFacilities} surveyed nursing homes, with surveys processed through ${s.surveyTool.processedThrough}. It uses DPH's own method and is not a TrustHub score. Its results are searched one facility at a time on the DPH site and were not copied here. CMS inspection dates stay on each CMS nursing-home profile. Open the Massachusetts research page.`,
      alternatives: [OPEN, "Show nursing homes in Massachusetts."],
      coverage: "PARTIAL",
    };
  }
  if (/complaint/i.test(q)) {
    return {
      message:
        "DPH takes complaints about nursing homes and other licensed facilities. Provider-level complaint records are not published in bulk and were not acquired (request only). A complaint is not a deficiency unless a survey finds one. Open the Massachusetts research page.",
      alternatives: [OPEN],
      coverage: "REQUEST_ONLY",
    };
  }
  if (/licen[sc]e|\bdph\b|state list/i.test(q)) {
    return {
      message: `The DPH facility list dated ${s.dphWorkbook.sourceAsOf} has ${n(s.nursingHomes.rows)} Nursing Homes, ${n(s.restHomes.rows)} Rest Homes, ${n(s.homeHealth.rows)} Certified Home Health Agencies, and ${n(s.hospice.rows)} Hospice programs, each counted on its own. The list has no CMS Certification Number, so DPH rows are not linked to CMS profiles (${n(s.cmsOverlay.nursingHomes)} CMS nursing homes). It publishes no license status or expiration date. Open the Massachusetts research page.`,
      alternatives: [OPEN, "Show nursing homes in Massachusetts."],
      coverage: "KNOWN",
    };
  }
  if (/adult day/i.test(q)) {
    return {
      message: `DPH lists ${n(s.adultDayHealth.rows)} Adult Day Health programs. Adult day health is a day program, not a residence, and not a Nursing Home or Rest Home. Open the Massachusetts research page.`,
      alternatives: [OPEN],
      coverage: "KNOWN",
    };
  }
  if (
    /senior care|senior facilit|all massachusetts|how many facilities|long[- ]term care facilities/i.test(
      q,
    )
  ) {
    return {
      message:
        "Massachusetts senior care is class-specific: Nursing Home, Rest Home, Assisted Living Residence, Home Health, and Hospice are different settings with different regulators. There is no combined Massachusetts senior-facility total. Open the Massachusetts research page for each class.",
      alternatives: [OPEN, "Show nursing homes in Massachusetts."],
      coverage: "UNSUPPORTED",
    };
  }
  return null;
}
