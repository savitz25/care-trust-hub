export type Signal = "strong" | "positive" | "mixed" | "review" | "limited";
export type Trend = "improving" | "stable" | "declining" | "limited";

export interface SourceCitation {
  dataset: string;
  release: string;
  observed: string;
  record: string;
}

export interface HistoryEvent {
  date: string;
  title: string;
  detail: string;
  kind: "staffing" | "inspection" | "enforcement" | "ownership";
}

export interface Facility {
  slug: string;
  name: string;
  city: string;
  state: "IN";
  county: string;
  distance: number;
  careType: "Nursing home & rehabilitation" | "Skilled nursing & rehabilitation";
  cmsOverall: number | null;
  inspectionStars: number | null;
  staffingStars: number | null;
  qualityStars: number | null;
  rnHours: number | null;
  lpnHours: number | null;
  cnaHours: number | null;
  totalNurseHours: number | null;
  weekendNurseHours: number | null;
  turnover: number | null;
  stateTurnover: number;
  deficiencies: number | null;
  seriousDeficiencies: number;
  repeatCategories: string[];
  penalties: { date: string; amount: number; category: string }[];
  ownershipType: "For-profit" | "Nonprofit";
  operatingEntity: string;
  chainName: string | null;
  chainFacilityCount: number | null;
  chainAverageStars: number | null;
  ownershipChangeDate: string | null;
  trend: Trend;
  history: HistoryEvent[];
  source: SourceCitation;
}

export interface EvidenceDimension {
  key: string;
  label: string;
  value: string;
  signal: Signal;
  detail: string;
}

export interface Observation {
  category: string;
  headline: string;
  detail: string;
  why: string;
  signal: Signal;
}

export interface EvidenceQuestion {
  evidence: string;
  question: string;
}

const source: SourceCitation = {
  dataset: "Synthetic federal-style provider demonstration",
  release: "Experience Lab demonstration release",
  observed: "July 2026",
  record: "Fictional demo record — not a CMS record",
};

export const syntheticFacilities: readonly Facility[] = [
  {
    slug: "harbor-pines",
    name: "Harbor Pines Nursing & Rehabilitation",
    city: "Clearwater Junction",
    state: "IN",
    county: "Mercer County",
    distance: 3.2,
    careType: "Nursing home & rehabilitation",
    cmsOverall: 5,
    inspectionStars: 5,
    staffingStars: 5,
    qualityStars: 4,
    rnHours: 0.88,
    lpnHours: 0.92,
    cnaHours: 2.62,
    totalNurseHours: 4.42,
    weekendNurseHours: 3.96,
    turnover: 31,
    stateTurnover: 47,
    deficiencies: 2,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [],
    ownershipType: "Nonprofit",
    operatingEntity: "Harbor Pines Community Services",
    chainName: null,
    chainFacilityCount: null,
    chainAverageStars: null,
    ownershipChangeDate: null,
    trend: "stable",
    history: [
      {
        date: "Jun 2026",
        title: "Standard inspection",
        detail: "2 lower-severity deficiencies recorded.",
        kind: "inspection",
      },
      {
        date: "Mar 2026",
        title: "Staffing remained above benchmark",
        detail: "Total nursing hours stayed above the synthetic state comparison.",
        kind: "staffing",
      },
      {
        date: "Aug 2025",
        title: "Leadership structure confirmed",
        detail: "No ownership change was recorded in the demonstration period.",
        kind: "ownership",
      },
    ],
    source,
  },
  {
    slug: "meadowridge",
    name: "Meadowridge Skilled Nursing Center",
    city: "Ashford",
    state: "IN",
    county: "Mercer County",
    distance: 5.8,
    careType: "Skilled nursing & rehabilitation",
    cmsOverall: 4,
    inspectionStars: 5,
    staffingStars: 2,
    qualityStars: 5,
    rnHours: 0.44,
    lpnHours: 0.71,
    cnaHours: 2.01,
    totalNurseHours: 3.16,
    weekendNurseHours: 2.74,
    turnover: 58,
    stateTurnover: 47,
    deficiencies: 3,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [],
    ownershipType: "For-profit",
    operatingEntity: "Meadowridge Operations LLC",
    chainName: "Northstar Care Group",
    chainFacilityCount: 27,
    chainAverageStars: 2.8,
    ownershipChangeDate: "September 2025",
    trend: "declining",
    history: [
      {
        date: "Jul 2026",
        title: "Staffing rating changed",
        detail: "Synthetic staffing rating changed from 3 to 2 stars.",
        kind: "staffing",
      },
      {
        date: "Apr 2026",
        title: "Standard inspection",
        detail: "3 lower-severity deficiencies recorded.",
        kind: "inspection",
      },
      {
        date: "Sep 2025",
        title: "Ownership changed",
        detail: "Operating control moved to Northstar Care Group in this fictional scenario.",
        kind: "ownership",
      },
    ],
    source,
  },
  {
    slug: "northstar-pavilion",
    name: "Northstar Rehabilitation Pavilion",
    city: "Clearwater Junction",
    state: "IN",
    county: "Mercer County",
    distance: 7.4,
    careType: "Skilled nursing & rehabilitation",
    cmsOverall: 3,
    inspectionStars: 3,
    staffingStars: 3,
    qualityStars: 3,
    rnHours: 0.56,
    lpnHours: 0.79,
    cnaHours: 2.18,
    totalNurseHours: 3.53,
    weekendNurseHours: 3.09,
    turnover: 69,
    stateTurnover: 47,
    deficiencies: 5,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [],
    ownershipType: "For-profit",
    operatingEntity: "Northstar Pavilion Operations LLC",
    chainName: "Northstar Care Group",
    chainFacilityCount: 27,
    chainAverageStars: 2.8,
    ownershipChangeDate: null,
    trend: "stable",
    history: [
      {
        date: "May 2026",
        title: "Standard inspection",
        detail: "5 deficiencies recorded; none were marked serious in the demo data.",
        kind: "inspection",
      },
      {
        date: "Jan 2026",
        title: "Turnover increased",
        detail: "Total nursing turnover rose above the synthetic state comparison.",
        kind: "staffing",
      },
    ],
    source,
  },
  {
    slug: "willow-harbor",
    name: "Willow Harbor Care Center",
    city: "Red Cedar",
    state: "IN",
    county: "Adams County",
    distance: 9.1,
    careType: "Nursing home & rehabilitation",
    cmsOverall: 3,
    inspectionStars: 2,
    staffingStars: 4,
    qualityStars: 3,
    rnHours: 0.72,
    lpnHours: 0.83,
    cnaHours: 2.41,
    totalNurseHours: 3.96,
    weekendNurseHours: 3.58,
    turnover: 43,
    stateTurnover: 47,
    deficiencies: 7,
    seriousDeficiencies: 1,
    repeatCategories: ["Infection prevention"],
    penalties: [{ date: "January 2026", amount: 18420, category: "Civil monetary penalty" }],
    ownershipType: "For-profit",
    operatingEntity: "Willow Harbor Care Operations LLC",
    chainName: "Hearthline Senior Services",
    chainFacilityCount: 12,
    chainAverageStars: 3.1,
    ownershipChangeDate: null,
    trend: "improving",
    history: [
      {
        date: "Jul 2026",
        title: "Staffing rating improved",
        detail: "Synthetic staffing rating changed from 3 to 4 stars.",
        kind: "staffing",
      },
      {
        date: "May 2026",
        title: "Standard inspection",
        detail: "7 deficiencies, including one serious finding, were recorded.",
        kind: "inspection",
      },
      {
        date: "Jan 2026",
        title: "Civil monetary penalty",
        detail: "$18,420 synthetic monetary penalty recorded.",
        kind: "enforcement",
      },
    ],
    source,
  },
  {
    slug: "evergreen-springs",
    name: "Evergreen Springs Nursing Center",
    city: "Ashford",
    state: "IN",
    county: "Mercer County",
    distance: 11.3,
    careType: "Nursing home & rehabilitation",
    cmsOverall: 4,
    inspectionStars: 4,
    staffingStars: 4,
    qualityStars: 4,
    rnHours: 0.69,
    lpnHours: 0.85,
    cnaHours: 2.32,
    totalNurseHours: 3.86,
    weekendNurseHours: 3.45,
    turnover: 42,
    stateTurnover: 47,
    deficiencies: 4,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [],
    ownershipType: "For-profit",
    operatingEntity: "Evergreen Springs Operations LLC",
    chainName: "Northstar Care Group",
    chainFacilityCount: 27,
    chainAverageStars: 2.8,
    ownershipChangeDate: null,
    trend: "stable",
    history: [
      {
        date: "Jun 2026",
        title: "Standard inspection",
        detail: "4 lower-severity deficiencies recorded.",
        kind: "inspection",
      },
      {
        date: "Feb 2026",
        title: "Staffing held steady",
        detail: "Staffing remained above the synthetic state comparison.",
        kind: "staffing",
      },
    ],
    source,
  },
  {
    slug: "lakeview-commons",
    name: "Lakeview Commons Rehabilitation",
    city: "Red Cedar",
    state: "IN",
    county: "Adams County",
    distance: 13.7,
    careType: "Skilled nursing & rehabilitation",
    cmsOverall: 3,
    inspectionStars: 3,
    staffingStars: 3,
    qualityStars: 3,
    rnHours: 0.58,
    lpnHours: 0.77,
    cnaHours: 2.21,
    totalNurseHours: 3.56,
    weekendNurseHours: 3.15,
    turnover: 45,
    stateTurnover: 47,
    deficiencies: 4,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [],
    ownershipType: "Nonprofit",
    operatingEntity: "Lakeview Community Health Foundation",
    chainName: null,
    chainFacilityCount: null,
    chainAverageStars: null,
    ownershipChangeDate: null,
    trend: "stable",
    history: [
      {
        date: "Apr 2026",
        title: "Standard inspection",
        detail: "4 lower-severity deficiencies recorded.",
        kind: "inspection",
      },
      {
        date: "Oct 2025",
        title: "Governance record updated",
        detail: "Nonprofit ownership remained unchanged.",
        kind: "ownership",
      },
    ],
    source,
  },
  {
    slug: "cedar-lantern",
    name: "Cedar Lantern Nursing Center",
    city: "Clearwater Junction",
    state: "IN",
    county: "Mercer County",
    distance: 15.2,
    careType: "Nursing home & rehabilitation",
    cmsOverall: 3,
    inspectionStars: 2,
    staffingStars: 5,
    qualityStars: 3,
    rnHours: 0.82,
    lpnHours: 0.91,
    cnaHours: 2.55,
    totalNurseHours: 4.28,
    weekendNurseHours: 3.84,
    turnover: 35,
    stateTurnover: 47,
    deficiencies: 9,
    seriousDeficiencies: 1,
    repeatCategories: ["Resident care planning"],
    penalties: [],
    ownershipType: "For-profit",
    operatingEntity: "Cedar Lantern Health LLC",
    chainName: null,
    chainFacilityCount: null,
    chainAverageStars: null,
    ownershipChangeDate: null,
    trend: "improving",
    history: [
      {
        date: "Jun 2026",
        title: "Standard inspection",
        detail: "9 deficiencies, including one serious finding, were recorded.",
        kind: "inspection",
      },
      {
        date: "Mar 2026",
        title: "Staffing increased",
        detail: "RN and CNA hours rose in the synthetic quarterly record.",
        kind: "staffing",
      },
    ],
    source,
  },
  {
    slug: "maple-crossing",
    name: "Maple Crossing Rehabilitation House",
    city: "Ashford",
    state: "IN",
    county: "Mercer County",
    distance: 17.6,
    careType: "Skilled nursing & rehabilitation",
    cmsOverall: null,
    inspectionStars: null,
    staffingStars: null,
    qualityStars: null,
    rnHours: null,
    lpnHours: null,
    cnaHours: null,
    totalNurseHours: null,
    weekendNurseHours: null,
    turnover: null,
    stateTurnover: 47,
    deficiencies: null,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [],
    ownershipType: "Nonprofit",
    operatingEntity: "Maple Crossing Community Care",
    chainName: null,
    chainFacilityCount: null,
    chainAverageStars: null,
    ownershipChangeDate: "May 2026",
    trend: "limited",
    history: [
      {
        date: "May 2026",
        title: "Demonstration record began",
        detail: "Only a partial synthetic history is available.",
        kind: "ownership",
      },
    ],
    source,
  },
  {
    slug: "harbor-pines-east",
    name: "Harbor Pines East Rehabilitation",
    city: "Red Cedar",
    state: "IN",
    county: "Adams County",
    distance: 19.8,
    careType: "Skilled nursing & rehabilitation",
    cmsOverall: 2,
    inspectionStars: 2,
    staffingStars: 3,
    qualityStars: 3,
    rnHours: 0.55,
    lpnHours: 0.74,
    cnaHours: 2.11,
    totalNurseHours: 3.4,
    weekendNurseHours: 2.98,
    turnover: 51,
    stateTurnover: 47,
    deficiencies: 8,
    seriousDeficiencies: 1,
    repeatCategories: ["Infection prevention"],
    penalties: [],
    ownershipType: "For-profit",
    operatingEntity: "Harbor Pines East Operations LLC",
    chainName: "Hearthline Senior Services",
    chainFacilityCount: 12,
    chainAverageStars: 3.1,
    ownershipChangeDate: null,
    trend: "declining",
    history: [
      {
        date: "May 2026",
        title: "Standard inspection",
        detail: "8 deficiencies, including one serious finding, were recorded.",
        kind: "inspection",
      },
    ],
    source,
  },
  {
    slug: "silver-orchard",
    name: "Silver Orchard Skilled Nursing",
    city: "Clearwater Junction",
    state: "IN",
    county: "Mercer County",
    distance: 21.4,
    careType: "Skilled nursing & rehabilitation",
    cmsOverall: 4,
    inspectionStars: 4,
    staffingStars: 3,
    qualityStars: 5,
    rnHours: 0.61,
    lpnHours: 0.79,
    cnaHours: 2.2,
    totalNurseHours: 3.6,
    weekendNurseHours: 3.2,
    turnover: 49,
    stateTurnover: 47,
    deficiencies: 3,
    seriousDeficiencies: 0,
    repeatCategories: [],
    penalties: [{ date: "March 2026", amount: 9200, category: "Civil monetary penalty" }],
    ownershipType: "For-profit",
    operatingEntity: "Silver Orchard Operations LLC",
    chainName: "Silver Orchard Network",
    chainFacilityCount: 8,
    chainAverageStars: 3.7,
    ownershipChangeDate: null,
    trend: "stable",
    history: [
      {
        date: "Jun 2026",
        title: "Standard inspection",
        detail: "3 lower-severity deficiencies recorded.",
        kind: "inspection",
      },
      {
        date: "Mar 2026",
        title: "Civil monetary penalty",
        detail: "$9,200 synthetic monetary penalty recorded.",
        kind: "enforcement",
      },
    ],
    source,
  },
] as const;

export function getFacility(slug: string): Facility | undefined {
  return syntheticFacilities.find((facility) => facility.slug === slug);
}

export function getEvidenceDimensions(facility: Facility): EvidenceDimension[] {
  const stars = (value: number | null, label: string): EvidenceDimension =>
    value === null
      ? {
          key: label,
          label,
          value: "Not enough history",
          signal: "limited",
          detail: "The synthetic record does not yet contain enough data.",
        }
      : {
          key: label,
          label,
          value: `${value} of 5 stars`,
          signal: value >= 4 ? "strong" : value === 3 ? "mixed" : "review",
          detail: "Government-style demonstration rating; no proprietary score.",
        };
  return [
    stars(facility.cmsOverall, "CMS overall"),
    stars(facility.inspectionStars, "Health inspections"),
    stars(facility.staffingStars, "Staffing"),
    stars(facility.qualityStars, "Quality measures"),
    {
      key: "enforcement",
      label: "Recent enforcement",
      value: facility.penalties.length
        ? `${facility.penalties.length} recent penalty`
        : "No recent penalties",
      signal: facility.penalties.length ? "review" : "positive",
      detail: facility.penalties.length
        ? "Review the event, timing, and response."
        : "No penalties appear in this synthetic review period.",
    },
    {
      key: "ownership",
      label: "Ownership",
      value: facility.ownershipChangeDate
        ? `Changed ${facility.ownershipChangeDate}`
        : `${facility.ownershipType}; stable`,
      signal: facility.ownershipChangeDate ? "review" : "positive",
      detail: facility.chainName
        ? `Part of ${facility.chainName}.`
        : "No parent chain in the demonstration record.",
    },
    {
      key: "trend",
      label: "Recent trend",
      value: facility.trend[0].toUpperCase() + facility.trend.slice(1),
      signal:
        facility.trend === "improving"
          ? "positive"
          : facility.trend === "declining"
            ? "review"
            : facility.trend === "limited"
              ? "limited"
              : "mixed",
      detail: "Based only on the synthetic events shown in this prototype.",
    },
  ];
}

export function getStandoutObservations(facility: Facility): Observation[] {
  const observations: Observation[] = [];
  if (facility.totalNurseHours === null)
    observations.push({
      category: "History",
      headline: "Limited historical data",
      detail: "The demonstration record is too new for a dependable staffing trend.",
      why: "Missing history makes it harder to tell whether current conditions are typical.",
      signal: "limited",
    });
  else if ((facility.staffingStars ?? 0) >= 4)
    observations.push({
      category: "Staffing",
      headline: "Staffing is above the comparison benchmark",
      detail: `${facility.totalNurseHours.toFixed(2)} total nurse hours per resident day are shown in the latest synthetic period.`,
      why: "Staffing levels affect how much direct care and monitoring residents may receive.",
      signal: "strong",
    });
  else if ((facility.staffingStars ?? 0) <= 2)
    observations.push({
      category: "Staffing",
      headline: "Staffing deserves closer review",
      detail: `The synthetic staffing rating is ${facility.staffingStars} of 5 stars.`,
      why: "Lower staffing can affect response time and consistency of care.",
      signal: "review",
    });
  if (facility.turnover !== null && facility.turnover > facility.stateTurnover + 8)
    observations.push({
      category: "Staff continuity",
      headline: "Turnover is higher than the comparison benchmark",
      detail: `${facility.turnover}% turnover compared with a ${facility.stateTurnover}% synthetic state benchmark.`,
      why: "High turnover can make consistent routines and communication more difficult.",
      signal: "review",
    });
  if (
    facility.deficiencies !== null &&
    (facility.deficiencies >= 7 || facility.seriousDeficiencies > 0)
  )
    observations.push({
      category: "Inspection history",
      headline: "Recent inspection findings are worth reviewing",
      detail: `${facility.deficiencies} deficiencies, including ${facility.seriousDeficiencies} marked serious, appear in the latest synthetic inspection.`,
      why: "Inspection details show what reviewers observed and what the facility was expected to correct.",
      signal: "review",
    });
  if (facility.penalties.length)
    observations.push({
      category: "Enforcement",
      headline: "A recent monetary penalty is recorded",
      detail: `${facility.penalties[0].category} of $${facility.penalties[0].amount.toLocaleString("en-US")} in ${facility.penalties[0].date}.`,
      why: "A penalty is evidence to understand in context, not proof that every aspect of care is poor.",
      signal: "review",
    });
  if (facility.ownershipChangeDate)
    observations.push({
      category: "Ownership",
      headline: "Ownership changed recently",
      detail: `The demonstration record shows an ownership change in ${facility.ownershipChangeDate}.`,
      why: "Ownership transitions can coincide with changes in staffing, leadership, or operating practices.",
      signal: "mixed",
    });
  if (
    facility.chainName &&
    facility.chainAverageStars !== null &&
    facility.cmsOverall !== null &&
    facility.chainAverageStars < facility.cmsOverall - 0.5
  )
    observations.push({
      category: "Chain context",
      headline: "This facility performs above its chain portfolio",
      detail: `${facility.cmsOverall.toFixed(1)} facility stars compared with ${facility.chainAverageStars.toFixed(1)} across the synthetic chain portfolio.`,
      why: "Chain context can reveal whether facility-level results differ from the broader owner network.",
      signal: "mixed",
    });
  return observations.slice(0, 5);
}

export function getQuestionsToAsk(facility: Facility): EvidenceQuestion[] {
  const questions: EvidenceQuestion[] = [];
  if (facility.turnover !== null && facility.turnover > facility.stateTurnover + 8)
    questions.push({
      evidence: `Nursing turnover is ${facility.turnover}%`,
      question:
        "How many nurses currently working on my family member’s unit have been here for more than one year?",
    });
  if (facility.ownershipChangeDate)
    questions.push({
      evidence: `Ownership changed in ${facility.ownershipChangeDate}`,
      question:
        "What operational, leadership, or staffing changes occurred after the ownership transition?",
    });
  if (facility.repeatCategories.includes("Infection prevention"))
    questions.push({
      evidence: "Recent inspections include repeat infection-prevention findings",
      question:
        "What changes were made after the most recent infection-prevention finding, and how are they being monitored?",
    });
  if (facility.seriousDeficiencies > 0)
    questions.push({
      evidence: `${facility.seriousDeficiencies} serious deficiency in the latest synthetic inspection`,
      question:
        "What corrective action was required, when was it completed, and how do you verify it remains effective?",
    });
  if (facility.penalties.length)
    questions.push({
      evidence: `A $${facility.penalties[0].amount.toLocaleString("en-US")} synthetic penalty is recorded`,
      question: "What happened before this enforcement action, and what has changed since then?",
    });
  if (questions.length === 0)
    questions.push({
      evidence: "The latest synthetic record has no major enforcement flags",
      question:
        "What has changed in staffing, leadership, or resident care since the most recent inspection?",
    });
  return questions.slice(0, 4);
}

export function getComparisonObservations(
  facilities: readonly Facility[],
): { slug: string; text: string }[] {
  return facilities.map((facility) => {
    if (facility.totalNurseHours === null)
      return {
        slug: facility.slug,
        text: "Limited history means several dimensions cannot yet be compared.",
      };
    if (facility.penalties.length)
      return {
        slug: facility.slug,
        text:
          facility.trend === "improving"
            ? "Staffing is improving, while recent enforcement still deserves context."
            : "Recent enforcement activity deserves context alongside the broader record.",
      };
    if (facility.ownershipChangeDate)
      return {
        slug: facility.slug,
        text: "A recent ownership change and staffing continuity deserve closer review.",
      };
    if (
      facility.staffingStars !== null &&
      facility.staffingStars >= 4 &&
      facility.seriousDeficiencies === 0
    )
      return {
        slug: facility.slug,
        text: "Strong staffing and no serious recent inspection findings stand out.",
      };
    if (facility.turnover !== null && facility.turnover > facility.stateTurnover + 8)
      return {
        slug: facility.slug,
        text: "Turnover is notably higher than the synthetic state comparison.",
      };
    return {
      slug: facility.slug,
      text: "The evidence is mixed, with no single dimension deciding the choice.",
    };
  });
}
