/** Generated from artifacts/ca-sen-001-public-snapshot.json. Do not edit by hand. */
export const CA_PUBLIC_SNAPSHOT = {
  version: "senior-ca-state-intel-v1",
  asOf: "2026-09-03",
  retrievedAt: "2026-09-03T18:02:21Z",
  elms: {
    source_name: "CDPH Licensed and Certified Healthcare Facility Locations (ELMS)",
    source_url: "https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
    source_agency: "California Department of Public Health \u2014 Center for Health Care Quality",
    source_as_of: "2026-08-17",
    retrieved_at: "2026-09-03T18:02:21Z",
    source_file_hash: "60b2268223a60fd0fc7a55dd86cced0bced5010593c2f76f0cc9767f02026e6b",
    source_row_count: 15097,
    row_grain: "licensed/certified healthcare facility location (FACID)",
    identifier_fields: ["FACID", "CCN", "LICENSE_NUMBER", "HCAI_ID", "NPI", "ASPEN_FACID"],
    status_fields: ["LICENSE_STATUS_DESCRIPTION", "FAC_STATUS_TYPE_CODE"],
    contact_fields: {
      phone: {
        field: "CONTACT_PHONE_NUMBER",
        present: 13560,
        eligible: "PUBLIC_ELIGIBLE",
        note: "Facility contact from California state record. Not an administrator personal directory.",
      },
      email: {
        field: "CONTACT_EMAIL",
        present: 12435,
        eligible: "PUBLIC_ELIGIBLE",
        note: "Official CONTACT_EMAIL. Administrator names are not published.",
      },
      address: {
        field: "ADDRESS",
        present: 15097,
        eligible: "PUBLIC_ELIGIBLE",
      },
      website: {
        field: null,
        present: 0,
        eligible: "INTERNAL_ONLY",
      },
    },
    geography_fields: ["CITY", "ZIP", "COUNTY_NAME", "FIPS_COUNTY_CODE"],
    publication_eligibility: "PUBLIC_STATE_PAGE",
    byType: [
      {
        label: "HOME HEALTH AGENCY",
        count: 4137,
      },
      {
        label: "PRIMARY CARE CLINIC",
        count: 3349,
      },
      {
        label: "HOSPICE",
        count: 2114,
      },
      {
        label: "SKILLED NURSING FACILITY",
        count: 1186,
      },
      {
        label: "SURGICAL CLINIC",
        count: 1011,
      },
      {
        label: "INTERMEDIATE CARE FACILITY-DD/H/N/CN/IID",
        count: 968,
      },
      {
        label: "CHRONIC DIALYSIS CLINIC",
        count: 748,
      },
      {
        label: "GENERAL ACUTE CARE HOSPITAL",
        count: 433,
      },
      {
        label: "ADULT DAY HEALTH CARE",
        count: 341,
      },
      {
        label: "CONGREGATE LIVING HEALTH FACILITY",
        count: 281,
      },
      {
        label: "OTHER",
        count: 201,
      },
      {
        label: "ACUTE PSYCHIATRIC HOSPITAL",
        count: 124,
      },
      {
        label: "REHABILITATION CLINIC",
        count: 83,
      },
      {
        label: "PSYCHOLOGY CLINIC",
        count: 33,
      },
      {
        label: "PEDIATRIC DAY HEALTH & RESPITE CARE FACILITY",
        count: 28,
      },
      {
        label: "CORRECTIONAL TREATMENT CENTER",
        count: 20,
      },
      {
        label: "HOSPICE FACILITY",
        count: 14,
      },
      {
        label: "CHEMICAL DEPENDENCY RECOVERY HOSPITAL",
        count: 10,
      },
      {
        label: "INTERMEDIATE CARE FACILITY",
        count: 7,
      },
      {
        label: "ALTERNATIVE BIRTHING CENTER",
        count: 5,
      },
      {
        label: "REFERRAL AGENCY",
        count: 4,
      },
    ],
    byLicenseStatus: [
      {
        label: "ACTIVE",
        count: 13401,
      },
      {
        label: "(blank)",
        count: 1357,
      },
      {
        label: "INACTIVE - CAPEN DECISION",
        count: 339,
      },
    ],
    byFacStatus: [
      {
        label: "OPEN",
        count: 15097,
      },
    ],
    counties: [
      {
        county: "Los Angeles",
        count: 6588,
      },
      {
        county: "Orange",
        count: 952,
      },
      {
        county: "San Diego",
        count: 896,
      },
      {
        county: "San Bernardino",
        count: 726,
      },
      {
        county: "Riverside",
        count: 599,
      },
      {
        county: "Alameda",
        count: 557,
      },
      {
        county: "Ventura",
        count: 390,
      },
      {
        county: "Fresno",
        count: 377,
      },
      {
        county: "Sacramento",
        count: 361,
      },
      {
        county: "Santa Clara",
        count: 359,
      },
      {
        county: "Kern",
        count: 290,
      },
      {
        county: "Contra Costa",
        count: 277,
      },
      {
        county: "San Joaquin",
        count: 196,
      },
      {
        county: "San Francisco",
        count: 195,
      },
      {
        county: "Tulare",
        count: 173,
      },
      {
        county: "San Mateo",
        count: 171,
      },
      {
        county: "Stanislaus",
        count: 153,
      },
      {
        county: "Santa Barbara",
        count: 136,
      },
      {
        county: "Sonoma",
        count: 133,
      },
      {
        county: "San Luis Obispo",
        count: 124,
      },
      {
        county: "Monterey",
        count: 116,
      },
      {
        county: "Solano",
        count: 111,
      },
      {
        county: "Butte",
        count: 87,
      },
      {
        county: "Marin",
        count: 84,
      },
      {
        county: "Shasta",
        count: 84,
      },
      {
        county: "Merced",
        count: 83,
      },
      {
        county: "Humboldt",
        count: 76,
      },
      {
        county: "Placer",
        count: 74,
      },
      {
        county: "Santa Cruz",
        count: 61,
      },
      {
        county: "Madera",
        count: 59,
      },
      {
        county: "Imperial",
        count: 48,
      },
      {
        county: "Kings",
        count: 48,
      },
      {
        county: "Mendocino",
        count: 48,
      },
      {
        county: "Yolo",
        count: 47,
      },
      {
        county: "Napa",
        count: 46,
      },
      {
        county: "Sutter",
        count: 34,
      },
      {
        county: "El Dorado",
        count: 32,
      },
      {
        county: "Nevada",
        count: 32,
      },
      {
        county: "Lake",
        count: 31,
      },
      {
        county: "Tuolumne",
        count: 25,
      },
      {
        county: "Yuba",
        count: 23,
      },
      {
        county: "Del Norte",
        count: 22,
      },
      {
        county: "Siskiyou",
        count: 22,
      },
      {
        county: "Tehama",
        count: 18,
      },
      {
        county: "Calaveras",
        count: 15,
      },
      {
        county: "Inyo",
        count: 14,
      },
      {
        county: "Amador",
        count: 13,
      },
      {
        county: "Plumas",
        count: 13,
      },
      {
        county: "Glenn",
        count: 12,
      },
      {
        county: "San Benito",
        count: 12,
      },
      {
        county: "Colusa",
        count: 11,
      },
      {
        county: "Lassen",
        count: 9,
      },
      {
        county: "Mariposa",
        count: 9,
      },
      {
        county: "Modoc",
        count: 8,
      },
      {
        county: "Trinity",
        count: 8,
      },
      {
        county: "Mono",
        count: 4,
      },
      {
        county: "Sierra",
        count: 4,
      },
      {
        county: "Curry",
        count: 1,
      },
    ],
    activeLicenseStatus: 13401,
    openFacStatus: 15097,
    snf: 1186,
    homeHealth: 4137,
    hospice: 2114,
    hospiceFacility: 14,
    phonePct: 89.82,
    emailPct: 82.37,
    addressPct: 100.0,
    ownershipFields: ["BUSINESS_NAME", "ENTITY_TYPE_DESCRIPTION"],
  },
  rcfe: {
    source_name: "CDSS CCLD Residential Care Facilities for the Elderly",
    source_url: "https://data.chhs.ca.gov/dataset/ccl-facilities",
    source_agency:
      "California Department of Social Services \u2014 Community Care Licensing Division",
    source_as_of: "2025-05-25",
    retrieved_at: "2026-09-03T18:02:21Z",
    source_file_hash: "eef0a8f51c2dd3e01176b5e9dc0f5b3b697d4083d12ded6360a098b2f1d63e0e",
    source_row_count: 12522,
    row_grain: "RCFE / CCRC facility (facility_number)",
    identifier_fields: ["facility_number"],
    status_fields: ["facility_status"],
    byStatus: [
      {
        label: "LICENSED",
        count: 7939,
      },
      {
        label: "CLOSED",
        count: 3821,
      },
      {
        label: "PENDING",
        count: 739,
      },
      {
        label: "ON PROBATION",
        count: 23,
      },
    ],
    byType: [
      {
        label: "RESIDENTIAL CARE ELDERLY",
        count: 12389,
      },
      {
        label: "RCFE-CONTINUING CARE RETIREMENT COMMUNITY",
        count: 132,
      },
      {
        label: "(blank)",
        count: 1,
      },
    ],
    licensed: 7939,
    closed: 3821,
    pending: 739,
    onProbation: 23,
    phonePresent: 12522,
    addressPresent: 12522,
    emailPresent: 0,
    websitePresent: 0,
    capacityRows: 12522,
    capacityMin: 1,
    capacityMax: 1233,
    counties: [
      {
        county: "Los Angeles",
        count: 1648,
      },
      {
        county: "Orange",
        count: 1054,
      },
      {
        county: "Sacramento",
        count: 634,
      },
      {
        county: "San Diego",
        count: 581,
      },
      {
        county: "Riverside",
        count: 530,
      },
      {
        county: "Contra Costa",
        count: 435,
      },
      {
        county: "San Bernardino",
        count: 280,
      },
      {
        county: "Fresno",
        count: 264,
      },
      {
        county: "Santa Clara",
        count: 247,
      },
      {
        county: "Ventura",
        count: 241,
      },
      {
        county: "Alameda",
        count: 231,
      },
      {
        county: "Placer",
        count: 226,
      },
      {
        county: "San Mateo",
        count: 213,
      },
      {
        county: "Sonoma",
        count: 158,
      },
      {
        county: "Solano",
        count: 157,
      },
      {
        county: "Kern",
        count: 135,
      },
      {
        county: "San Joaquin",
        count: 109,
      },
      {
        county: "Santa Barbara",
        count: 102,
      },
      {
        county: "Stanislaus",
        count: 102,
      },
      {
        county: "San Luis Obispo",
        count: 98,
      },
      {
        county: "San Francisco",
        count: 51,
      },
      {
        county: "Marin",
        count: 48,
      },
      {
        county: "Tulare",
        count: 47,
      },
      {
        county: "Shasta",
        count: 44,
      },
      {
        county: "Monterey",
        count: 42,
      },
      {
        county: "Napa",
        count: 36,
      },
      {
        county: "El Dorado",
        count: 33,
      },
      {
        county: "Butte",
        count: 27,
      },
      {
        county: "Santa Cruz",
        count: 26,
      },
      {
        county: "Merced",
        count: 21,
      },
      {
        county: "Yolo",
        count: 21,
      },
      {
        county: "Mendocino",
        count: 17,
      },
      {
        county: "Humboldt",
        count: 14,
      },
      {
        county: "Tehama",
        count: 9,
      },
      {
        county: "Nevada",
        count: 8,
      },
      {
        county: "Sutter",
        count: 8,
      },
      {
        county: "Amador",
        count: 6,
      },
      {
        county: "Imperial",
        count: 6,
      },
      {
        county: "Kings",
        count: 6,
      },
      {
        county: "Madera",
        count: 6,
      },
      {
        county: "Lake",
        count: 4,
      },
      {
        county: "Glenn",
        count: 3,
      },
      {
        county: "San Benito",
        count: 3,
      },
      {
        county: "Yuba",
        count: 3,
      },
      {
        county: "Calaveras",
        count: 2,
      },
      {
        county: "Lassen",
        count: 1,
      },
      {
        county: "Siskiyou",
        count: 1,
      },
      {
        county: "Tuolumne",
        count: 1,
      },
    ],
    licensedCountyCount: 48,
    ownershipFields: ["licensee", "facility_administrator"],
    clockNote:
      "CCLD open-data file_date is 2025-05-25. This is not a September 2026 current count.",
    publication_eligibility: "PUBLIC_STATE_PAGE",
  },
  hco: {
    source_name: "CDSS CCLD Home Care Organization",
    source_url: "https://data.chhs.ca.gov/dataset/ccl-facilities",
    source_agency:
      "California Department of Social Services \u2014 Community Care Licensing Division",
    source_as_of: "2025-05-25",
    retrieved_at: "2026-09-03T18:02:21Z",
    source_file_hash: "3bb2e40d869a707524f631ca46b2bfe92394c4879d08f39b15446278043c0af8",
    source_row_count: 3654,
    row_grain: "home care organization (facility_number)",
    identifier_fields: ["facility_number"],
    byStatus: [
      {
        label: "LICENSED",
        count: 2247,
      },
      {
        label: "CLOSED",
        count: 1197,
      },
      {
        label: "PENDING",
        count: 210,
      },
    ],
    byType: [
      {
        label: "HOME CARE",
        count: 3654,
      },
    ],
    phonePresent: 3654,
    addressPresent: 3654,
    emailPresent: 0,
    note: "HOME CARE ORGANIZATION != HOME HEALTH AGENCY. Same May 2025 CCLD clock as RCFE.",
    publication_eligibility: "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
  },
  arf: {
    source_name: "CDSS CCLD Adult Residential Facilities",
    source_url: "https://data.chhs.ca.gov/dataset/ccl-facilities",
    source_agency:
      "California Department of Social Services \u2014 Community Care Licensing Division",
    source_as_of: "2025-05-25",
    retrieved_at: "2026-09-03T18:02:21Z",
    source_file_hash: "f267b873f02c53c1b60cefdb8c9836342ea72926274637373e474b535edc98fe",
    source_row_count: 10498,
    byType: [
      {
        label: "ADULT RESIDENTIAL",
        count: 8329,
      },
      {
        label: "ADULT DAY PROGRAM",
        count: 1343,
      },
      {
        label: "SOCIAL REHABILITATION FACILITY",
        count: 527,
      },
      {
        label: "ENHANCED BEHAVIORAL SUPPORTS HOME - ARF",
        count: 127,
      },
      {
        label: "ADULT RESIDENTIAL FACILITY FOR PERSONS WITH SPECIAL HEALTH CARE NEEDS",
        count: 117,
      },
      {
        label: "COMMUNITY CRISIS HOME - ARF",
        count: 38,
      },
      {
        label: "RESIDENTIAL FACILITY CHRONICALLY ILL",
        count: 17,
      },
    ],
    byStatus: [
      {
        label: "LICENSED",
        count: 7622,
      },
      {
        label: "CLOSED",
        count: 2354,
      },
      {
        label: "PENDING",
        count: 511,
      },
      {
        label: "ON PROBATION",
        count: 10,
      },
      {
        label: "9/2/1997",
        count: 1,
      },
    ],
    seniorRelevantTypes: [],
    publication_eligibility: "RESEARCHED_NOT_PUBLISHED",
    note: "Adult Residential is not a senior-care denominator. No subtype was added to the public California senior page unless it is explicitly elderly/RCFE.",
  },
  hcai: {
    source_name: "HCAI Current California Healthcare Facility Listing",
    source_url: "https://data.chhs.ca.gov/dataset/licensed-healthcare-facility-listing",
    source_agency: "Department of Health Care Access and Information (HCAI)",
    source_as_of: "2026-09-01",
    retrieved_at: "2026-09-03T18:02:21Z",
    source_file_hash: "e2a3aeeb28ae824fd8c34685959c2b6d559c0377aec61d8427677674f24271c2",
    source_row_count: 10871,
    row_grain: "HCAI facility listing (OSHPD_ID)",
    identifier_fields: ["OSHPD_ID", "PERM_ID", "LICENSE_NUM"],
    byStatus: [
      {
        label: "Open",
        count: 10856,
      },
      {
        label: "Suspense",
        count: 14,
      },
      {
        label: "Closed",
        count: 1,
      },
    ],
    byCategory: [
      {
        label: "Home Health Agency",
        count: 4310,
      },
      {
        label: "Hospice",
        count: 2669,
      },
      {
        label: "Community Clinic",
        count: 1213,
      },
      {
        label: "Skilled Nursing Facility",
        count: 1078,
      },
      {
        label: "Chronic Dialysis Clinic",
        count: 642,
      },
      {
        label: "General Acute Care Hospital",
        count: 458,
      },
      {
        label: "Congregate Living Health Facility",
        count: 273,
      },
      {
        label: "Free Clinic",
        count: 49,
      },
      {
        label: "Acute Psychiatric Hospital",
        count: 42,
      },
      {
        label: "Psychiatric Health Facility",
        count: 38,
      },
      {
        label: "Surgical Clinic",
        count: 35,
      },
      {
        label: "Psychology Clinic",
        count: 16,
      },
      {
        label: "Hospice Facility",
        count: 15,
      },
      {
        label: "Rehabilitation Clinic",
        count: 11,
      },
      {
        label: "ICF/Dev. Disabled",
        count: 8,
      },
      {
        label: "Chemical Dep. Recovery Hospital",
        count: 7,
      },
      {
        label: "Alternative Birthing Center",
        count: 7,
      },
    ],
    byType: [
      {
        label: "Home Health Agency/Hospice",
        count: 6979,
      },
      {
        label: "Clinic",
        count: 1973,
      },
      {
        label: "Long Term Care Facility",
        count: 1374,
      },
      {
        label: "Hospital",
        count: 545,
      },
    ],
    open: 10856,
    counties: [
      {
        county: "Los Angeles",
        count: 6007,
      },
      {
        county: "Orange",
        count: 554,
      },
      {
        county: "San Bernardino",
        count: 526,
      },
      {
        county: "San Diego",
        count: 460,
      },
      {
        county: "Riverside",
        count: 347,
      },
      {
        county: "Alameda",
        count: 339,
      },
      {
        county: "Ventura",
        count: 269,
      },
      {
        county: "Sacramento",
        count: 246,
      },
      {
        county: "Fresno",
        count: 204,
      },
      {
        county: "Santa Clara",
        count: 203,
      },
      {
        county: "Contra Costa",
        count: 160,
      },
      {
        county: "Kern",
        count: 153,
      },
      {
        county: "San Joaquin",
        count: 110,
      },
      {
        county: "San Francisco",
        count: 95,
      },
      {
        county: "San Mateo",
        count: 95,
      },
      {
        county: "Stanislaus",
        count: 92,
      },
      {
        county: "Santa Barbara",
        count: 79,
      },
      {
        county: "Tulare",
        count: 79,
      },
      {
        county: "Sonoma",
        count: 72,
      },
      {
        county: "Monterey",
        count: 70,
      },
      {
        county: "San Luis Obispo",
        count: 67,
      },
      {
        county: "Solano",
        count: 58,
      },
      {
        county: "Placer",
        count: 49,
      },
      {
        county: "Marin",
        count: 45,
      },
      {
        county: "Merced",
        count: 44,
      },
      {
        county: "Butte",
        count: 43,
      },
      {
        county: "Shasta",
        count: 41,
      },
      {
        county: "Humboldt",
        count: 28,
      },
      {
        county: "Mendocino",
        count: 28,
      },
      {
        county: "Santa Cruz",
        count: 26,
      },
      {
        county: "Napa",
        count: 25,
      },
      {
        county: "Imperial",
        count: 24,
      },
      {
        county: "Madera",
        count: 23,
      },
      {
        county: "Yolo",
        count: 22,
      },
      {
        county: "Sutter",
        count: 20,
      },
      {
        county: "El Dorado",
        count: 17,
      },
      {
        county: "Kings",
        count: 17,
      },
      {
        county: "Lake",
        count: 15,
      },
      {
        county: "Nevada",
        count: 15,
      },
      {
        county: "Siskiyou",
        count: 11,
      },
      {
        county: "Tuolumne",
        count: 11,
      },
      {
        county: "Yuba",
        count: 10,
      },
      {
        county: "Del Norte",
        count: 9,
      },
      {
        county: "Tehama",
        count: 9,
      },
      {
        county: "Amador",
        count: 6,
      },
      {
        county: "Colusa",
        count: 6,
      },
      {
        county: "Calaveras",
        count: 5,
      },
      {
        county: "Glenn",
        count: 5,
      },
      {
        county: "Inyo",
        count: 5,
      },
      {
        county: "Lassen",
        count: 5,
      },
      {
        county: "Mariposa",
        count: 5,
      },
      {
        county: "Plumas",
        count: 5,
      },
      {
        county: "San Benito",
        count: 5,
      },
      {
        county: "Modoc",
        count: 2,
      },
      {
        county: "Sierra",
        count: 2,
      },
      {
        county: "Trinity",
        count: 2,
      },
      {
        county: "Mono",
        count: 1,
      },
    ],
    phonePresent: 0,
    emailPresent: 0,
    addressPresent: 10871,
    note: "HCAI RECORD != UNIQUE NEW PROVIDER. Do not add to CDPH or CCLD.",
    publication_eligibility: "PUBLIC_STATE_PAGE",
  },
  cmsOverlay: {
    nursingHomes: 1165,
    homeHealth: 3213,
    hospice: 1913,
    source: "senior-national-intelligence.json geography CA (CMS class directories)",
    asOf: "2026-08-27",
    nationalFingerprint: "215b9d6301a9759f53dd92324930803089d319f95fe5e46739cbbd5f326c3294",
    liveDirectoryCaUniqueCcn: {
      nursingHomes: 1165,
      homeHealth: 3213,
      hospice: 1822,
    },
  },
  crosswalk: {
    snf: {
      state_rows: 1186,
      cms_rows: 1165,
      source_native_ccns: 1163,
      source_native_ccn_populated: 1164,
      exact_matches: 1152,
      unmatched_cdph: 11,
      unmatched_cms: 13,
      conflicts: 0,
      note: "Exact padded CCN match only. Name/city is not used.",
    },
    homeHealth: {
      state_rows: 4137,
      cms_rows: 3213,
      source_native_ccns: 1499,
      source_native_ccn_populated: 1546,
      exact_matches: 1449,
      unmatched_cdph: 50,
      unmatched_cms: 1764,
      conflicts: 0,
      note: "Exact padded CCN match only. Name/city is not used.",
    },
    hospice: {
      state_rows: 2114,
      cms_rows: 1822,
      source_native_ccns: 1089,
      source_native_ccn_populated: 1132,
      exact_matches: 956,
      unmatched_cdph: 133,
      unmatched_cms: 866,
      conflicts: 0,
      note: "Exact padded CCN match only. Name/city is not used.",
    },
    hcaiElms: {
      http_status: 200,
      resources: [
        {
          name: " ELMS-ASPEN-OSHPD - Licensed and Certified Healthcare Facility Crosswalk",
          format: "XLSX",
          id: "e083f267-43bf-427b-9ee3-f53faaff5d7e",
          datastore_active: true,
        },
        {
          name: "All resource data",
          format: "ZIP",
          id: "63499f73-feba-43f2-a364-7188d5cf7728",
          datastore_active: false,
        },
        {
          name: "ELMS-ASPEN - Licensed and Certified Healthcare Facility Crosswalk",
          format: "XLS",
          id: "d90d1858-fb94-45cd-ba62-eb8ff997384b",
          datastore_active: true,
        },
        {
          name: "ELMS-OSHPD - Licensed and Certified Healthcare Facility Crosswalk",
          format: "XLSX",
          id: "cf954841-9ca7-4914-a31f-29ca12c7b71a",
          datastore_active: true,
        },
        {
          name: "Data Dictionary - Licensed and Certified Healthcare Facility Crosswalk",
          format: "XLS",
          id: "5da6b920-b646-4324-b86c-3c4b1405fc42",
          datastore_active: true,
        },
        {
          name: "Lookup Table - Licensed and Certified Healthcare Facility Crosswalk ",
          format: "XLS",
          id: "738f4f21-6d89-4d73-9833-ce6e2c983c02",
          datastore_active: false,
        },
      ],
      rows: 15553,
      columns: [
        "_id",
        "LICENSED_CERTIFIED",
        "ELMS_FACID",
        "LICENSE_NUMBER",
        "LICENSE_STATUS_DESCRIPTION",
        "PERM_ID",
        "HCAI_ID",
        "ASPEN_FACID",
        "CCN",
        "NPI",
        "ASPEN_STATUS",
        "FACNAME",
        "FAC_TYPE_DESCRIPTION",
        "FAC_FDR",
        "FAC_FAC_RELATIONSHIP",
        "ELMS_PARENT_FACID",
      ],
      exact: {
        rows: 15553,
        elms_facid_populated: 15553,
        hcai_id_populated: 14746,
        ccn_populated: 9632,
        license_number_populated: 14133,
        elms_and_hcai: 14746,
        elms_and_ccn: 9632,
        hcai_and_ccn: 9600,
        unique_elms_with_hcai: 14746,
        elms_to_multiple_hcai: 0,
        unique_elms_with_ccn: 9632,
        elms_to_multiple_ccn: 0,
        unresolved_elms_without_hcai: 807,
        unresolved_elms_without_ccn: 5921,
        note: "Official ELMS-ASPEN-OSHPD crosswalk. One ELMS_FACID maps to at most one HCAI_ID and at most one CCN in this file. No name matching.",
      },
    },
  },
  enforcement: {
    pass: "bounded_easy_win",
    result: "NO_BULK_ACQUIRED",
    searches: {
      citation: {
        q: "healthcare facility citation",
        count: 81,
        titles: [
          "Licensed Healthcare Facility Listing",
          "Health Facilities State Enforcement Actions",
          "Licensed and Certified Healthcare Facility Crosswalk",
          "Licensed and Certified Healthcare Facility Services",
          "Licensed and Certified Healthcare Facility Listing",
          "Preferred Language Spoken in California Healthcare Facilities",
          "Licensed and Certified Healthcare Facility Bed Types and Counts",
          "Facility Profile Attributes",
        ],
      },
      deficiency: {
        q: "healthcare facility deficiency",
        count: 80,
        titles: [
          "Licensed Healthcare Facility Listing",
          "Licensed and Certified Healthcare Facility Crosswalk",
          "Licensed and Certified Healthcare Facility Services",
          "Licensed and Certified Healthcare Facility Listing",
          "Preferred Language Spoken in California Healthcare Facilities",
          "Licensed and Certified Healthcare Facility Bed Types and Counts",
          "Health Facilities State Enforcement Actions",
          "Facility Profile Attributes",
        ],
      },
      "enforcement cdph": {
        q: "CDPH enforcement",
        count: 7,
        titles: [
          "Health Facilities State Enforcement Actions",
          "Violent Crime Rate",
          "Licensed and Certified Healthcare Facility Services",
          "Retailers that Sold Tobacco to Underage Youth and Young Adults",
          "Licensed and Certified Healthcare Facility Crosswalk",
          "Licensed and Certified Healthcare Facility Listing",
          "COVID-19 Time-Series Metrics by County and State (ARCHIVED)",
        ],
      },
      "ccld complaint": {
        q: "community care complaint",
        count: 113,
        titles: [
          "Community Care Licensing Facilities",
          "Community Care Licensing Facilities",
          "Community Care Licensing Facilities",
          "Community Care Licensing Facilities",
          "Quarterly Provider Complaints",
          "Hospital Community Benefit Plans",
          "Chart 4.2 Cumulative Number of Community Supports Provider Contracts Since Community Supports Launched",
          "Chart 3.3 4 Cumulative Number of Members Who Utilized Community Supports Since Community Supports Launched",
        ],
      },
    },
    cmsFederalOverlay:
      "CMS inspection/deficiency evidence remains available on existing CMS class profiles. Not re-scraped here.",
    note: "No official structured statewide CDPH/CCLD enforcement CSV was acquired in this easy-win pass. Missing is unknown, not zero.",
  },
  ownership: {
    elmsFields: ["BUSINESS_NAME", "ENTITY_TYPE_DESCRIPTION"],
    rcfeFields: ["licensee", "facility_administrator"],
    hcoFields: ["licensee", "facility_administrator"],
    note: "BUSINESS_NAME / licensee preserved as source fields. No ownership graph. CMS NH ownership remains federal.",
  },
  gaps: [
    "CCLD RCFE/HCO/ARF open-data file_date is 2025-05-25, not current to the retrieval date.",
    "HCAI listing has no phone or email fields.",
    "Adult Residential includes non-senior classes and is not published as a senior-care universe.",
    "State CDPH/CCLD inspection/enforcement was not acquired as structured bulk.",
    "ELMS CONTACT_EMAIL is a facility contact field; administrator personal names are withheld from publication.",
    "HCAI rows overlap CDPH facilities and are not unique additional providers.",
    "CMS overlay counts from the national snapshot and live CMS CA CCN sets are independent of CDPH row counts and are not summed.",
    "County in these files is a facility address county, not a service area.",
  ],
  files: {
    elms: {
      id: "f0ae5731-fef8-417f-839d-54a0ed3a126e",
      url: "https://data.chhs.ca.gov/datastore/dump/f0ae5731-fef8-417f-839d-54a0ed3a126e",
      http_status: 200,
      bytes: 8056013,
      content_type: "application/octet-stream",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-ca-sen-001\\data\\raw\\california\\health_facility_locations.csv",
      sha256: "60b2268223a60fd0fc7a55dd86cced0bced5010593c2f76f0cc9767f02026e6b",
    },
    hcai: {
      id: "641c5557-7d65-4379-8fea-6b7dedbda40b",
      url: "https://data.chhs.ca.gov/datastore/dump/641c5557-7d65-4379-8fea-6b7dedbda40b",
      http_status: 200,
      bytes: 2487962,
      content_type: "application/octet-stream",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-ca-sen-001\\data\\raw\\california\\hcai_listing.csv",
      sha256: "e2a3aeeb28ae824fd8c34685959c2b6d559c0377aec61d8427677674f24271c2",
    },
    rcfe: {
      id: "744d1583-f9eb-45b6-b0f8-b9a9dab936a6",
      url: "https://data.chhs.ca.gov/datastore/dump/744d1583-f9eb-45b6-b0f8-b9a9dab936a6",
      http_status: 200,
      bytes: 2580336,
      content_type: "application/octet-stream",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-ca-sen-001\\data\\raw\\california\\ccld_rcfe.csv",
      sha256: "eef0a8f51c2dd3e01176b5e9dc0f5b3b697d4083d12ded6360a098b2f1d63e0e",
    },
    hco: {
      id: "b4d78b7f-12df-4b0c-a81a-ff40b949bc75",
      url: "https://data.chhs.ca.gov/datastore/dump/b4d78b7f-12df-4b0c-a81a-ff40b949bc75",
      http_status: 200,
      bytes: 721625,
      content_type: "application/octet-stream",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-ca-sen-001\\data\\raw\\california\\ccld_hco.csv",
      sha256: "3bb2e40d869a707524f631ca46b2bfe92394c4879d08f39b15446278043c0af8",
    },
    arf: {
      id: "9f5d1d00-6b24-4f44-a158-9cbe4b43f117",
      url: "https://data.chhs.ca.gov/datastore/dump/9f5d1d00-6b24-4f44-a158-9cbe4b43f117",
      http_status: 200,
      bytes: 2094273,
      content_type: "application/octet-stream",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-ca-sen-001\\data\\raw\\california\\ccld_arf.csv",
      sha256: "f267b873f02c53c1b60cefdb8c9836342ea72926274637373e474b535edc98fe",
    },
    cms_nh: {
      url: "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0/download?format=csv",
      http_status: 200,
      bytes: 8960329,
      saved: true,
      sha256: "6532ad89efe10ee04c678209d4f9e85f08e06c4b2e0c71d51e39b503ff6d699c",
      profile: {
        rows: 14690,
        columns: [
          "CMS Certification Number (CCN)",
          "Provider Name",
          "Provider Address",
          "City/Town",
          "State",
          "ZIP Code",
          "Telephone Number",
          "Provider SSA County Code",
          "County/Parish",
          "Urban",
          "Ownership Type",
          "Number of Certified Beds",
          "Average Number of Residents per Day",
          "Average Number of Residents per Day Footnote",
          "Provider Type",
          "Provider Resides in Hospital",
          "Legal Business Name",
          "Date First Approved to Provide Medicare and Medicaid Services",
          "Chain Name",
          "Chain ID",
          "Number of Facilities in Chain",
          "Chain Average Overall 5-star Rating",
          "Chain Average Health Inspection Rating",
          "Chain Average Staffing Rating",
          "Chain Average QM Rating",
          "Continuing Care Retirement Community",
          "Special Focus Status",
          "Abuse Icon",
          "Most Recent Health Inspection More Than 2 Years Ago",
          "Provider Changed Ownership in Last 12 Months",
        ],
        state_key: "State",
        ccn_key: "CMS Certification Number (CCN)",
        ca_rows: 1165,
        ca_unique_ccn: 1165,
      },
    },
    cms_hha: {
      url: "https://data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0/download?format=csv",
      http_status: 200,
      bytes: 13028353,
      saved: true,
      sha256: "31fdc51c3d056001a864a1eba1fabc3f87aaded7111476e9234d23e4783f3410",
      profile: {
        rows: 12460,
        columns: [
          "State",
          "CMS Certification Number (CCN)",
          "Provider Name",
          "Address",
          "City/Town",
          "ZIP Code",
          "Telephone Number",
          "Type of Ownership",
          "Offers Nursing Care Services",
          "Offers Physical Therapy Services",
          "Offers Occupational Therapy Services",
          "Offers Speech Pathology Services",
          "Offers Medical Social Services",
          "Offers Home Health Aide Services",
          "Certification Date",
          "Quality of patient care star rating",
          "Footnote for quality of patient care star rating",
          "Numerator for how often the home health team began their patients' care in a timely manner",
          "Denominator for how often the home health team began their patients' care in a timely manner",
          "How often the home health team began their patients' care in a timely manner",
          "Footnote for how often the home health team began their patients' care in a timely manner",
          "Numerator for how often the home health team determined whether patients received a flu shot for the current flu season",
          "Denominator for how often the home health team determined whether patients received a flu shot for the current flu season",
          "How often the home health team determined whether patients received a flu shot for the current flu season",
          "Footnote for how often the home health team determined whether patients received a flu shot for the current flu season",
          "Numerator for how often patients got better at walking or moving around",
          "Denominator for how often patients got better at walking or moving around",
          "How often patients got better at walking or moving around",
          "Footnote for how often patients got better at walking or moving around",
          "Numerator for how often patients got better at getting in and out of bed",
        ],
        state_key: "State",
        ccn_key: "CMS Certification Number (CCN)",
        ca_rows: 3213,
        ca_unique_ccn: 3213,
      },
    },
    cms_hospice: {
      url: "https://data.cms.gov/provider-data/api/1/datastore/query/yc9t-dgbk/0/download?format=csv",
      http_status: 200,
      bytes: 894972,
      saved: true,
      sha256: "eb8d98c62bb944055c1eb411344d965ea2617991fc7df7312c3d35847e199532",
      profile: {
        rows: 6669,
        columns: [
          "CMS Certification Number (CCN)",
          "Facility Name",
          "Address Line 1",
          "Address Line 2",
          "City/Town",
          "State",
          "ZIP Code",
          "County/Parish",
          "Telephone Number",
          "CMS Region",
          "Ownership Type",
          "Certification Date",
        ],
        state_key: "State",
        ccn_key: "CMS Certification Number (CCN)",
        ca_rows: 1913,
        ca_unique_ccn: 1822,
      },
    },
    crosswalk: {
      id: "e083f267-43bf-427b-9ee3-f53faaff5d7e",
      url: "https://data.chhs.ca.gov/datastore/dump/e083f267-43bf-427b-9ee3-f53faaff5d7e",
      http_status: 200,
      bytes: 2705163,
      content_type: "application/octet-stream",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-ca-sen-001\\data\\raw\\california\\facility_crosswalk.csv",
      sha256: "58e7cafdac5723b4016ed2d0fa8833af314439c1f233068fa2288fbd6ded5103",
    },
  },
  fingerprint: "13dd705e7d3e3896f4e8cb03fcae731d3a38bb3070b1943e84e9bd015b7879e0",
} as const;
