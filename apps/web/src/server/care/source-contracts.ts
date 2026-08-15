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
