import type { SpecialistSearchCapability } from "./contract";

export const SENIOR_SEARCH_CAPABILITIES: SpecialistSearchCapability[] = [
  {
    key: "nursing-home-directory",
    label: "CMS Nursing Home directory",
    supportState: "KNOWN",
    coverage: "Current acquired CMS nursing-home cohort",
    sourceSystems: ["CMS Care Compare"],
    limitations: ["CCN is class-scoped; directory status is not endorsement."],
  },
  {
    key: "home-health-directory",
    label: "CMS Home Health directory",
    supportState: "KNOWN",
    coverage: "Current acquired Home Health cohort",
    sourceSystems: ["CMS Care Compare"],
    limitations: ["Office location is not service territory."],
  },
  {
    key: "hospice-directory",
    label: "CMS Hospice directory",
    supportState: "KNOWN",
    coverage: "Current acquired Hospice cohort",
    sourceSystems: ["CMS Care Compare"],
    limitations: ["Hospice has no nursing-home-equivalent overall CMS star."],
  },
  {
    key: "nursing-home-evidence",
    label: "Nursing-home evidence",
    supportState: "KNOWN",
    coverage:
      "Indexed inspections, deficiencies, penalties, staffing, ownership and CHOW where linked",
    sourceSystems: ["CMS Care Compare"],
    limitations: ["Evidence families are not combined into a score."],
  },
  {
    key: "agency-experience",
    label: "HHCAHPS / Hospice CAHPS",
    supportState: "PARTIAL",
    coverage: "Indexed measures where present",
    sourceSystems: ["CMS Care Compare"],
    limitations: ["Missing observations are unknown, not zero."],
  },
  {
    key: "agency-chow",
    label: "Home Health / Hospice CHOW",
    supportState: "NOT_ACQUIRED",
    coverage: "No comparable current publication contract",
    sourceSystems: [],
    limitations: ["Nursing-home CHOW is not generalized across classes."],
  },
  {
    key: "assisted-living",
    label: "Assisted living",
    supportState: "PARTIAL",
    coverage: "State-specific research only",
    sourceSystems: ["State licensing agencies"],
    limitations: ["No combined national assisted-living universe."],
  },
  {
    key: "service-territory",
    label: "Verified service territory",
    supportState: "UNSUPPORTED",
    coverage: "Provider/office address only",
    sourceSystems: [],
    limitations: ["Address and ZIP do not establish service area."],
  },
];
