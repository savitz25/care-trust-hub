export const SENIOR_ASK_CAPABILITY_MANIFEST = {
  hubId: "senior",
  askExecution: "live",
  identifierLookup: {
    ccn: "live_labeled",
    bareDigits: "fail_closed_ambiguous",
  },
  providerClasses: ["nursing_home", "home_health", "hospice"] as const,
  geography: {
    national: true,
    state: true,
    county: {
      nursing_home: "provider_address_county",
      home_health: "unsupported_office_county_not_queried",
      hospice: "office_county_on_snapshot_not_wired_in_ask_v1",
    },
  },
  evidence: {
    nursing_home: [
      "cms_overall_stars",
      "staffing_stars",
      "inspection_stars",
      "deficiencies",
      "penalties",
      "ownership",
      "chow",
      "pbj_hprd",
    ],
    home_health: ["quality_of_patient_care_stars", "hhcahps", "ownership_presence"],
    hospice: ["cahps", "hospice_quality_presence"],
  },
  publicAskRoute: "/ask",
  publicAskApi: "/api/ask",
  contract: "senior-ask-v1",
  limitations: [
    "Hospice has no overall CMS star.",
    "Home Health / Hospice CHOW unsupported.",
    "No combined senior-provider count.",
    "No proprietary ranking or Trust Score.",
    "County geography is provider location/address, not service area.",
  ],
} as const;
