import type { CareNeedsAnswers } from "@care/domain";

export const QUESTION_STEPS = [
  {
    id: "daily",
    title: "Daily activities",
    blurb: "How much help is needed with everyday personal care?",
  },
  {
    id: "mobility",
    title: "Mobility and safety",
    blurb: "How does this person move around, and is falling a concern?",
  },
  {
    id: "memory",
    title: "Memory and supervision",
    blurb: "These questions are about everyday safety, not a diagnosis.",
  },
  {
    id: "medical",
    title: "Medical and rehabilitation needs",
    blurb: "Describe known care requirements. Choose Not sure rather than guessing.",
  },
  {
    id: "support",
    title: "Caregiver support",
    blurb: "The same needs can lead to different options depending on who can help.",
  },
] as const;

export interface NavigatorQuestion {
  id: keyof CareNeedsAnswers;
  step: (typeof QUESTION_STEPS)[number]["id"];
  prompt: string;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
  showWhen?: (answers: CareNeedsAnswers) => boolean;
}

const assistance = [
  { value: "independent", label: "Independent" },
  { value: "some_help", label: "Some help" },
  { value: "a_lot_of_help", label: "A lot of help" },
  { value: "fully_dependent", label: "Fully dependent" },
  { value: "not_sure", label: "Not sure" },
];

export const NAVIGATOR_QUESTIONS: NavigatorQuestion[] = [
  { id: "bathing", step: "daily", prompt: "Bathing or showering", options: assistance },
  { id: "dressing", step: "daily", prompt: "Dressing", options: assistance },
  { id: "toileting", step: "daily", prompt: "Toileting", options: assistance },
  { id: "eating", step: "daily", prompt: "Eating", options: assistance },
  {
    id: "transfers",
    step: "daily",
    prompt: "Getting in or out of bed or a chair",
    options: assistance,
  },
  {
    id: "walking",
    step: "mobility",
    prompt: "Walking and getting around",
    options: [
      { value: "independent", label: "Walks independently" },
      { value: "walker_or_cane", label: "Uses a walker or cane" },
      { value: "wheelchair", label: "Uses a wheelchair most of the time" },
      { value: "cannot_safely_move", label: "Cannot safely move without help" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "falls",
    step: "mobility",
    prompt: "Have there been recent falls, or is falling a high concern?",
    options: [
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
      { value: "yes", label: "Yes" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "memoryDaily",
    step: "memory",
    prompt:
      "Do memory changes affect everyday life, such as meals, medications, or finding familiar places?",
    options: [
      { value: "no", label: "No" },
      { value: "some", label: "Some" },
      { value: "a_lot", label: "A lot" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "safetyConcerns",
    step: "memory",
    prompt:
      "Are there safety concerns such as getting lost, leaving unexpectedly, or using appliances unsafely?",
    options: [
      { value: "none", label: "No" },
      { value: "some", label: "Some of these" },
      { value: "several", label: "Several of these" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "aloneHours",
    step: "memory",
    prompt: "Can this person safely be alone for several hours?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "usually", label: "Usually" },
      { value: "rarely", label: "Rarely" },
      { value: "no", label: "No" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "overnightNeeded",
    step: "memory",
    prompt: "Is overnight supervision needed?",
    options: [
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
      { value: "yes", label: "Yes" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "overnightAvailable",
    step: "memory",
    prompt: "Is someone available to provide that overnight supervision?",
    showWhen: (answers) =>
      answers.overnightNeeded === "yes" || answers.overnightNeeded === "sometimes",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "medications",
    step: "medical",
    prompt: "How are medications managed?",
    options: [
      { value: "independent", label: "Manages medications independently" },
      { value: "reminders", label: "Needs reminders" },
      { value: "organize_or_administer", label: "Needs someone to organize or give medications" },
      { value: "clinical_oversight", label: "Needs clinical oversight for complex medications" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "skilledNursing",
    step: "medical",
    prompt:
      "Does this person currently need professional nursing help such as wound care, injections, IV therapy, a feeding tube, a catheter, or frequent clinical monitoring?",
    options: [
      { value: "none", label: "No" },
      { value: "some", label: "Some of these" },
      { value: "several", label: "Several of these" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "recentRecovery",
    step: "medical",
    prompt:
      "Is the person recovering from a recent hospitalization, surgery, stroke, fracture, or serious illness?",
    options: [
      { value: "no", label: "No" },
      { value: "yes", label: "Yes" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "therapyNeeds",
    step: "medical",
    prompt: "Is intensive physical, occupational, or speech therapy needed right now?",
    options: [
      { value: "none", label: "No" },
      { value: "some", label: "Some therapy" },
      { value: "intensive", label: "Intensive therapy" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "caregiverHelp",
    step: "support",
    prompt: "How much reliable help is currently available?",
    options: [
      { value: "most_of_day", label: "Someone is available most of the day" },
      { value: "several_hours", label: "Help is available several hours per day" },
      { value: "occasional", label: "Occasional help only" },
      {
        value: "little_reliable_help",
        label: "The person lives alone or has little reliable help",
      },
      { value: "unsure", label: "Family is unsure" },
    ],
  },
  {
    id: "caregiverStrain",
    step: "support",
    prompt:
      "Is the current care arrangement becoming difficult for family or caregivers to sustain?",
    optional: true,
    options: [
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
      { value: "yes", label: "Yes" },
      { value: "unsure", label: "Unsure" },
    ],
  },
  {
    id: "livingSituation",
    step: "support",
    prompt: "Where does this person live now?",
    options: [
      { value: "alone", label: "Lives alone" },
      { value: "with_family", label: "Lives with family" },
      { value: "senior_community", label: "Lives in a senior community" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
  {
    id: "immediateSafety",
    step: "support",
    prompt: "Can this person currently be kept safe in their living situation?",
    options: [
      { value: "safe", label: "Yes" },
      { value: "usually_safe", label: "Usually" },
      { value: "immediate_concern", label: "No — there is an immediate safety concern" },
      { value: "not_sure", label: "Not sure" },
    ],
  },
];

export const REQUIRED_NAVIGATOR_QUESTION_COUNT = NAVIGATOR_QUESTIONS.filter(
  (question) => !question.optional && !question.showWhen,
).length;
