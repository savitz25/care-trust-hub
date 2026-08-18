export const CARE_NEEDS_NAVIGATOR_VERSION = "care-needs-navigator-v1";
export const CARE_NEEDS_NAVIGATOR_PATH = "/tools/care-needs-navigator";
export const CMS_CERTIFIED_FACILITY_COUNT = 14693;

export const CARE_SETTINGS = [
  "aging_in_place",
  "home_care",
  "home_health",
  "assisted_living",
  "memory_care",
  "skilled_nursing",
  "short_term_rehab",
] as const;

export type CareSetting = (typeof CARE_SETTINGS)[number];

export const ALIGNMENTS = [
  "strongly_worth_investigating",
  "may_be_appropriate",
  "could_remain_an_option",
  "less_aligned",
] as const;

export type Alignment = (typeof ALIGNMENTS)[number];

export const ASSISTANCE_LEVELS = [
  "independent",
  "some_help",
  "a_lot_of_help",
  "fully_dependent",
  "not_sure",
] as const;

export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];
export type CertaintyAnswer = "yes" | "no" | "not_sure";
export type FrequencyAnswer = "yes" | "usually" | "rarely" | "no" | "not_sure";
export type NeedAmount = "none" | "some" | "several" | "not_sure";
export type TherapyNeed = "none" | "some" | "intensive" | "not_sure";
export type MedicationSupport =
  | "independent"
  | "reminders"
  | "organize_or_administer"
  | "clinical_oversight"
  | "not_sure";
export type CaregiverHelp =
  | "most_of_day"
  | "several_hours"
  | "occasional"
  | "little_reliable_help"
  | "unsure";
export type LivingSituation = "alone" | "with_family" | "senior_community" | "not_sure";
export type StrainAnswer = "no" | "sometimes" | "yes" | "unsure";
export type WalkingAbility =
  | "independent"
  | "walker_or_cane"
  | "wheelchair"
  | "cannot_safely_move"
  | "not_sure";

export const ADL_KEYS = ["bathing", "dressing", "toileting", "eating", "transfers"] as const;
export type AdlKey = (typeof ADL_KEYS)[number];

export interface CareNeedsAnswers {
  bathing?: AssistanceLevel;
  dressing?: AssistanceLevel;
  toileting?: AssistanceLevel;
  eating?: AssistanceLevel;
  transfers?: AssistanceLevel;
  walking?: WalkingAbility;
  falls?: "no" | "sometimes" | "yes" | "not_sure";
  memoryDaily?: "no" | "some" | "a_lot" | "not_sure";
  safetyConcerns?: NeedAmount;
  aloneHours?: FrequencyAnswer;
  overnightNeeded?: "no" | "sometimes" | "yes" | "not_sure";
  overnightAvailable?: "yes" | "no" | "not_sure" | "not_applicable";
  medications?: MedicationSupport;
  skilledNursing?: NeedAmount;
  recentRecovery?: CertaintyAnswer;
  therapyNeeds?: TherapyNeed;
  caregiverHelp?: CaregiverHelp;
  caregiverStrain?: StrainAnswer;
  livingSituation?: LivingSituation;
  immediateSafety?: "safe" | "usually_safe" | "immediate_concern" | "not_sure";
}

export type NeedLevel = "none" | "limited" | "moderate" | "substantial" | "uncertain";

export interface CareNeedProfile {
  adlAssistance: NeedLevel;
  mobilitySupport: NeedLevel;
  cognitiveSupervision: NeedLevel;
  clinicalNeeds: NeedLevel;
  rehabilitationNeeds: NeedLevel;
  medicationSupport: NeedLevel;
  caregiverAvailability: NeedLevel;
  overnightSupervision: NeedLevel;
  urgentSafetyConcern: boolean;
  uncertainAnswerCount: number;
}

export interface SettingRecommendation {
  setting: CareSetting;
  title: string;
  alignment: Alignment;
  alignmentLabel: string;
  why: string[];
  provides: string[];
  doesNotProvide: string[];
  professionalQuestions: string[];
  nextActionLabel: string;
  nextActionHref: string | null;
  coverageNote: string | null;
}

export interface CareNeedsResult {
  version: typeof CARE_NEEDS_NAVIGATOR_VERSION;
  profile: CareNeedProfile;
  headline: string;
  summary: string;
  recommendations: SettingRecommendation[];
  alternatives: string[];
  professionalQuestions: string[];
  showSkilledNursingBridge: boolean;
  urgentSafetyMessage: string | null;
  disclaimer: string;
  limitedCertainty: boolean;
}

export const NAVIGATOR_DISCLAIMER =
  "SeniorTrustHub's Care Needs Navigator is an educational decision-support tool. It does not diagnose conditions, determine medical necessity, or replace an assessment by a physician, nurse, social worker, therapist, or other qualified professional.";

export const URGENT_SAFETY_MESSAGE =
  "If there is an immediate danger or urgent medical concern, seek appropriate emergency or professional medical help rather than relying on this Navigator.";

const ALIGNMENT_LABELS: Record<Alignment, string> = {
  strongly_worth_investigating: "Strongly worth investigating",
  may_be_appropriate: "May be appropriate",
  could_remain_an_option: "Could remain an option",
  less_aligned: "Less aligned with the needs described",
};

const SETTING_COPY: Record<
  CareSetting,
  { title: string; provides: string[]; doesNotProvide: string[] }
> = {
  aging_in_place: {
    title: "Aging in place / independent living",
    provides: [
      "Continuing to live in a familiar home or independent setting",
      "Optional help with meals, transportation, or home modifications",
    ],
    doesNotProvide: [
      "Continuous personal care or overnight supervision",
      "Licensed nursing or rehabilitation unless separately arranged",
    ],
  },
  home_care: {
    title: "Non-medical home care",
    provides: [
      "Help with bathing, dressing, meals, companionship, and household tasks",
      "Support that can often be scheduled around family caregiving",
    ],
    doesNotProvide: [
      "Licensed medical or skilled nursing services",
      "A substitute for a physician, nurse, or therapy plan",
    ],
  },
  home_health: {
    title: "Home health",
    provides: [
      "Intermittent professional nursing or therapy in the home when ordered",
      "A way to receive clinical care while remaining at home",
    ],
    doesNotProvide: [
      "Round-the-clock nursing or a guaranteed Medicare benefit",
      "Eligibility or coverage — those decisions belong to clinicians and payers",
    ],
  },
  assisted_living: {
    title: "Assisted living",
    provides: [
      "A residential setting with meals, housekeeping, and recurring personal-care help",
      "Medication reminders or assistance in many communities",
    ],
    doesNotProvide: [
      "Guaranteed 24-hour licensed nursing",
      "A SeniorTrustHub national facility directory — that coverage is not built yet",
    ],
  },
  memory_care: {
    title: "Memory-supportive care",
    provides: [
      "A more structured environment with supervision and cueing",
      "Support when remaining alone is no longer safe",
    ],
    doesNotProvide: [
      "A diagnosis, or a conclusion that a specific memory condition is present",
      "A SeniorTrustHub national memory-care directory — that coverage is not built yet",
    ],
  },
  skilled_nursing: {
    title: "Skilled nursing facility",
    provides: [
      "A 24-hour nursing environment for people with substantial care or clinical needs",
      "Access to CMS-certified facilities that SeniorTrustHub already documents",
    ],
    doesNotProvide: [
      "A determination that a nursing-home stay is required by a clinician or payer",
      "A recommendation of any specific facility",
    ],
  },
  short_term_rehab: {
    title: "Short-term skilled rehabilitation",
    provides: [
      "A time-limited setting focused on recovery after illness, surgery, or injury",
      "Intensive physical, occupational, or speech therapy with skilled nursing support",
    ],
    doesNotProvide: [
      "A long-term nursing-home placement decision",
      "A guarantee of coverage or a specific length of stay",
    ],
  },
};

function isUnsure(value: string | undefined): boolean {
  return value === "not_sure" || value === "unsure";
}

function assistanceWeight(level: AssistanceLevel | undefined): number {
  if (level === "fully_dependent") return 3;
  if (level === "a_lot_of_help") return 2;
  if (level === "some_help") return 1;
  return 0;
}

export function countUncertainAnswers(answers: CareNeedsAnswers): number {
  return Object.values(answers).filter((value) => isUnsure(value)).length;
}

export function buildNeedProfile(answers: CareNeedsAnswers): CareNeedProfile {
  const adlValues = ADL_KEYS.map((key) => answers[key]);
  const answeredAdls = adlValues.filter((value): value is AssistanceLevel => Boolean(value));
  const unsureAdls = answeredAdls.filter((value) => value === "not_sure").length;
  const dependent = answeredAdls.filter((value) => value === "fully_dependent").length;
  const aLot = answeredAdls.filter((value) => value === "a_lot_of_help").length;
  const some = answeredAdls.filter((value) => value === "some_help").length;
  const adlScore = answeredAdls.reduce((sum, value) => sum + assistanceWeight(value), 0);
  let adlAssistance: NeedLevel = "none";
  if (answeredAdls.length === 0 || unsureAdls >= 3) adlAssistance = "uncertain";
  else if (dependent >= 1 || aLot >= 2 || adlScore >= 6) adlAssistance = "substantial";
  else if (aLot >= 1 || some >= 3 || adlScore >= 3) adlAssistance = "moderate";
  else if (some >= 1) adlAssistance = "limited";

  let mobilitySupport: NeedLevel = "none";
  if (answers.walking === "not_sure" && answers.falls === "not_sure") mobilitySupport = "uncertain";
  else if (
    answers.walking === "cannot_safely_move" ||
    answers.transfers === "fully_dependent" ||
    answers.transfers === "a_lot_of_help"
  ) {
    mobilitySupport = "substantial";
  } else if (
    answers.walking === "wheelchair" ||
    answers.falls === "yes" ||
    answers.walking === "walker_or_cane"
  ) {
    mobilitySupport = answers.falls === "yes" ? "moderate" : "limited";
    if (answers.walking === "wheelchair") mobilitySupport = "moderate";
  } else if (answers.falls === "sometimes") mobilitySupport = "limited";

  const memorySignal =
    answers.memoryDaily === "a_lot" ||
    answers.memoryDaily === "some" ||
    answers.safetyConcerns === "several" ||
    answers.safetyConcerns === "some";
  let cognitiveSupervision: NeedLevel = "none";
  if (
    answers.memoryDaily === "not_sure" &&
    answers.safetyConcerns === "not_sure" &&
    !memorySignal
  ) {
    cognitiveSupervision = "uncertain";
  } else if (
    answers.safetyConcerns === "several" ||
    answers.memoryDaily === "a_lot" ||
    (memorySignal && answers.aloneHours === "no")
  ) {
    cognitiveSupervision = "substantial";
  } else if (memorySignal || answers.aloneHours === "rarely") {
    cognitiveSupervision = "moderate";
  } else if (answers.memoryDaily === "not_sure" || answers.safetyConcerns === "not_sure") {
    cognitiveSupervision = "uncertain";
  }

  let clinicalNeeds: NeedLevel = "none";
  if (answers.skilledNursing === "not_sure") clinicalNeeds = "uncertain";
  else if (answers.skilledNursing === "several") clinicalNeeds = "substantial";
  else if (answers.skilledNursing === "some") clinicalNeeds = "moderate";

  let rehabilitationNeeds: NeedLevel = "none";
  if (answers.recentRecovery === "not_sure" && answers.therapyNeeds === "not_sure") {
    rehabilitationNeeds = "uncertain";
  } else if (answers.recentRecovery === "yes" && answers.therapyNeeds === "intensive") {
    rehabilitationNeeds = "substantial";
  } else if (answers.recentRecovery === "yes" && answers.therapyNeeds === "some") {
    rehabilitationNeeds = "moderate";
  } else if (answers.therapyNeeds === "intensive") {
    rehabilitationNeeds = "limited";
  }

  let medicationSupport: NeedLevel = "none";
  if (answers.medications === "not_sure") medicationSupport = "uncertain";
  else if (answers.medications === "clinical_oversight") medicationSupport = "substantial";
  else if (answers.medications === "organize_or_administer") medicationSupport = "moderate";
  else if (answers.medications === "reminders") medicationSupport = "limited";

  let caregiverAvailability: NeedLevel = "none";
  if (answers.caregiverHelp === "unsure") caregiverAvailability = "uncertain";
  else if (answers.caregiverHelp === "little_reliable_help") caregiverAvailability = "substantial";
  else if (answers.caregiverHelp === "occasional") caregiverAvailability = "moderate";
  else if (answers.caregiverHelp === "several_hours") caregiverAvailability = "limited";
  else if (answers.caregiverHelp === "most_of_day") caregiverAvailability = "none";

  let overnightSupervision: NeedLevel = "none";
  if (answers.overnightNeeded === "not_sure") overnightSupervision = "uncertain";
  else if (answers.overnightNeeded === "yes") overnightSupervision = "substantial";
  else if (answers.overnightNeeded === "sometimes") overnightSupervision = "moderate";

  return {
    adlAssistance,
    mobilitySupport,
    cognitiveSupervision,
    clinicalNeeds,
    rehabilitationNeeds,
    medicationSupport,
    caregiverAvailability,
    overnightSupervision,
    urgentSafetyConcern: answers.immediateSafety === "immediate_concern",
    uncertainAnswerCount: countUncertainAnswers(answers),
  };
}

function strongHomeSupport(answers: CareNeedsAnswers): boolean {
  return (
    answers.caregiverHelp === "most_of_day" ||
    answers.overnightAvailable === "yes" ||
    (answers.livingSituation === "with_family" && answers.caregiverHelp === "several_hours")
  );
}

function weakHomeSupport(answers: CareNeedsAnswers): boolean {
  return (
    answers.caregiverHelp === "little_reliable_help" ||
    answers.livingSituation === "alone" ||
    (answers.overnightNeeded === "yes" && answers.overnightAvailable === "no")
  );
}

function whyFrom(answers: CareNeedsAnswers, predicates: Array<[boolean, string]>): string[] {
  return predicates.filter(([match]) => match).map(([, text]) => text);
}

function alignmentRank(alignment: Alignment): number {
  return ALIGNMENTS.indexOf(alignment);
}

function recommendation(
  setting: CareSetting,
  alignment: Alignment,
  why: string[],
  extras: Partial<Pick<SettingRecommendation, "professionalQuestions" | "nextActionHref">> = {},
): SettingRecommendation {
  const copy = SETTING_COPY[setting];
  const coverageNote =
    setting === "assisted_living" || setting === "memory_care"
      ? "SeniorTrustHub's current national evidence directory covers CMS-certified nursing facilities, not assisted living or memory-care communities."
      : null;
  const nextActionHref =
    extras.nextActionHref !== undefined
      ? extras.nextActionHref
      : setting === "skilled_nursing" || setting === "short_term_rehab"
        ? "/search"
        : null;
  const nextActionLabel = nextActionHref
    ? "Research CMS-certified nursing facilities"
    : setting === "assisted_living" || setting === "memory_care"
      ? "Use the questions below with local professionals"
      : "Discuss these options with family and care professionals";
  return {
    setting,
    title: copy.title,
    alignment,
    alignmentLabel: ALIGNMENT_LABELS[alignment],
    why,
    provides: copy.provides,
    doesNotProvide: copy.doesNotProvide,
    professionalQuestions: extras.professionalQuestions ?? [],
    nextActionLabel,
    nextActionHref,
    coverageNote,
  };
}

export function evaluateCareNeeds(answers: CareNeedsAnswers): CareNeedsResult {
  const profile = buildNeedProfile(answers);
  const limitedCertainty = profile.uncertainAnswerCount >= 4;
  const homeSupport = strongHomeSupport(answers);
  const limitedSupport = weakHomeSupport(answers);
  const adlHelp =
    profile.adlAssistance === "limited" ||
    profile.adlAssistance === "moderate" ||
    profile.adlAssistance === "substantial";
  const substantialClinical = profile.clinicalNeeds === "substantial";
  const someClinical = profile.clinicalNeeds === "moderate" || substantialClinical;
  const highCognition = profile.cognitiveSupervision === "substantial";
  const someCognition =
    profile.cognitiveSupervision === "moderate" || profile.cognitiveSupervision === "substantial";

  const agingWhy = whyFrom(answers, [
    [
      ADL_KEYS.every((key) => answers[key] === "independent"),
      "Daily activities are mostly independent",
    ],
    [
      answers.aloneHours === "yes" || answers.aloneHours === "usually",
      "The person can usually be alone for several hours",
    ],
    [
      answers.medications === "independent" || answers.medications === "reminders",
      "Medications are manageable independently or with reminders",
    ],
    [answers.skilledNursing === "none", "No ongoing skilled nursing needs were described"],
    [
      answers.walking === "independent" || answers.walking === "walker_or_cane",
      "Mobility appears reasonably safe with current supports",
    ],
  ]);
  let agingAlignment: Alignment = "less_aligned";
  if (
    profile.adlAssistance === "none" &&
    profile.cognitiveSupervision === "none" &&
    profile.clinicalNeeds === "none"
  ) {
    agingAlignment = "strongly_worth_investigating";
  } else if (profile.adlAssistance === "limited" && !highCognition && !substantialClinical) {
    agingAlignment = homeSupport ? "may_be_appropriate" : "could_remain_an_option";
  } else if (homeSupport && !substantialClinical && !highCognition) {
    agingAlignment = "could_remain_an_option";
  }

  const homeCareWhy = whyFrom(answers, [
    [adlHelp, "Help is needed with everyday personal care such as bathing, dressing, or meals"],
    [
      answers.medications === "reminders" || answers.medications === "organize_or_administer",
      "Medication support is needed at home",
    ],
    [
      !someClinical,
      "The needs described are primarily personal care rather than skilled clinical care",
    ],
    [homeSupport, "Family or other caregivers can provide a meaningful amount of support"],
  ]);
  let homeCareAlignment: Alignment = "less_aligned";
  if (adlHelp && !substantialClinical && !highCognition) {
    homeCareAlignment = "strongly_worth_investigating";
  } else if (profile.adlAssistance === "limited" || answers.medications === "reminders") {
    homeCareAlignment = "may_be_appropriate";
  } else if (homeSupport && adlHelp) {
    homeCareAlignment = "could_remain_an_option";
  } else if (profile.adlAssistance === "none" && answers.caregiverHelp === "occasional") {
    homeCareAlignment = "could_remain_an_option";
  }

  const homeHealthWhy = whyFrom(answers, [
    [someClinical, "Professional nursing or monitoring was described"],
    [
      answers.therapyNeeds === "some" || answers.therapyNeeds === "intensive",
      "Therapy may be needed in addition to personal care",
    ],
    [
      answers.aloneHours !== "no" || homeSupport,
      "Remaining at home may still be possible if clinical visits can be arranged",
    ],
  ]);
  let homeHealthAlignment: Alignment = "less_aligned";
  if (someClinical && (homeSupport || answers.aloneHours !== "no")) {
    homeHealthAlignment =
      profile.clinicalNeeds === "moderate" ? "strongly_worth_investigating" : "may_be_appropriate";
  } else if (answers.therapyNeeds === "some" && answers.recentRecovery === "yes") {
    homeHealthAlignment = "may_be_appropriate";
  } else if (someClinical) {
    homeHealthAlignment = "could_remain_an_option";
  }

  const assistedWhy = whyFrom(answers, [
    [
      profile.adlAssistance === "moderate" || profile.adlAssistance === "substantial",
      "Recurring help is needed with daily activities",
    ],
    [
      answers.medications === "reminders" || answers.medications === "organize_or_administer",
      "Medications require reminders or someone to organize and give them",
    ],
    [!substantialClinical, "The answers do not clearly describe ongoing 24-hour skilled nursing"],
    [
      answers.aloneHours === "rarely" || answers.aloneHours === "usually",
      "Some supervision or a more supportive daily routine may help",
    ],
  ]);
  let assistedAlignment: Alignment = "less_aligned";
  if (
    (profile.adlAssistance === "moderate" || profile.medicationSupport === "moderate") &&
    !substantialClinical &&
    !highCognition
  ) {
    assistedAlignment = "strongly_worth_investigating";
  } else if (adlHelp && !substantialClinical && profile.cognitiveSupervision !== "substantial") {
    assistedAlignment = "may_be_appropriate";
  } else if (adlHelp && highCognition) {
    assistedAlignment = "could_remain_an_option";
  }

  const memoryWhy = whyFrom(answers, [
    [
      answers.safetyConcerns === "several" || answers.safetyConcerns === "some",
      "Safety or supervision concerns were described, such as getting lost or needing regular cueing",
    ],
    [
      answers.aloneHours === "no" || answers.aloneHours === "rarely",
      "The person cannot reliably remain safely alone for several hours",
    ],
    [
      answers.memoryDaily === "a_lot" || answers.memoryDaily === "some",
      "Memory changes are affecting everyday life",
    ],
    [answers.overnightNeeded === "yes", "Overnight supervision appears to be needed"],
  ]);
  let memoryAlignment: Alignment = "less_aligned";
  if (highCognition && (answers.safetyConcerns === "several" || answers.aloneHours === "no")) {
    memoryAlignment = "strongly_worth_investigating";
  } else if (someCognition && answers.aloneHours !== "yes") {
    memoryAlignment = "may_be_appropriate";
  } else if (answers.memoryDaily === "some") {
    memoryAlignment = "could_remain_an_option";
  }

  const snfSignals = [
    profile.adlAssistance === "substantial",
    substantialClinical,
    profile.mobilitySupport === "substantial",
    answers.overnightNeeded === "yes" && limitedSupport,
    answers.transfers === "fully_dependent" || answers.transfers === "a_lot_of_help",
  ].filter(Boolean).length;
  const snfWhy = whyFrom(answers, [
    [profile.adlAssistance === "substantial", "Substantial help is needed with daily activities"],
    [substantialClinical, "Complex or frequent professional nursing needs were described"],
    [
      answers.transfers === "a_lot_of_help" || answers.transfers === "fully_dependent",
      "Transfers in and out of bed or a chair require major help",
    ],
    [answers.overnightNeeded === "yes", "Overnight supervision is needed"],
    [limitedSupport, "Reliable around-the-clock help at home is limited"],
  ]);
  let snfAlignment: Alignment = "less_aligned";
  if (snfSignals >= 2 && (profile.adlAssistance === "substantial" || substantialClinical)) {
    snfAlignment = "strongly_worth_investigating";
  } else if (snfSignals >= 2) {
    snfAlignment = "may_be_appropriate";
  } else if (profile.adlAssistance === "substantial" || substantialClinical) {
    snfAlignment = homeSupport ? "could_remain_an_option" : "may_be_appropriate";
  }
  if (homeSupport && snfAlignment === "strongly_worth_investigating") {
    snfAlignment = "may_be_appropriate";
  }

  const rehabWhy = whyFrom(answers, [
    [
      answers.recentRecovery === "yes",
      "There is a recent hospitalization, surgery, injury, or illness",
    ],
    [
      answers.therapyNeeds === "intensive",
      "Intensive physical, occupational, or speech therapy is needed",
    ],
    [answers.therapyNeeds === "some", "Some therapy support is needed during recovery"],
    [someClinical, "Temporary skilled nursing support may be part of recovery"],
  ]);
  let rehabAlignment: Alignment = "less_aligned";
  if (answers.recentRecovery === "yes" && answers.therapyNeeds === "intensive") {
    rehabAlignment = "strongly_worth_investigating";
  } else if (answers.recentRecovery === "yes" && answers.therapyNeeds === "some") {
    rehabAlignment = "may_be_appropriate";
  } else if (answers.recentRecovery === "yes") {
    rehabAlignment = "could_remain_an_option";
  }

  if (limitedCertainty) {
    const soften = (alignment: Alignment): Alignment => {
      if (alignment === "strongly_worth_investigating") return "may_be_appropriate";
      if (alignment === "may_be_appropriate") return "could_remain_an_option";
      return alignment;
    };
    agingAlignment = soften(agingAlignment);
    homeCareAlignment = soften(homeCareAlignment);
    homeHealthAlignment = soften(homeHealthAlignment);
    assistedAlignment = soften(assistedAlignment);
    memoryAlignment = soften(memoryAlignment);
    snfAlignment = soften(snfAlignment);
    rehabAlignment = soften(rehabAlignment);
  }

  const recommendations = [
    recommendation(
      "aging_in_place",
      agingAlignment,
      agingWhy.length
        ? agingWhy
        : ["Daily needs appear relatively light based on the answers provided"],
    ),
    recommendation("home_care", homeCareAlignment, homeCareWhy),
    recommendation("home_health", homeHealthAlignment, homeHealthWhy, {
      professionalQuestions: [
        "Could these skilled needs be safely provided through home health?",
        "Would a clinician determine that home-health eligibility and coverage apply?",
      ],
    }),
    recommendation("assisted_living", assistedAlignment, assistedWhy, {
      professionalQuestions: [
        "What level of personal care and medication support would a residential community need to provide?",
      ],
    }),
    recommendation("memory_care", memoryAlignment, memoryWhy, {
      professionalQuestions: [
        "Is memory-related supervision required overnight?",
        "Can this person safely remain in a less structured setting with added support?",
      ],
    }),
    recommendation("skilled_nursing", snfAlignment, snfWhy, {
      professionalQuestions: [
        "Does this person require 24-hour licensed nursing care?",
        "How much assistance is needed with transfers?",
      ],
    }),
    recommendation("short_term_rehab", rehabAlignment, rehabWhy, {
      professionalQuestions: [
        "Is short-term rehabilitation appropriate after this recent illness or procedure?",
      ],
    }),
  ]
    .map((item) => ({
      ...item,
      why: item.why.length
        ? item.why
        : [
            "This setting was compared with the needs you described and did not rise to a primary option.",
          ],
      nextActionHref: item.alignment === "less_aligned" ? null : item.nextActionHref,
    }))
    .sort((left, right) => alignmentRank(left.alignment) - alignmentRank(right.alignment));

  const investigating = recommendations.filter((item) => item.alignment !== "less_aligned");
  const alternatives = [
    homeSupport && snfAlignment !== "less_aligned"
      ? "Remaining at home may still be possible if adequate professional and family support can safely meet these needs."
      : null,
    assistedAlignment !== "less_aligned" && homeCareAlignment !== "less_aligned"
      ? "Assisted living and home care can both be reasonable paths to investigate when daily help is needed but 24-hour skilled nursing is not clearly required."
      : null,
    rehabAlignment !== "less_aligned"
      ? "Short-term rehabilitation is a recovery setting, not automatically a long-term nursing-home placement."
      : null,
  ].filter((value): value is string => Boolean(value));

  const professionalQuestions = [
    ...new Set(investigating.flatMap((item) => item.professionalQuestions)),
    "What level of medication support is necessary?",
    limitedCertainty ? "Which of these needs can a clinician or social worker help clarify?" : null,
  ].filter((value): value is string => Boolean(value));

  const top = investigating[0];
  return {
    version: CARE_NEEDS_NAVIGATOR_VERSION,
    profile,
    headline: "Based on the needs you described, these care settings may be worth investigating.",
    summary: limitedCertainty
      ? "Several answers were marked not sure, so this summary stays cautious and points toward a professional assessment rather than a single setting."
      : top
        ? `${top.title} is among the settings that may be worth discussing with your family and care professionals.`
        : "The answers point to a conversation with a clinician or social worker rather than a specific care setting.",
    recommendations,
    alternatives,
    professionalQuestions,
    showSkilledNursingBridge: snfAlignment !== "less_aligned" || rehabAlignment !== "less_aligned",
    urgentSafetyMessage: profile.urgentSafetyConcern ? URGENT_SAFETY_MESSAGE : null,
    disclaimer: NAVIGATOR_DISCLAIMER,
    limitedCertainty,
  };
}

export const INDEPENDENT_PERSONA: CareNeedsAnswers = {
  bathing: "independent",
  dressing: "independent",
  toileting: "independent",
  eating: "independent",
  transfers: "independent",
  walking: "independent",
  falls: "no",
  memoryDaily: "no",
  safetyConcerns: "none",
  aloneHours: "yes",
  overnightNeeded: "no",
  overnightAvailable: "not_applicable",
  medications: "independent",
  skilledNursing: "none",
  recentRecovery: "no",
  therapyNeeds: "none",
  caregiverHelp: "occasional",
  caregiverStrain: "no",
  livingSituation: "alone",
  immediateSafety: "safe",
};

export const ADL_ASSISTANCE_PERSONA: CareNeedsAnswers = {
  ...INDEPENDENT_PERSONA,
  bathing: "a_lot_of_help",
  dressing: "some_help",
  eating: "some_help",
  medications: "reminders",
  caregiverHelp: "several_hours",
  livingSituation: "with_family",
};

export const MEMORY_SAFETY_PERSONA: CareNeedsAnswers = {
  ...INDEPENDENT_PERSONA,
  bathing: "some_help",
  dressing: "some_help",
  memoryDaily: "a_lot",
  safetyConcerns: "several",
  aloneHours: "no",
  overnightNeeded: "yes",
  overnightAvailable: "no",
  medications: "organize_or_administer",
  caregiverHelp: "occasional",
};

export const SKILLED_MEDICAL_PERSONA: CareNeedsAnswers = {
  bathing: "fully_dependent",
  dressing: "a_lot_of_help",
  toileting: "a_lot_of_help",
  eating: "some_help",
  transfers: "a_lot_of_help",
  walking: "cannot_safely_move",
  falls: "yes",
  memoryDaily: "no",
  safetyConcerns: "none",
  aloneHours: "no",
  overnightNeeded: "yes",
  overnightAvailable: "no",
  medications: "clinical_oversight",
  skilledNursing: "several",
  recentRecovery: "no",
  therapyNeeds: "none",
  caregiverHelp: "little_reliable_help",
  caregiverStrain: "yes",
  livingSituation: "alone",
  immediateSafety: "usually_safe",
};

export const POST_HOSPITAL_REHAB_PERSONA: CareNeedsAnswers = {
  ...INDEPENDENT_PERSONA,
  bathing: "some_help",
  dressing: "some_help",
  transfers: "some_help",
  walking: "walker_or_cane",
  recentRecovery: "yes",
  therapyNeeds: "intensive",
  skilledNursing: "some",
  caregiverHelp: "several_hours",
  livingSituation: "with_family",
};

export const HIGH_NEEDS_HOME_SUPPORT_PERSONA: CareNeedsAnswers = {
  ...SKILLED_MEDICAL_PERSONA,
  caregiverHelp: "most_of_day",
  overnightAvailable: "yes",
  livingSituation: "with_family",
  caregiverStrain: "sometimes",
  immediateSafety: "usually_safe",
};

export const UNCERTAIN_PERSONA: CareNeedsAnswers = {
  bathing: "not_sure",
  dressing: "not_sure",
  toileting: "not_sure",
  eating: "independent",
  transfers: "not_sure",
  walking: "not_sure",
  falls: "not_sure",
  memoryDaily: "not_sure",
  safetyConcerns: "not_sure",
  aloneHours: "not_sure",
  overnightNeeded: "not_sure",
  medications: "not_sure",
  skilledNursing: "not_sure",
  recentRecovery: "not_sure",
  therapyNeeds: "not_sure",
  caregiverHelp: "unsure",
  caregiverStrain: "unsure",
  livingSituation: "not_sure",
  immediateSafety: "not_sure",
};

export function skilledNursingSearchHref(): string {
  return "/search";
}

export function resultHasSetting(
  result: CareNeedsResult,
  setting: CareSetting,
  alignments: Alignment[] = ["strongly_worth_investigating", "may_be_appropriate"],
): boolean {
  return result.recommendations.some(
    (item) => item.setting === setting && alignments.includes(item.alignment),
  );
}
