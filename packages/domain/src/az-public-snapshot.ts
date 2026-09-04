/** Generated from artifacts/az-sen-001-public-snapshot.json. Do not edit by hand. */
export const AZ_PUBLIC_SNAPSHOT = {
  "version": "senior-az-state-intel-v1",
  "asOf": "2026-09-04",
  "retrievedAt": "2026-09-04T18:37:40Z",
  "ticket": "AZ-SEN-001",
  "regulatorMap": {
    "agency": "Arizona Department of Health Services",
    "division": "Division of Licensing Services / Public Health Licensing",
    "bureaus": {
      "assistedLiving": {
        "name": "Bureau of Assisted Living Facilities Licensing (BALF)",
        "classes": [
          "Assisted Living Home",
          "Assisted Living Center",
          "Adult Foster Care",
          "Adult Day Health Care"
        ],
        "url": "https://www.azdhs.gov/licensing/residential-facilities/index.php"
      },
      "longTermCare": {
        "name": "Bureau of Long-Term Care Facilities Licensing",
        "classes": [
          "Nursing Home (NH)",
          "Nursing-supported group homes",
          "ICF/IID"
        ],
        "url": "https://www.azdhs.gov/licensing/long-term-care/index.php"
      },
      "medicalFacilities": {
        "name": "Bureau of Medical Facilities Licensing",
        "classes": [
          "Home Health Agency",
          "Hospice service agency",
          "Hospice inpatient facility"
        ],
        "url": "https://www.azdhs.gov/licensing/medical-facilities/index.php"
      }
    },
    "officialHub": "https://www.azdhs.gov/licensing/",
    "monthlyTables": "https://www.azdhs.gov/licensing/index.php#databases",
    "verifyAzCareCheck": "https://azcarecheck.azdhs.gov/",
    "gisHub": "https://geodata-adhsgis.hub.arcgis.com/",
    "scrape": "FORBIDDEN",
    "classes": [
      {
        "code": "ALH",
        "officialName": "Assisted Living Home",
        "publication_class": "CORE_SENIOR",
        "directory": "PUBLIC_CORE",
        "profile_publication": "STATE_DIRECTORY_ONLY",
        "count": 1719,
        "note": "Ten or fewer residents (A.R.S. \u00a7 36-401). AL Home != AL Center != Nursing Home."
      },
      {
        "code": "ALC",
        "officialName": "Assisted Living Center",
        "publication_class": "CORE_SENIOR",
        "directory": "PUBLIC_CORE",
        "profile_publication": "STATE_DIRECTORY_ONLY",
        "count": 328,
        "note": "Eleven or more residents. Not collapsed into Assisted Living Home."
      },
      {
        "code": "AFC",
        "officialName": "Adult Foster Care",
        "publication_class": "CORE_SENIOR",
        "directory": "PUBLIC_CORE",
        "profile_publication": "STATE_DIRECTORY_ONLY",
        "count": 25,
        "note": "Separate BALF class. AFC != AL Home != Nursing Home."
      },
      {
        "code": "ADHC",
        "officialName": "Adult Day Health Care",
        "publication_class": "ADJACENT_RELEVANT",
        "directory": "PUBLIC_CORE",
        "profile_publication": "MARKET_INTELLIGENCE_ONLY",
        "count": 15,
        "note": "Non-residential adult day health. Not added to residential facility counts."
      },
      {
        "code": "NH",
        "officialName": "Nursing Home (NH)",
        "publication_class": "CORE_SENIOR",
        "directory": "PUBLIC_CORE",
        "profile_publication": "STATE_DIRECTORY_ONLY",
        "count": 141,
        "note": "ADHS state license. CMS certification is a separate identity."
      },
      {
        "code": "HHA",
        "officialName": "Home Health Agency",
        "publication_class": "CORE_SENIOR",
        "directory": "PUBLIC_CORE",
        "profile_publication": "STATE_DIRECTORY_ONLY",
        "count": 223,
        "note": "State license != CMS Home Health certification. Office address != service area."
      },
      {
        "code": "HOSPICE",
        "officialName": "Hospice",
        "publication_class": "CORE_SENIOR",
        "directory": "PUBLIC_CORE",
        "profile_publication": "STATE_DIRECTORY_ONLY",
        "count": 328,
        "note": "Includes hospice service agencies and inpatient facilities in TYPE=HOSPICE. Hospice != Home Health."
      },
      {
        "code": "NSGH",
        "officialName": "Nursing-supported group homes",
        "publication_class": "ADJACENT_RELEVANT",
        "directory": "INTERNAL_ONLY",
        "profile_publication": "MARKET_INTELLIGENCE_ONLY",
        "count": 61,
        "note": "Not a consumer Assisted Living / Nursing Home tile."
      },
      {
        "code": "ICF_IID",
        "officialName": "Intermediate Care Facility for Intellectually Disabled",
        "publication_class": "ADJACENT_RELEVANT",
        "directory": "INTERNAL_ONLY",
        "profile_publication": "MARKET_INTELLIGENCE_ONLY",
        "count": 11,
        "note": "Not merged into Nursing Home counts."
      },
      {
        "code": "DD_GROUP_HOME",
        "officialName": "Developmentally Disabled Group Home",
        "publication_class": "EXCLUDED",
        "directory": "INTERNAL_ONLY",
        "profile_publication": "INTERNAL_ONLY",
        "count": 1414,
        "note": "Not a SeniorTrustHub core senior-care class."
      },
      {
        "code": "BH_RESIDENTIAL",
        "officialName": "Behavioral Health Residential Facility",
        "publication_class": "EXCLUDED",
        "directory": "INTERNAL_ONLY",
        "profile_publication": "INTERNAL_ONLY",
        "count": 830,
        "note": "Behavioral-health residential is excluded from senior-care core."
      },
      {
        "code": "CHILD_CARE",
        "officialName": "Child Care Center / Group Home",
        "publication_class": "EXCLUDED",
        "directory": "INTERNAL_ONLY",
        "profile_publication": "INTERNAL_ONLY",
        "count": 2536,
        "note": "Child care is not senior care."
      }
    ]
  },
  "adhsMonthlyTables": {
    "declaredUrl": "https://www.azdhs.gov/licensing/index.php#databases",
    "refreshRule": "ADHS states tables update on the first business day of the month; run date is inside each file.",
    "access": "SOURCE_NOT_ACQUIRED",
    "reason": "Current HTML has no CSV/XLSX/ZIP download links after LMS migration. Legacy provider search is not scraped.",
    "lmsNote": "ADHS warns some active facilities may be omitted from reports due to licensing-management-system migration."
  },
  "adhsGis": {
    "source_url": "https://services1.arcgis.com/mpVYz37anSdrK4d8/ArcGIS/rest/services/All_State_Licensed_Facilities_in_Arizona/FeatureServer/18",
    "service_description_clock": "February 2025",
    "run_date": "2025-02-03",
    "run_date_distribution": {
      "2025-02-03": 11555
    },
    "rows": 11555,
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "secondary_id": "FACID",
    "grain": "one GIS feature = one licensed facility location on the extract",
    "types": {
      "OUTPATIENT TREATMENT CENTER": 2400,
      "Child Care Center": 2258,
      "ASSISTED LIVING HOME": 1719,
      "DEVELOPMENTALLY DISABLED GROUP HOME": 1414,
      "BEHAVIORAL HEALTH RESIDENTIAL FACILITY": 830,
      "COUNSELING": 358,
      "HOSPICE": 328,
      "ASSISTED LIVING CENTER": 328,
      "Child Care Group Home": 278,
      "AMBULATORY SURGICAL CENTER": 238,
      "HOME HEALTH AGENCY": 223,
      "HOSPITAL": 160,
      "FEDERALLY QUALIFIED HEALTH CENTER": 144,
      "NURSING HOME (NH)": 141,
      "END STAGE RENAL DISEASE FACILITIES": 123,
      "PAIN MANAGEMENT CLINIC": 80,
      "ADULT BEHAVIORAL HEALTH THERAPEUTIC HOME": 76,
      "BEHAVIORAL HEALTH INPATIENT FACILITY": 68,
      "NURSING SUPPORTED GROUP HOMES": 61,
      "OUTPATIENT SURGERY CENTER": 60,
      "RURAL HEALTH CLINICS": 52,
      "DUI/DVTX": 50,
      "UNCLASSIFIED": 48,
      "ADULT FOSTER CARE": 25,
      "OUTPATIENT PHYSICAL THERAPY/SPEECH PATHOLOGY SERVICES": 19,
      "ADULT DAY HEALTH CARE": 15,
      "INTERMEDIATE CARE FACILITY FOR INTELLECTUALLY DISABLED": 11,
      "PORTABLE X-RAY SUPPLIERS": 11,
      "BEHAVIORAL HEALTH RESPITE HOME": 8,
      "RECOVERY CARE CENTER": 6,
      "OUTPATIENT TREATMENT CENTER / ABORTION CLINIC": 5,
      "BEHAVIORAL HEALTH SUPPORTED GROUP HOMES": 4,
      "ABORTION CLINIC": 4,
      "COMPREHENSIVE OUTPATIENT REHABILITATION FACILITIES": 3,
      "UNKNOWN": 2,
      "SUBSTANCE ABUSE TRANSITIONAL": 2,
      "BH SPECIALIZED TRANSITIONAL FACILITY": 1,
      "ORGAN PROCUREMENT ORGANIZATIONS": 1,
      "COMMUNITY MENTAL HEALTH CENTERS": 1
    },
    "status": {
      "ACTIVE": 9019,
      "Active": 2536
    },
    "contacts": {
      "phone_field": "Telephone",
      "phone_nonempty": 11551,
      "address_field": "ADDRESS",
      "address_nonempty": 11555,
      "email_field": null,
      "email_nonempty": 0,
      "website_field": null,
      "website_nonempty": 0,
      "provenance": {
        "phone": "AZ_ADHS_FACILITY_PHONE",
        "address": "AZ_ADHS_FACILITY_ADDRESS"
      },
      "note": "No internet enrichment. Administrator/person fields are not on this GIS layer."
    },
    "limitation": "GIS extract RUN_DATE is 2025-02-03. It is official ADHS bulk, not the September 2026 monthly Excel table."
  },
  "assistedLivingHomes": {
    "rows": 1719,
    "unique_license": 1719,
    "unique_facid": 1719,
    "unique_names": 1655,
    "status": {
      "ACTIVE": 1719
    },
    "subtypes": {
      "ASSISTED LIVING HOME-DIRECTED": 1702,
      "ASSISTED LIVING HOME-PERSONAL": 16,
      "ASSISTED LIVING HOME-SUPERVISORY": 1
    },
    "phone_nonempty": 1719,
    "address_nonempty": 1719,
    "capacity_nonempty": 1716,
    "capacity_sum": 14208,
    "medicare_id_nonempty": 0,
    "distinct_counties": 12,
    "county": {
      "MARICOPA": 1330,
      "PIMA": 242,
      "PINAL": 55,
      "YAVAPAI": 33,
      "YUMA": 14,
      "MOHAVE": 13,
      "GILA": 11,
      "COCONINO": 7,
      "COCHISE": 6,
      "SANTA CRUZ": 3,
      "GRAHAM": 3,
      "APACHE": 2
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "profile_publication": "STATE_DIRECTORY_ONLY",
    "note": "Assisted Living Home != Assisted Living Center. License row != unique organization unless proven."
  },
  "assistedLivingCenters": {
    "rows": 328,
    "unique_license": 328,
    "unique_facid": 328,
    "unique_names": 327,
    "status": {
      "ACTIVE": 328
    },
    "subtypes": {
      "ASSISTED LIVING CENTER-DIRECTED": 293,
      "ASSISTED LIVING CENTER-PERSONAL": 34,
      "ASSISTED LIVING CENTER-SUPERVISORY": 1
    },
    "phone_nonempty": 328,
    "address_nonempty": 328,
    "capacity_nonempty": 328,
    "capacity_sum": 29654,
    "medicare_id_nonempty": 0,
    "distinct_counties": 12,
    "county": {
      "MARICOPA": 208,
      "PIMA": 53,
      "YAVAPAI": 19,
      "MOHAVE": 13,
      "NAVAJO": 7,
      "PINAL": 7,
      "YUMA": 7,
      "COCONINO": 6,
      "COCHISE": 5,
      "GILA": 1,
      "APACHE": 1,
      "GRAHAM": 1
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "profile_publication": "STATE_DIRECTORY_ONLY",
    "note": "Eleven or more residents. Not added to Homes."
  },
  "adultFosterCare": {
    "rows": 25,
    "unique_license": 25,
    "unique_facid": 25,
    "unique_names": 25,
    "status": {
      "ACTIVE": 25
    },
    "subtypes": {
      "ADULT FOSTER CARE": 25
    },
    "phone_nonempty": 25,
    "address_nonempty": 25,
    "capacity_nonempty": 25,
    "capacity_sum": 97,
    "medicare_id_nonempty": 0,
    "distinct_counties": 3,
    "county": {
      "MARICOPA": 17,
      "PIMA": 7,
      "YAVAPAI": 1
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "profile_publication": "STATE_DIRECTORY_ONLY",
    "note": "Meaningful small state-only senior-care universe. AFC != Nursing Home."
  },
  "adultDayHealth": {
    "rows": 15,
    "unique_license": 15,
    "unique_facid": 15,
    "unique_names": 14,
    "status": {
      "ACTIVE": 15
    },
    "subtypes": {
      "ADULT DAY HEALTH CARE": 15
    },
    "phone_nonempty": 15,
    "address_nonempty": 15,
    "capacity_nonempty": 15,
    "capacity_sum": 857,
    "medicare_id_nonempty": 0,
    "distinct_counties": 4,
    "county": {
      "MARICOPA": 10,
      "YAVAPAI": 2,
      "PIMA": 2,
      "YUMA": 1
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "profile_publication": "MARKET_INTELLIGENCE_ONLY",
    "publication_class": "ADJACENT_RELEVANT",
    "note": "Non-residential. Not combined with AL Home/Center."
  },
  "stateNursingHomes": {
    "rows": 141,
    "unique_license": 138,
    "unique_facid": 141,
    "unique_names": 141,
    "status": {
      "ACTIVE": 141
    },
    "subtypes": {
      "DUAL CERT": 103,
      "SKILLED": 28,
      "DISTINCT PART": 7,
      "NURSING HOME (NH)": 3
    },
    "phone_nonempty": 141,
    "address_nonempty": 141,
    "capacity_nonempty": 138,
    "capacity_sum": 15749,
    "medicare_id_nonempty": 141,
    "distinct_counties": 12,
    "county": {
      "MARICOPA": 78,
      "PIMA": 24,
      "YAVAPAI": 7,
      "YUMA": 6,
      "MOHAVE": 6,
      "COCHISE": 4,
      "COCONINO": 4,
      "GILA": 4,
      "PINAL": 3,
      "NAVAJO": 3,
      "GRAHAM": 1,
      "APACHE": 1
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "federal_id_field": "MEDICARE_ID",
    "profile_publication": "STATE_DIRECTORY_ONLY",
    "note": "State license != CMS CCN. Exact MEDICARE_ID join only."
  },
  "stateHomeHealth": {
    "rows": 223,
    "unique_license": 223,
    "unique_facid": 223,
    "unique_names": 205,
    "status": {
      "ACTIVE": 223
    },
    "subtypes": {
      "HHA": 223
    },
    "phone_nonempty": 223,
    "address_nonempty": 223,
    "capacity_nonempty": 0,
    "capacity_sum": 0,
    "medicare_id_nonempty": 176,
    "distinct_counties": 16,
    "county": {
      "MARICOPA": 129,
      "PIMA": 27,
      "YAVAPAI": 11,
      "MOHAVE": 10,
      "United States": 8,
      "YUMA": 6,
      "UNKNOWN": 6,
      "NAVAJO": 5,
      "COCHISE": 4,
      "Maricopa": 4,
      "PINAL": 4,
      "COCONINO": 3,
      "GILA": 2,
      "SANTA CRUZ": 1,
      "LA PAZ": 1,
      "APACHE": 1,
      "Coconino": 1
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "federal_id_field": "MEDICARE_ID",
    "note": "HOME HEALTH OFFICE ADDRESS != SERVICE AREA."
  },
  "stateHospice": {
    "rows": 328,
    "unique_license": 328,
    "unique_facid": 328,
    "unique_names": 304,
    "status": {
      "ACTIVE": 328
    },
    "subtypes": {
      "HOSPICE SERVICE AGENCY": 311,
      "HOSPICE INPATIENT FACILITY": 16,
      "HOSPICE": 1
    },
    "phone_nonempty": 328,
    "address_nonempty": 328,
    "capacity_nonempty": 12,
    "capacity_sum": 163,
    "medicare_id_nonempty": 256,
    "distinct_counties": 17,
    "county": {
      "MARICOPA": 189,
      "PIMA": 33,
      "UNKNOWN": 19,
      "YAVAPAI": 16,
      "MOHAVE": 15,
      "COCONINO": 8,
      "Maricopa": 8,
      "PINAL": 7,
      "United States": 7,
      "GILA": 6,
      "YUMA": 6,
      "COCHISE": 4,
      "NAVAJO": 4,
      "GRAHAM": 2,
      "SANTA CRUZ": 1,
      "Arizona": 1,
      "LA PAZ": 1,
      "Yavapai": 1
    },
    "identity": "AZ-ADHS:{LICENSE_NUMBER}",
    "federal_id_field": "MEDICARE_ID",
    "note": "HOSPICE != HOME HEALTH. Service agency and inpatient remain under TYPE=HOSPICE with native SUBTYPE."
  },
  "cmsOverlay": {
    "nursingHomes": 140,
    "homeHealth": 177,
    "hospice": 237,
    "source": "senior-national-intelligence.json geography AZ (CMS class directories)",
    "asOf": "2026-08-27",
    "nationalFingerprint": "215b9d6301a9759f53dd92324930803089d319f95fe5e46739cbbd5f326c3294",
    "clocks": {
      "nursingHomes": {
        "datasetKey": "nursing-home-provider-information",
        "officialUrl": "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        "sourceModifiedAt": "2026-08-01T00:00:00+00:00",
        "retrievedAt": "2026-08-26T20:24:52.158102+00:00",
        "sourcePeriod": null
      },
      "homeHealth": {
        "datasetKey": "home-health-care-agencies",
        "officialUrl": "https://data.cms.gov/provider-data/dataset/6jpm-sxkc",
        "sourceModifiedAt": "2026-05-27T00:00:00+00:00",
        "retrievedAt": "2026-08-26T21:08:16.274819+00:00",
        "sourcePeriod": null
      },
      "hospice": {
        "datasetKey": "hospice-general-information",
        "officialUrl": "https://data.cms.gov/provider-data/dataset/yc9t-dgbk",
        "sourceModifiedAt": "2026-08-19T00:00:00+00:00",
        "retrievedAt": "2026-08-26T22:15:06.243039+00:00",
        "sourcePeriod": null
      },
      "ownership": {
        "datasetKey": "skilled-nursing-facility-all-owners",
        "officialUrl": "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-all-owners",
        "sourceModifiedAt": "2026-08-17T00:00:00+00:00",
        "retrievedAt": "2026-08-26T20:25:26.251400+00:00",
        "sourcePeriod": "2026-08-01/2026-08-31"
      },
      "penalties": {
        "datasetKey": "nursing-home-penalties",
        "officialUrl": "https://data.cms.gov/provider-data/dataset/g6vv-u9sr",
        "sourceModifiedAt": "2026-08-01T00:00:00+00:00",
        "retrievedAt": "2026-08-26T20:24:35.184131+00:00",
        "sourcePeriod": null
      },
      "staffing": {
        "datasetKey": "payroll-based-journal-daily-nurse-staffing",
        "officialUrl": "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing",
        "sourceModifiedAt": "2026-07-29T00:00:00+00:00",
        "retrievedAt": "2026-08-15T04:29:10.416563+00:00",
        "sourcePeriod": "2026Q1"
      }
    },
    "liveDirectoryAzUniqueCcn": {
      "nursingHomes": 140,
      "homeHealth": 177,
      "hospice": 237
    },
    "query": {
      "nh": {
        "dataset_id": "4pq5-n9py",
        "title": "Provider Information",
        "modified": "2026-08-01",
        "state_field": "state",
        "az_count_reported": 140,
        "az_rows": 140,
        "ccn_field": "cms_certification_number_ccn",
        "unique_ccn": 140
      },
      "hha": {
        "dataset_id": "6jpm-sxkc",
        "title": "Home Health Care Agencies",
        "modified": "2026-05-27",
        "state_field": "state",
        "az_count_reported": 177,
        "az_rows": 177,
        "ccn_field": "cms_certification_number_ccn",
        "unique_ccn": 177
      },
      "hospice": {
        "dataset_id": "yc9t-dgbk",
        "title": "Hospice - General Information",
        "modified": "2026-08-19",
        "state_field": "state",
        "az_count_reported": 237,
        "az_rows": 237,
        "ccn_field": "cms_certification_number_ccn",
        "unique_ccn": 237
      }
    },
    "nationalCoverage": {
      "mdsQualityProviders": 14687,
      "mdsQualityMissing": 3,
      "staffingPbjProviders": 14596,
      "inspectionProviders": 14687,
      "fireSafetyProviders": 13909,
      "ownedByProviders": 12562,
      "chowHistoryProviders": 5172
    },
    "note": "CMS class overlays are independent of ADHS GIS row counts and are not summed. CMS CERTIFIED != STATE LICENSED."
  },
  "preIngestBaseline": {
    "cmsNursingHomeCcns": 140,
    "cmsHomeHealthCcns": 177,
    "cmsHospiceCcns": 237,
    "stateAssistedLivingHome": 0,
    "stateAssistedLivingCenter": 0,
    "stateAdultFosterCare": 0,
    "stateAdultDayHealth": 0,
    "stateNursingHomeIdentities": 0,
    "note": "CMS Arizona CCNs already live in the national graph (senior-network-metrics-v1 / senior-hub-intel). No Arizona ADHS state-license identities existed in SeniorTrustHub before this ticket. CA/NY/TX assisted-living pilots do not include Arizona."
  },
  "crosswalk": {
    "alHomeToCmsNh": {
      "attempted": false,
      "reason": "Assisted Living Home is not a CMS Nursing Home class. Name/address join is forbidden."
    },
    "alCenterToCmsNh": {
      "attempted": false,
      "reason": "Assisted Living Center is not a CMS Nursing Home class."
    },
    "afcToCmsNh": {
      "attempted": false,
      "reason": "Adult Foster Care is not a CMS Nursing Home class."
    },
    "stateNhToCmsNh": {
      "attempted": true,
      "method": "exact padded MEDICARE_ID \u2229 CMS CCN; name and city are not used",
      "state_native_ccns": 141,
      "cms_az_ccns": 140,
      "exact_matches": 140,
      "unmatched_state": 1,
      "unmatched_cms": 0,
      "note": "No name/city join. ADHS != CMS. Unmatched remain unmatched."
    },
    "stateHhaToCmsHha": {
      "attempted": true,
      "method": "exact padded MEDICARE_ID \u2229 CMS CCN; name and city are not used",
      "state_native_ccns": 176,
      "cms_az_ccns": 177,
      "exact_matches": 172,
      "unmatched_state": 4,
      "unmatched_cms": 5,
      "note": "No name/city join. ADHS != CMS. Unmatched remain unmatched."
    },
    "stateHospiceToCmsHospice": {
      "attempted": true,
      "method": "exact padded MEDICARE_ID \u2229 CMS CCN; name and city are not used",
      "state_native_ccns": 256,
      "cms_az_ccns": 237,
      "exact_matches": 232,
      "unmatched_state": 24,
      "unmatched_cms": 5,
      "note": "No name/city join. ADHS != CMS. Unmatched remain unmatched."
    }
  },
  "azCareCheck": {
    "AZ_CARE_CHECK": "OPEN_SEARCH_ONLY",
    "url": "https://azcarecheck.azdhs.gov/",
    "result": "Interactive search (facility/provider name, address, license type, status). No CSV/API/JSON bulk found this ticket.",
    "scrape": "FORBIDDEN",
    "note": "Licensing history, deficiencies, and enforcement may appear on a facility detail page. Missing bulk != zero enforcement."
  },
  "enforcement": {
    "state": {
      "result": "NO_BULK_ACQUIRED",
      "access": "AZ Care Check SEARCH_ONLY; ADHS metadata describes applicant/licensee/complaint/survey data inside LMS, not a public bulk file",
      "note": "Complaint != violation. Survey != quality score. Deficiency != quality rank. Name-only attach is UNSAFE. No action found != clean record."
    },
    "cms": {
      "result": "REUSED_NATIONAL_EXACT_CCN",
      "note": "Nursing Home inspection, deficiency, penalty, staffing, and ownership stay on existing exact-CCN national architecture."
    }
  },
  "ownership": {
    "cmsNursingHome": "Reuse existing SeniorTrustHub CMS ownership graph on exact CCN.",
    "adhs": "GIS layer has facility name, not a licensee/operator/owner entity field. AZ Care Check shows Owner/Licensee on interactive detail pages (not bulk). Do not infer ownership across facilities by name. ADHS licensee != CMS owner unless exact source establishes it."
  },
  "geography": {
    "grain": "COUNTY on the GIS record is a facility address county, not a service area.",
    "county_table": [
      {
        "county": "MARICOPA",
        "al_home": 1330,
        "al_center": 208,
        "afc": 17,
        "adhc": 10,
        "nh": 78,
        "hha": 129,
        "hospice": 189
      },
      {
        "county": "PIMA",
        "al_home": 242,
        "al_center": 53,
        "afc": 7,
        "adhc": 2,
        "nh": 24,
        "hha": 27,
        "hospice": 33
      },
      {
        "county": "PINAL",
        "al_home": 55,
        "al_center": 7,
        "afc": 0,
        "adhc": 0,
        "nh": 3,
        "hha": 4,
        "hospice": 7
      },
      {
        "county": "YAVAPAI",
        "al_home": 33,
        "al_center": 19,
        "afc": 1,
        "adhc": 2,
        "nh": 7,
        "hha": 11,
        "hospice": 16
      },
      {
        "county": "MOHAVE",
        "al_home": 13,
        "al_center": 13,
        "afc": 0,
        "adhc": 0,
        "nh": 6,
        "hha": 10,
        "hospice": 15
      },
      {
        "county": "YUMA",
        "al_home": 14,
        "al_center": 7,
        "afc": 0,
        "adhc": 1,
        "nh": 6,
        "hha": 6,
        "hospice": 6
      },
      {
        "county": "COCONINO",
        "al_home": 7,
        "al_center": 6,
        "afc": 0,
        "adhc": 0,
        "nh": 4,
        "hha": 3,
        "hospice": 8
      },
      {
        "county": "GILA",
        "al_home": 11,
        "al_center": 1,
        "afc": 0,
        "adhc": 0,
        "nh": 4,
        "hha": 2,
        "hospice": 6
      },
      {
        "county": "COCHISE",
        "al_home": 6,
        "al_center": 5,
        "afc": 0,
        "adhc": 0,
        "nh": 4,
        "hha": 4,
        "hospice": 4
      },
      {
        "county": "NAVAJO",
        "al_home": 0,
        "al_center": 7,
        "afc": 0,
        "adhc": 0,
        "nh": 3,
        "hha": 5,
        "hospice": 4
      },
      {
        "county": "GRAHAM",
        "al_home": 3,
        "al_center": 1,
        "afc": 0,
        "adhc": 0,
        "nh": 1,
        "hha": 0,
        "hospice": 2
      },
      {
        "county": "APACHE",
        "al_home": 2,
        "al_center": 1,
        "afc": 0,
        "adhc": 0,
        "nh": 1,
        "hha": 1,
        "hospice": 0
      },
      {
        "county": "SANTA CRUZ",
        "al_home": 3,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 1,
        "hospice": 1
      },
      {
        "county": "Arizona",
        "al_home": 0,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 0,
        "hospice": 1
      },
      {
        "county": "Coconino",
        "al_home": 0,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 1,
        "hospice": 0
      },
      {
        "county": "LA PAZ",
        "al_home": 0,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 1,
        "hospice": 1
      },
      {
        "county": "Maricopa",
        "al_home": 0,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 4,
        "hospice": 8
      },
      {
        "county": "United States",
        "al_home": 0,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 8,
        "hospice": 7
      },
      {
        "county": "Yavapai",
        "al_home": 0,
        "al_center": 0,
        "afc": 0,
        "adhc": 0,
        "nh": 0,
        "hha": 0,
        "hospice": 1
      }
    ],
    "no_county_routes": true
  },
  "publicationDecisions": {
    "ASSISTED_LIVING_HOME": "STATE_DIRECTORY_ONLY",
    "ASSISTED_LIVING_CENTER": "STATE_DIRECTORY_ONLY",
    "ADULT_FOSTER_CARE": "STATE_DIRECTORY_ONLY",
    "ADULT_DAY_HEALTH": "MARKET_INTELLIGENCE_ONLY",
    "rationale": "Exact LICENSE_NUMBER, public facility identity, phone/address, and GIS refreshability exist, but minting thousands of Arizona profile routes is not required. State page tables plus AZ Care Check and CMS CCN routes are enough."
  },
  "expansionLedger": {
    "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
    "NET_NEW_STATE_IDENTITIES": 2776,
    "EXISTING_ORGANIZATIONS_ENRICHED": 544,
    "NEW_EVIDENCE_ROWS": 2779,
    "note": "CMS Arizona CCNs already in the national graph are not net-new organizations. Exact state\u2194CMS crosswalk is not a new organization. STATE_DIRECTORY_ONLY means AL/AFC identities are measured as state identities, not minted as thousands of canonical profile routes.",
    "byClass": {
      "assistedLivingHome": {
        "existingBefore": 0,
        "sourceIdentitiesNow": 1719,
        "netNewStateIdentities": 1719,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 0
      },
      "assistedLivingCenter": {
        "existingBefore": 0,
        "sourceIdentitiesNow": 328,
        "netNewStateIdentities": 328,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 0
      },
      "adultFosterCare": {
        "existingBefore": 0,
        "sourceIdentitiesNow": 25,
        "netNewStateIdentities": 25,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 0
      },
      "adultDayHealth": {
        "existingBefore": 0,
        "sourceIdentitiesNow": 15,
        "netNewStateIdentities": 15,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 0
      },
      "stateNursingHome": {
        "existingBefore": 0,
        "sourceIdentitiesNow": 138,
        "netNewStateIdentities": 138,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 140
      },
      "cmsNursingHome": {
        "existingBefore": 140,
        "sourceIdentitiesNow": 140,
        "netNewStateIdentities": 0,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 140
      },
      "cmsHomeHealth": {
        "existingBefore": 177,
        "sourceIdentitiesNow": 177,
        "netNewStateIdentities": 0,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 172
      },
      "cmsHospice": {
        "existingBefore": 237,
        "sourceIdentitiesNow": 237,
        "netNewStateIdentities": 0,
        "promotedCanonicalOrganizations": 0,
        "enrichedExistingOrganizations": 232
      }
    }
  },
  "findings": [
    {
      "id": "al-home-scale",
      "title": "Assisted Living Homes are Arizona\u2019s large state-only residential class",
      "summary": "The ADHS GIS extract has 1,719 Assisted Living Homes versus 328 Assisted Living Centers. Homes are the small licensed setting (\u226410 residents). They are not in the national CMS Nursing Home directory.",
      "doesNotMean": [
        "best care",
        "quality rank",
        "safer than centers"
      ]
    },
    {
      "id": "home-vs-center",
      "title": "Assisted Living Home and Assisted Living Center stay separate",
      "summary": "Arizona statute splits assisted living by size. This snapshot keeps the source-native TYPE values. They are not one assisted-living total and are not Nursing Homes.",
      "doesNotMean": [
        "one combined Arizona senior-provider number"
      ]
    },
    {
      "id": "state-vs-cms-nh",
      "title": "State Nursing Home licenses and CMS Nursing Home CCNs are different identities",
      "summary": "ADHS Nursing Home rows use LICENSE_NUMBER. CMS uses CCN. Exact MEDICARE_ID matching is the only join. Assisted Living is not joined to CMS NH.",
      "doesNotMean": [
        "every assisted living home is a nursing home",
        "CMS certified equals state licensed"
      ]
    },
    {
      "id": "afc-state-only",
      "title": "Adult Foster Care is a small distinct state-only class",
      "summary": "ADHS lists 25 Adult Foster Care facilities on the GIS extract. That class is not Assisted Living Home, not Assisted Living Center, and not a Nursing Home.",
      "doesNotMean": [
        "Adult Foster Care is a CMS class"
      ]
    },
    {
      "id": "gis-clock",
      "title": "The acquired ADHS bulk clock is the GIS run date, not a September 2026 Excel table",
      "summary": "Monthly Excel/CSV tables were not on the current databases page. The GIS FeatureServer harvest used for class counts has RUN_DATE 2025-02-03. CMS Arizona overlays reuse the current national directories.",
      "doesNotMean": [
        "missing monthly Excel means zero licensed facilities"
      ]
    }
  ],
  "coverageGaps": [
    "Current first-business-day monthly Excel/CSV tables (post-LMS page has no downloadable files)",
    "AZ Care Check licensing-history / deficiency / enforcement bulk",
    "Licensee / operator / administrator bulk (interactive AZ Care Check only)",
    "Email and website (not on GIS)",
    "Independent license-in-good-standing flag beyond OPERATION_STATUS on the Feb 2025 GIS extract",
    "Service-area geography (address county is not a service area)"
  ],
  "verification": {
    "snapshot": "TrustHub ADHS GIS extract plus CMS Arizona class overlays",
    "live": "AZ Care Check and CMS Care Compare remain live verification paths. TrustHub does not scrape AZ Care Check."
  },
  "guardrails": [
    "ADHS != CMS",
    "STATE LICENSE != CMS CERTIFICATION",
    "ASSISTED LIVING HOME != ASSISTED LIVING CENTER",
    "ASSISTED LIVING != NURSING HOME",
    "ADULT FOSTER CARE != NURSING HOME",
    "HOME HEALTH != RESIDENTIAL CARE",
    "HOSPICE != HOME HEALTH",
    "FACILITY ADDRESS != SERVICE AREA",
    "LICENSE ROW != UNIQUE ORGANIZATION unless proven",
    "CROSSWALK != NEW ORGANIZATION",
    "COMPLAINT != VIOLATION",
    "DEFICIENCY != QUALITY RANK",
    "MISSING != ZERO",
    "NO TRUST SCORE",
    "NO PAID RANKING"
  ],
  "noCombinedDenominator": true,
  "publicationPath": "/arizona",
  "noCountyRoutes": true,
  "noCityRoutes": true,
  "fingerprint": "9f5d149051c58c88a4284c27594cf81de0912192d9b2c96397ed8af61dfc94a7"
} as const;
