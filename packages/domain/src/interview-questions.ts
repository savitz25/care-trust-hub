/**
 * Facility Interview Builder v1 — question library.
 *
 * Domain-only catalog. The builder personalizes from care setting, coarse
 * concern tags, and optional published SNF evidence. Copy stays observational:
 * ask about the record; do not accuse, diagnose, or score the facility.
 */

export const INTERVIEW_BUILDER_VERSION = "facility-interview-builder-v1" as const;

export const INTERVIEW_MIN_QUESTIONS = 12;
export const INTERVIEW_MAX_QUESTIONS = 25;
export const INTERVIEW_MAX_MUST_ASK = 8;

export type InterviewCareSetting =
  | "skilled_nursing"
  | "short_term_rehab"
  | "assisted_living"
  | "memory_care"
  | "home_care";

export type InterviewConcernTag =
  | "staffing"
  | "falls"
  | "memory"
  | "medications"
  | "rehab"
  | "communication"
  | "meals"
  | "cost"
  | "inspections"
  | "ownership"
  | "personal_care"
  | "activities";

export type InterviewQuestionPriority = "MUST_ASK" | "IMPORTANT" | "OPTIONAL";

export type InterviewQuestionCategory =
  | "staffing"
  | "safety"
  | "memory"
  | "skilled_nursing"
  | "rehab"
  | "medications"
  | "meals"
  | "personal_care"
  | "activities"
  | "family_communication"
  | "inspections"
  | "ownership"
  | "pricing";

export type FacilityEvidenceTrigger =
  | "staffing_decline"
  | "low_staffing_rating"
  | "recent_inspection"
  | "recent_penalty"
  | "ownership_change"
  | "multi_facility_org"
  | "state_enforcement"
  | "explicit_memory_designation"
  | "ca_probation";

export type InterviewEvidencePathHint =
  | "staffing"
  | "inspections"
  | "penalties"
  | "history"
  | "ownership"
  | "state";

export interface InterviewQuestionDefinition {
  readonly id: string;
  readonly careSettings: readonly InterviewCareSetting[];
  readonly category: InterviewQuestionCategory;
  readonly text: string;
  readonly whyAsk: string;
  readonly followUp?: string;
  readonly triggerTags: readonly InterviewConcernTag[];
  readonly defaultPriority: InterviewQuestionPriority;
  readonly evidenceTrigger?: FacilityEvidenceTrigger;
  readonly evidencePathHint?: InterviewEvidencePathHint;
  readonly evidenceSummaryTemplate?: string;
}

const ALL_RESIDENTIAL: readonly InterviewCareSetting[] = [
  "skilled_nursing",
  "short_term_rehab",
  "assisted_living",
  "memory_care",
];

const SNF_AND_REHAB: readonly InterviewCareSetting[] = ["skilled_nursing", "short_term_rehab"];

const ALL_SETTINGS: readonly InterviewCareSetting[] = [
  "skilled_nursing",
  "short_term_rehab",
  "assisted_living",
  "memory_care",
  "home_care",
];

/**
 * General + facility-evidence question catalog.
 * Facility-specific rows set `evidenceTrigger` and are SNF-only.
 */
export const INTERVIEW_QUESTION_LIBRARY: readonly InterviewQuestionDefinition[] = [
  {
    id: "staff-who-knows-the-person",
    careSettings: ALL_SETTINGS,
    category: "staffing",
    text: "Who will actually provide day-to-day care, and how do you keep the same people assigned when you can?",
    whyAsk: "Consistent caregivers notice changes sooner and make daily care less confusing.",
    followUp: "What happens on nights, weekends, and when someone calls out?",
    triggerTags: ["staffing"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "staff-night-weekend-coverage",
    careSettings: ALL_RESIDENTIAL,
    category: "staffing",
    text: "How do you cover nights, weekends, and call-outs without leaving residents waiting?",
    whyAsk: "Coverage gaps often show up after regular weekday hours, not during a scheduled tour.",
    triggerTags: ["staffing"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "staff-how-to-reach-nurse",
    careSettings: SNF_AND_REHAB,
    category: "staffing",
    text: "How do families reach a nurse when something changes after hours?",
    whyAsk: "A clear after-hours path matters more than a weekday greeting at the front desk.",
    triggerTags: ["staffing", "communication"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "staff-agency-use",
    careSettings: ALL_RESIDENTIAL,
    category: "staffing",
    text: "How often do you use temporary or agency staff, and how do you introduce them to residents?",
    whyAsk:
      "Temporary staffing can be necessary, but families should know how continuity is protected.",
    triggerTags: ["staffing"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "safety-fall-response",
    careSettings: ALL_RESIDENTIAL,
    category: "safety",
    text: "If someone falls, what happens in the first hour, and how is the family notified?",
    whyAsk:
      "Fall response and notification habits are easier to judge from a process than from a promise.",
    followUp: "Can we see how you document what happened and what changed afterward?",
    triggerTags: ["falls", "communication"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "safety-call-light",
    careSettings: ALL_RESIDENTIAL,
    category: "safety",
    text: "How long does it typically take staff to answer a call light or request for help?",
    whyAsk: "Response time is one of the clearest windows into everyday staffing and safety.",
    triggerTags: ["staffing", "falls"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "safety-wander-support",
    careSettings: ["memory_care", "skilled_nursing", "assisted_living"],
    category: "safety",
    text: "How do you support someone who may walk, exit-seek, or become disoriented, without defaulting to restraints?",
    whyAsk: "Safe wandering support is a process question, not a diagnosis question.",
    triggerTags: ["memory", "falls"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "memory-daily-routine",
    careSettings: ["memory_care", "skilled_nursing", "assisted_living"],
    category: "memory",
    text: "How do you learn a person’s daily routine and keep it consistent across shifts?",
    whyAsk: "Routine consistency often matters more than a special activity calendar.",
    triggerTags: ["memory", "personal_care"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "memory-distress-response",
    careSettings: ["memory_care", "skilled_nursing"],
    category: "memory",
    text: "When someone is frightened, restless, or refusing care, what do staff try first?",
    whyAsk: "The first response to distress says more about training than a brochure does.",
    triggerTags: ["memory"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "snf-care-plan-meeting",
    careSettings: SNF_AND_REHAB,
    category: "skilled_nursing",
    text: "When is the care-plan meeting, who is in the room, and how can a family member join?",
    whyAsk:
      "The care-plan meeting is where goals, therapy, and discharge timing are supposed to be decided.",
    triggerTags: ["communication"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "snf-change-in-condition",
    careSettings: SNF_AND_REHAB,
    category: "skilled_nursing",
    text: "If a resident’s condition changes, who notices, who decides next steps, and how quickly is the family told?",
    whyAsk: "Change-in-condition response is one of the most important skilled-nursing questions.",
    triggerTags: ["communication", "staffing"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "snf-hospital-transfer",
    careSettings: SNF_AND_REHAB,
    category: "skilled_nursing",
    text: "When do you send someone to the hospital, and how do you decide they are ready to come back?",
    whyAsk: "Transfer decisions affect both safety and Medicare coverage timing.",
    triggerTags: ["communication"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "rehab-therapy-schedule",
    careSettings: ["short_term_rehab", "skilled_nursing"],
    category: "rehab",
    text: "What would a typical therapy week look like, and who covers sessions if a therapist is out?",
    whyAsk: "Rehab intensity and backup coverage determine whether stated goals are realistic.",
    triggerTags: ["rehab"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "rehab-discharge-plan",
    careSettings: ["short_term_rehab", "skilled_nursing"],
    category: "rehab",
    text: "How do you decide someone is ready to go home, and what support is arranged before discharge?",
    whyAsk: "A discharge date without a home plan is a common source of last-minute stress.",
    followUp: "Who teaches the family the transfer, wound, or medication steps before that day?",
    triggerTags: ["rehab", "communication"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "rehab-progress-updates",
    careSettings: ["short_term_rehab", "skilled_nursing"],
    category: "rehab",
    text: "How will we hear about therapy progress if we cannot attend every session?",
    whyAsk: "Families often need a regular update path, not only a discharge packet.",
    triggerTags: ["rehab", "communication"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "meds-who-administers",
    careSettings: ALL_SETTINGS,
    category: "medications",
    text: "Who administers medications, and how are new orders or pharmacy delays handled?",
    whyAsk:
      "Medication timing errors often come from handoffs, not from the original prescription.",
    triggerTags: ["medications"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "meds-review-schedule",
    careSettings: ALL_RESIDENTIAL,
    category: "medications",
    text: "How often is the medication list reviewed, and who can a family member ask if something looks unfamiliar?",
    whyAsk: "A regular review is how duplicate or leftover hospital medications get caught.",
    triggerTags: ["medications"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "meds-pain-and-sleep",
    careSettings: ALL_RESIDENTIAL,
    category: "medications",
    text: "How do you handle pain, sleep, or anxiety medications so the person is not overly sedated?",
    whyAsk: "This is a process question about monitoring — not a request for a diagnosis.",
    triggerTags: ["medications", "memory"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "meals-special-diets",
    careSettings: ALL_RESIDENTIAL,
    category: "meals",
    text: "How do you handle special diets, texture changes, and help at mealtime?",
    whyAsk: "Mealtime help is daily care, not an extra amenity.",
    triggerTags: ["meals", "personal_care"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "meals-see-a-meal",
    careSettings: ALL_RESIDENTIAL,
    category: "meals",
    text: "Can we see a meal being served, not just the menu?",
    whyAsk:
      "Watching a meal shows staffing, assistance, and whether food matches what was described.",
    triggerTags: ["meals"],
    defaultPriority: "OPTIONAL",
  },
  {
    id: "care-bathing-dressing",
    careSettings: ALL_RESIDENTIAL,
    category: "personal_care",
    text: "How do you handle bathing, dressing, and toileting when someone needs more help than they used to?",
    whyAsk: "Personal-care staffing is where advertised services and daily reality can diverge.",
    triggerTags: ["personal_care"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "care-supplies-and-laundry",
    careSettings: ALL_RESIDENTIAL,
    category: "personal_care",
    text: "What supplies, laundry, and personal items are included, and what do families need to provide?",
    whyAsk:
      "Small daily items become recurring costs and a source of friction if they are unclear.",
    triggerTags: ["personal_care", "cost"],
    defaultPriority: "OPTIONAL",
  },
  {
    id: "activities-meaningful",
    careSettings: ALL_RESIDENTIAL,
    category: "activities",
    text: "How do you learn what a person actually enjoys, rather than only offering a group calendar?",
    whyAsk: "A posted calendar does not tell you whether quieter or one-to-one options exist.",
    triggerTags: ["activities", "memory"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "comm-who-to-call",
    careSettings: ALL_SETTINGS,
    category: "family_communication",
    text: "Who is our day-to-day contact, and what is the expected response time if we leave a message?",
    whyAsk:
      "A named contact with a real response window is more useful than an open invitation to call anytime.",
    triggerTags: ["communication"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "comm-care-plan-changes",
    careSettings: ALL_RESIDENTIAL,
    category: "family_communication",
    text: "How are families told when the care plan, room, roommate, or attending clinician changes?",
    whyAsk: "Unannounced changes are a common source of lost trust.",
    triggerTags: ["communication"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "inspect-recent-survey",
    careSettings: SNF_AND_REHAB,
    category: "inspections",
    text: "What came up on your most recent inspection or complaint investigation, and what did you change afterward?",
    whyAsk: "Inspection history is public. The useful question is what the facility did next.",
    triggerTags: ["inspections"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "inspect-how-to-raise-concern",
    careSettings: ALL_RESIDENTIAL,
    category: "inspections",
    text: "If a family has a concern, what is the internal process, and who is the outside complaint path?",
    whyAsk: "A provider that can explain both paths is usually more transparent about problems.",
    triggerTags: ["inspections", "communication"],
    defaultPriority: "OPTIONAL",
  },
  {
    id: "own-who-operates",
    careSettings: ALL_RESIDENTIAL,
    category: "ownership",
    text: "Who owns this community, who holds the license, and who actually manages day-to-day operations?",
    whyAsk: "Owner, licensee, and on-site manager are not always the same organization.",
    triggerTags: ["ownership"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "own-recent-change",
    careSettings: ALL_RESIDENTIAL,
    category: "ownership",
    text: "Has ownership, the management company, or the administrator changed recently, and what stayed the same for residents?",
    whyAsk:
      "Transitions can be orderly. Families should hear what was protected during the change.",
    triggerTags: ["ownership"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "price-what-is-included",
    careSettings: ALL_SETTINGS,
    category: "pricing",
    text: "What is included in the quoted rate, and which common services are billed separately?",
    whyAsk: "The first number is rarely the whole monthly cost.",
    followUp:
      "Please walk through medication management, incontinence supplies, and after-hours care.",
    triggerTags: ["cost"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "price-level-of-care-increase",
    careSettings: ["assisted_living", "memory_care"],
    category: "pricing",
    text: "If care needs increase, how does the rate change, and how much notice do families get?",
    whyAsk:
      "Level-of-care increases are one of the most common surprise costs in residential care.",
    triggerTags: ["cost", "personal_care"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "price-community-fee-refund",
    careSettings: ["assisted_living", "memory_care"],
    category: "pricing",
    text: "Is there a community or entrance fee, and what is refundable if the stay is short?",
    whyAsk: "Entrance fees and notice periods can matter as much as the monthly rate.",
    triggerTags: ["cost"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "price-medicare-snf-days",
    careSettings: SNF_AND_REHAB,
    category: "pricing",
    text: "If Medicare is paying for this stay, who tracks benefit days, and how will we know when coverage may change?",
    whyAsk: "Medicare skilled-nursing coverage is time-limited and can change with the care plan.",
    triggerTags: ["cost", "rehab"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "price-private-pay-after-medicare",
    careSettings: SNF_AND_REHAB,
    category: "pricing",
    text: "If the stay continues after Medicare coverage ends, what is the private-pay rate and what notice will we get?",
    whyAsk:
      "The handoff from Medicare to private pay is where families most often feel unprepared.",
    triggerTags: ["cost"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "al-when-this-is-not-enough",
    careSettings: ["assisted_living", "memory_care"],
    category: "personal_care",
    text: "What needs would mean this community is no longer the right setting, and how do you help with that transition?",
    whyAsk: "Every residential setting has a limit. It is better to hear it before a crisis.",
    triggerTags: ["personal_care", "memory"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "al-nurse-availability",
    careSettings: ["assisted_living", "memory_care"],
    category: "staffing",
    text: "Is a nurse on site, on call, or available only during weekday hours?",
    whyAsk:
      "Assisted living and memory care nursing coverage varies widely by community and state.",
    triggerTags: ["staffing", "medications"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "al-medication-reminders-vs-admin",
    careSettings: ["assisted_living", "memory_care"],
    category: "medications",
    text: "Do staff remind, assist, or actually administer medications — and is that included in the rate?",
    whyAsk: "Those three levels of help are not the same service and are not priced the same.",
    triggerTags: ["medications", "cost"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "mc-secure-outdoor",
    careSettings: ["memory_care"],
    category: "safety",
    text: "How do residents get outdoors safely, and what happens if someone is looking for an exit?",
    whyAsk: "A locked door is not the same thing as a plan for movement, daylight, and distress.",
    triggerTags: ["memory", "falls"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "mc-staff-training",
    careSettings: ["memory_care"],
    category: "memory",
    text: "What dementia-specific training do new staff receive before they work independently, and how often is it refreshed?",
    whyAsk: "Training on paper and training before a first solo shift are different things.",
    triggerTags: ["memory", "staffing"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "home-who-comes",
    careSettings: ["home_care"],
    category: "staffing",
    text: "Who will come into the home, how are they screened, and what happens if that person is unavailable?",
    whyAsk: "Home care quality is mostly about the specific people who arrive and the backup plan.",
    followUp: "Can we meet the regular caregiver before the first shift?",
    triggerTags: ["staffing"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "home-supervisor-visits",
    careSettings: ["home_care"],
    category: "staffing",
    text: "How often does a supervisor visit or call to check that the plan is being followed?",
    whyAsk: "A written plan without supervision is only a schedule.",
    triggerTags: ["staffing", "communication"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "home-scope-and-limits",
    careSettings: ["home_care"],
    category: "personal_care",
    text: "What can aides do, what requires a nurse, and what is outside the agency’s scope?",
    whyAsk:
      "Home-care agencies vary in whether they can handle medications, transfers, or medical tasks.",
    triggerTags: ["personal_care", "medications"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "home-cancellation-backup",
    careSettings: ["home_care"],
    category: "staffing",
    text: "If a shift is cancelled or a caregiver does not arrive, how quickly do you send a replacement?",
    whyAsk: "Missed home-care shifts fall entirely on the family if there is no backup.",
    triggerTags: ["staffing"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "home-license-and-insurance",
    careSettings: ["home_care"],
    category: "ownership",
    text: "Are you licensed in this state, bonded, and insured — and can we see that documentation?",
    whyAsk:
      "SeniorTrustHub does not operate a verified national home-care directory. Ask the agency to show its own credentials.",
    triggerTags: ["ownership", "inspections"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "home-hourly-overtime-minimum",
    careSettings: ["home_care"],
    category: "pricing",
    text: "What is the hourly rate, the minimum shift length, weekend or holiday differentials, and overtime rule?",
    whyAsk: "Home-care quotes often omit minimum hours and weekend differentials.",
    triggerTags: ["cost"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "home-who-to-call-problem",
    careSettings: ["home_care"],
    category: "family_communication",
    text: "If something is wrong in the home — a no-show, a boundary issue, or a care concern — who do we call immediately?",
    whyAsk: "Home care has no front desk. The after-hours number has to work.",
    triggerTags: ["communication"],
    defaultPriority: "MUST_ASK",
  },
  {
    id: "home-plan-of-care",
    careSettings: ["home_care"],
    category: "personal_care",
    text: "Who writes the plan of care, how often is it updated, and can we get a written copy?",
    whyAsk:
      "A written plan is how families and substitutes stay aligned when the regular caregiver is out.",
    triggerTags: ["personal_care", "communication"],
    defaultPriority: "IMPORTANT",
  },
  {
    id: "home-needs-increase",
    careSettings: ["home_care"],
    category: "personal_care",
    text: "If needs increase — more hours, two-person transfers, or nurse visits — how do you reassess and what changes in price?",
    whyAsk:
      "Home-care plans often start light and grow. Families should hear how that change is handled.",
    triggerTags: ["personal_care", "cost"],
    defaultPriority: "IMPORTANT",
  },

  {
    id: "ev-staffing-decline",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "staffing",
    text: "What contributed to that staffing change, and how do you cover nights, weekends, and call-outs now?",
    whyAsk: "Staffing levels can change over time.",
    triggerTags: ["staffing"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "staffing_decline",
    evidencePathHint: "staffing",
    evidenceSummaryTemplate:
      "CMS data shows nurse staffing declined in the latest reported period.",
  },
  {
    id: "ev-low-staffing-rating",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "staffing",
    text: "CMS reports a lower staffing rating for this facility. How do you staff each shift, and what should a family watch for during a tour?",
    whyAsk:
      "A staffing rating is a reported snapshot. The useful question is how the building is staffed day to day.",
    triggerTags: ["staffing"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "low_staffing_rating",
    evidencePathHint: "staffing",
    evidenceSummaryTemplate:
      "The published CMS staffing rating for this facility is in the lower range.",
  },
  {
    id: "ev-recent-inspection",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "inspections",
    text: "This facility’s public record includes recent inspection findings. What was cited, and what did you change afterward?",
    whyAsk: "Inspection findings are a reason to ask what improved — not a verdict by themselves.",
    triggerTags: ["inspections"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "recent_inspection",
    evidencePathHint: "inspections",
    evidenceSummaryTemplate: "The published facility record includes recent inspection findings.",
  },
  {
    id: "ev-recent-penalty",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "inspections",
    text: "CMS reports a recent penalty on this facility’s public record. What was it for, and what is different now?",
    whyAsk:
      "A penalty is public information. The follow-up is what the facility says it corrected.",
    triggerTags: ["inspections"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "recent_penalty",
    evidencePathHint: "penalties",
    evidenceSummaryTemplate: "The published CMS record includes a recent penalty.",
  },
  {
    id: "ev-ownership-change",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "ownership",
    text: "The public record shows an ownership or operator change. What stayed the same for residents, and who is accountable on site now?",
    whyAsk: "Ownership changes are common. Families should hear who runs the building today.",
    triggerTags: ["ownership"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "ownership_change",
    evidencePathHint: "ownership",
    evidenceSummaryTemplate: "The published record shows a recent ownership or operator change.",
  },
  {
    id: "ev-multi-facility-org",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "ownership",
    text: "This facility is part of a larger organization. Which decisions are made here, and which come from the parent organization?",
    whyAsk:
      "Multi-facility organizations can share resources — and can also move decisions off site.",
    triggerTags: ["ownership"],
    defaultPriority: "IMPORTANT",
    evidenceTrigger: "multi_facility_org",
    evidencePathHint: "ownership",
    evidenceSummaryTemplate:
      "Published ownership data links this facility to a larger organization.",
  },
  {
    id: "ev-state-enforcement",
    careSettings: ["skilled_nursing", "short_term_rehab"],
    category: "inspections",
    text: "The published state record includes an enforcement or complaint-inspection event. What happened, and what did you change afterward?",
    whyAsk: "State records can add context beyond the federal inspection cycle.",
    triggerTags: ["inspections"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "state_enforcement",
    evidencePathHint: "state",
    evidenceSummaryTemplate:
      "A published state record includes an enforcement or complaint-inspection event.",
  },
  {
    id: "al-explicit-memory",
    careSettings: ["assisted_living", "memory_care"],
    category: "memory",
    text: "The regulator identifies this provider with a dementia/memory-care designation. Ask what staffing, training, supervision, and secured-care practices apply to residents receiving that service.",
    whyAsk:
      "An official memory designation is not the same as a quality score. Ask how the service is actually delivered.",
    triggerTags: ["memory"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "explicit_memory_designation",
    evidencePathHint: "state",
    evidenceSummaryTemplate: "The regulator publishes an explicit memory or dementia designation.",
  },
  {
    id: "al-ca-probation",
    careSettings: ["assisted_living", "memory_care"],
    category: "inspections",
    text: "The regulator currently lists this facility as On Probation. Ask what led to that status, what corrective actions are required, and how families can review the regulator's current information.",
    whyAsk:
      "Probation is an official California licensing status. It is not a SeniorTrustHub rating.",
    triggerTags: ["inspections"],
    defaultPriority: "MUST_ASK",
    evidenceTrigger: "ca_probation",
    evidencePathHint: "state",
    evidenceSummaryTemplate: "California currently lists this facility as On Probation.",
  },
];

export function isInterviewCareSetting(value: string): value is InterviewCareSetting {
  return (
    value === "skilled_nursing" ||
    value === "short_term_rehab" ||
    value === "assisted_living" ||
    value === "memory_care" ||
    value === "home_care"
  );
}

export function isInterviewConcernTag(value: string): value is InterviewConcernTag {
  return (
    value === "staffing" ||
    value === "falls" ||
    value === "memory" ||
    value === "medications" ||
    value === "rehab" ||
    value === "communication" ||
    value === "meals" ||
    value === "cost" ||
    value === "inspections" ||
    value === "ownership" ||
    value === "personal_care" ||
    value === "activities"
  );
}
