export const CMS_PROVIDER_INFORMATION_SOURCE = {
  datasetKey: "nursing-home-provider-information",
  organization: "Centers for Medicare & Medicaid Services",
  datasetName: "Nursing Home Provider Information",
  datasetIdentifier: "4pq5-n9py",
} as const;

export const CMS_REGULATORY_SOURCES = {
  inspections: {
    datasetKey: "nursing-home-inspection-dates",
    datasetName: "Inspection Dates",
    datasetIdentifier: "svdt-c123",
  },
  deficiencies: {
    datasetKey: "nursing-home-health-deficiencies",
    datasetName: "Health Deficiencies",
    datasetIdentifier: "r5ix-sfxw",
  },
  penalties: {
    datasetKey: "nursing-home-penalties",
    datasetName: "Penalties",
    datasetIdentifier: "g6vv-u9sr",
  },
} as const;

export const CMS_MDS_QUALITY_SOURCE = {
  datasetKey: "nursing-home-mds-quality-measures",
  organization: "Centers for Medicare & Medicaid Services",
  datasetName: "MDS Quality Measures",
  datasetIdentifier: "djen-97ju",
} as const;

export const CMS_FIRE_SAFETY_SOURCE = {
  datasetKey: "nursing-home-fire-safety-deficiencies",
  organization: "Centers for Medicare & Medicaid Services",
  datasetName: "Fire Safety Deficiencies",
  datasetIdentifier: "ifjz-ge4w",
} as const;

export const CMS_PBJ_NURSE_SOURCE = {
  datasetKey: "payroll-based-journal-daily-nurse-staffing",
  organization: "Centers for Medicare & Medicaid Services",
  datasetName: "Payroll Based Journal Daily Nurse Staffing",
  datasetIdentifier: "7e0d53ba-8f02-4c66-98a5-14a1c997c50d",
  officialUrl: "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
} as const;
