/** Generated from artifacts/tx-sen-001-public-snapshot.json. Do not edit by hand. */
export const TX_PUBLIC_SNAPSHOT = {
  version: "senior-tx-state-intel-v1",
  asOf: "2026-09-04",
  retrievedAt: "2026-09-04T13:53:53Z",
  regulatorMap: {
    agency: "Texas Health and Human Services Commission",
    program: "Long-term Care Regulation (LTCR)",
    officialHub: "https://www.hhs.texas.gov/providers/long-term-care-providers",
    classes: [
      {
        id: "nf",
        officialName: "Nursing Facilities",
        cmsAnalog: "CMS Nursing Home / SNF",
        bulk: "NF.xlsx",
        note: "ALF != SNF. HHSC NF license is not the CMS CCN.",
      },
      {
        id: "alf",
        officialName: "Assisted Living Facilities (Type A / Type B / Type C as published)",
        cmsAnalog: null,
        bulk: "al.xlsx",
        note: "ALF is state-licensed. Not a CMS national class.",
      },
      {
        id: "hcssa",
        officialName: "Home and Community Support Services Agencies",
        cmsAnalog:
          "May overlap CMS Home Health or Hospice when certified; Personal Assistance is not CMS Home Health.",
        bulk: "HHA.xlsx",
        note: "HOME HEALTH != PERSONAL ASSISTANCE. HOSPICE != HOME HEALTH. HCSSA is the Texas license class.",
      },
      {
        id: "hospice_state",
        officialName: "Hospice (state HCSSA / hospice program)",
        cmsAnalog: "CMS Hospice",
        bulk: "inside HHA.xlsx when typed; otherwise TULIP",
        note: "HOSPICE != HOME HEALTH.",
      },
      {
        id: "dahs",
        officialName: "Day Activity and Health Services",
        cmsAnalog: null,
        bulk: null,
        note: "Adult daytime program. Not acquired as a bulk roster in this snapshot.",
      },
      {
        id: "icf",
        officialName: "Intermediate Care Facilities (ICF/IID)",
        cmsAnalog: null,
        bulk: null,
        note: "Not a senior-care CMS Nursing Home class. Not acquired as bulk here.",
      },
      {
        id: "ppecc",
        officialName: "Prescribed Pediatric Extended Care Center",
        cmsAnalog: null,
        bulk: null,
        note: "Pediatric. Excluded from the senior-care universe.",
      },
    ],
    tulip: {
      search: "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-search",
      how_to: "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-information",
      licensing: "https://tulip.hhs.texas.gov/TULIP/s/long-term-care-facility-agency-licensing",
      access: "OPEN_SEARCH_NO_LOGIN",
      scrape: "FORBIDDEN",
      note: "TULIP search result != complete bulk universe. Hospice and Home Health may serve counties other than the registered county. TULIP is licensing lookup, not an HHSC contract.",
    },
  },
  cmsOverlay: {
    nursingHomes: 1177,
    homeHealth: 1854,
    hospice: 1053,
    source: "senior-national-intelligence.json geography TX (CMS class directories)",
    asOf: "2026-08-27",
    nationalFingerprint: "215b9d6301a9759f53dd92324930803089d319f95fe5e46739cbbd5f326c3294",
    clocks: {
      nursingHomes: {
        sourceModifiedAt: "2026-08-01T00:00:00+00:00",
        retrievedAt: "2026-08-26T20:24:52.158102+00:00",
        officialUrl: "https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        cmsIdentifier: "4pq5-n9py",
      },
      homeHealth: {
        sourceModifiedAt: "2026-05-27T00:00:00+00:00",
        retrievedAt: "2026-08-26T21:08:16.274819+00:00",
        officialUrl: "https://data.cms.gov/provider-data/dataset/6jpm-sxkc",
        cmsIdentifier: "6jpm-sxkc",
      },
      hospice: {
        sourceModifiedAt: "2026-08-19T00:00:00+00:00",
        retrievedAt: "2026-08-26T22:15:06.243039+00:00",
        officialUrl: "https://data.cms.gov/provider-data/dataset/yc9t-dgbk",
        cmsIdentifier: "yc9t-dgbk",
      },
      ownership: {
        sourceModifiedAt: "2026-08-17T00:00:00+00:00",
        retrievedAt: "2026-08-26T20:25:26.251400+00:00",
        officialUrl:
          "https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-all-owners",
        cmsIdentifier: "afe44b85-cc6d-40d7-b5df-00ae8910d1d2",
      },
      penalties: {
        sourceModifiedAt: "2026-08-01T00:00:00+00:00",
        retrievedAt: "2026-08-26T20:24:35.184131+00:00",
        officialUrl: "https://data.cms.gov/provider-data/dataset/g6vv-u9sr",
        cmsIdentifier: "g6vv-u9sr",
      },
    },
    liveDirectoryTxUniqueCcn: {
      nursingHomes: 1177,
      homeHealth: 1854,
      hospice: 1053,
    },
    note: "CMS class overlays are independent of HHSC Excel row counts and are not summed. CMS CERTIFIED != STATE LICENSED.",
  },
  hhscNursingFacilities: {
    source_name: "Directory of all Texas nursing facilities",
    source_url: "https://apps.hhs.texas.gov/providers/directories/NF.xlsx",
    source_agency: "Texas Health and Human Services Commission",
    source_as_of: "2026-09-03",
    retrieved_at: "2026-09-04T13:53:53Z",
    source_file_hash: "6730ec151f81519c4f279ca26da88cfd14e184e2b20412b4de222bdc616f499f",
    row_grain: "HHSC nursing facility directory row (Facility ID / License Number)",
    identifier_fields: ["Facility ID", "License No", "Medicare Provider Number"],
    publication_eligibility: "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
    note: "HHSC NF directory is not the CMS Nursing Home overlay. Medicare Provider Number is used for exact CCN matching only.",
    title:
      "Texas Health and Human Services Commission Directory of Nursing Facilities with an Active License as of 09/03/2026",
    columns: [
      "Facility Name",
      "Facility ID",
      "Program Type",
      "State Region",
      "HHSC SubOffice",
      "County",
      "Service Type",
      "Facility Licensed",
      "Facility Certified",
      "License No",
      "License Effective Date",
      "License Expiration Date",
      "Initial License Date",
      "Physical Address",
      "Physical Address CITY",
      "Physical Address State",
      "Physical Address Zipcode",
      "Geo Location",
      "Facility Phone Number",
      "Facility Fax",
      "Medicare Provider Number",
      "Medicaid Provider Number",
      "Total Licensed Capacity",
      "Licensed Only Beds",
      "Medicaid Only Beds",
      "Medicare Only Beds",
      "Medicaid / Medicare Beds",
      "ICFIID Beds",
      "Alzheimer Capacity",
      "Alzheimer Certificate No",
      "Alzheimer Certificate Effective Date",
      "Alzheimer Expiration Date",
      "Owner_",
      "Type of Entity",
      "Owner Mailing1",
      "Owner Mailing City",
      "Owner Mailing STATE",
      "Owner Mailing Zipcode",
      "Owner PHONE",
      "Owner FAX",
      "Administrator",
      "Management Company_",
      "Provider Email",
    ],
    source_row_count: 1175,
    identifier_populated: 1175,
    unique_identifiers: 1175,
    native_ccn_populated: 1153,
    unique_native_ccn: 1153,
    phone_present: 1174,
    email_present: 1175,
    administrator_email_present: 0,
    address_present: 1175,
    county_present: 1175,
    by_type: [
      {
        label: "MEDICARE/MEDICAID",
        count: 1111,
      },
      {
        label: "MEDICARE ONLY",
        count: 40,
      },
      {
        label: "NF MEDICAID ONLY",
        count: 19,
      },
      {
        label: "NF LICENSED ONLY",
        count: 5,
      },
    ],
    by_status: [
      {
        label: "YES",
        count: 1175,
      },
    ],
    by_service: [],
    counties: [
      {
        county: "Harris",
        count: 94,
      },
      {
        county: "Dallas",
        count: 77,
      },
      {
        county: "Tarrant",
        count: 73,
      },
      {
        county: "Bexar",
        count: 62,
      },
      {
        county: "Travis",
        count: 28,
      },
      {
        county: "Collin",
        count: 26,
      },
      {
        county: "Hidalgo",
        count: 23,
      },
      {
        county: "El Paso",
        count: 22,
      },
      {
        county: "Denton",
        count: 19,
      },
      {
        county: "Mclennan",
        count: 18,
      },
      {
        county: "Smith",
        count: 17,
      },
      {
        county: "Bell",
        count: 15,
      },
      {
        county: "Lubbock",
        count: 15,
      },
      {
        county: "Williamson",
        count: 15,
      },
      {
        county: "Cameron",
        count: 14,
      },
      {
        county: "Fort Bend",
        count: 14,
      },
      {
        county: "Jefferson",
        count: 14,
      },
      {
        county: "Nueces",
        count: 14,
      },
      {
        county: "Brazoria",
        count: 13,
      },
      {
        county: "Wichita",
        count: 13,
      },
      {
        county: "Galveston",
        count: 12,
      },
      {
        county: "Gregg",
        count: 12,
      },
      {
        county: "Grayson",
        count: 11,
      },
      {
        county: "Taylor",
        count: 11,
      },
      {
        county: "Ellis",
        count: 10,
      },
      {
        county: "Montgomery",
        count: 10,
      },
      {
        county: "Johnson",
        count: 9,
      },
      {
        county: "Kaufman",
        count: 9,
      },
      {
        county: "Parker",
        count: 9,
      },
      {
        county: "Potter",
        count: 9,
      },
      {
        county: "Angelina",
        count: 8,
      },
      {
        county: "Guadalupe",
        count: 8,
      },
      {
        county: "Tom Green",
        count: 8,
      },
      {
        county: "Bowie",
        count: 7,
      },
      {
        county: "Brazos",
        count: 7,
      },
      {
        county: "Brown",
        count: 7,
      },
      {
        county: "Cherokee",
        count: 6,
      },
      {
        county: "Comal",
        count: 6,
      },
      {
        county: "Ector",
        count: 6,
      },
      {
        county: "Hays",
        count: 6,
      },
      {
        county: "Kendall",
        count: 6,
      },
      {
        county: "Lavaca",
        count: 6,
      },
      {
        county: "Navarro",
        count: 6,
      },
      {
        county: "Van Zandt",
        count: 6,
      },
      {
        county: "Anderson",
        count: 5,
      },
      {
        county: "Atascosa",
        count: 5,
      },
      {
        county: "Bastrop",
        count: 5,
      },
      {
        county: "Caldwell",
        count: 5,
      },
      {
        county: "Fannin",
        count: 5,
      },
      {
        county: "Fayette",
        count: 5,
      },
      {
        county: "Hardin",
        count: 5,
      },
      {
        county: "Henderson",
        count: 5,
      },
      {
        county: "Hunt",
        count: 5,
      },
      {
        county: "Lamar",
        count: 5,
      },
      {
        county: "Limestone",
        count: 5,
      },
      {
        county: "Midland",
        count: 5,
      },
      {
        county: "Rockwall",
        count: 5,
      },
      {
        county: "Webb",
        count: 5,
      },
      {
        county: "Wood",
        count: 5,
      },
      {
        county: "Cass",
        count: 4,
      },
      {
        county: "Colorado",
        count: 4,
      },
      {
        county: "Cooke",
        count: 4,
      },
      {
        county: "Coryell",
        count: 4,
      },
      {
        county: "Eastland",
        count: 4,
      },
      {
        county: "Gillespie",
        count: 4,
      },
      {
        county: "Hill",
        count: 4,
      },
      {
        county: "Hood",
        count: 4,
      },
      {
        county: "Hopkins",
        count: 4,
      },
      {
        county: "Kerr",
        count: 4,
      },
      {
        county: "Liberty",
        count: 4,
      },
      {
        county: "Nacogdoches",
        count: 4,
      },
      {
        county: "Polk",
        count: 4,
      },
      {
        county: "Rusk",
        count: 4,
      },
      {
        county: "Victoria",
        count: 4,
      },
      {
        county: "Washington",
        count: 4,
      },
      {
        county: "Wharton",
        count: 4,
      },
      {
        county: "Wilson",
        count: 4,
      },
      {
        county: "Wise",
        count: 4,
      },
      {
        county: "Bosque",
        count: 3,
      },
      {
        county: "Burnet",
        count: 3,
      },
      {
        county: "Comanche",
        count: 3,
      },
      {
        county: "Dewitt",
        count: 3,
      },
      {
        county: "Erath",
        count: 3,
      },
      {
        county: "Freestone",
        count: 3,
      },
      {
        county: "Gray",
        count: 3,
      },
      {
        county: "Hamilton",
        count: 3,
      },
      {
        county: "Harrison",
        count: 3,
      },
      {
        county: "Houston",
        count: 3,
      },
      {
        county: "Howard",
        count: 3,
      },
      {
        county: "Jasper",
        count: 3,
      },
      {
        county: "Jim Wells",
        count: 3,
      },
      {
        county: "Karnes",
        count: 3,
      },
      {
        county: "Lampasas",
        count: 3,
      },
      {
        county: "Llano",
        count: 3,
      },
      {
        county: "Matagorda",
        count: 3,
      },
      {
        county: "Maverick",
        count: 3,
      },
      {
        county: "Medina",
        count: 3,
      },
      {
        county: "Milam",
        count: 3,
      },
      {
        county: "Orange",
        count: 3,
      },
      {
        county: "Panola",
        count: 3,
      },
      {
        county: "Randall",
        count: 3,
      },
      {
        county: "Robertson",
        count: 3,
      },
      {
        county: "San Augustine",
        count: 3,
      },
      {
        county: "Shelby",
        count: 3,
      },
      {
        county: "Titus",
        count: 3,
      },
      {
        county: "Trinity",
        count: 3,
      },
      {
        county: "Val Verde",
        count: 3,
      },
      {
        county: "Walker",
        count: 3,
      },
      {
        county: "Young",
        count: 3,
      },
      {
        county: "Aransas",
        count: 2,
      },
      {
        county: "Austin",
        count: 2,
      },
      {
        county: "Bandera",
        count: 2,
      },
      {
        county: "Bee",
        count: 2,
      },
      {
        county: "Burleson",
        count: 2,
      },
      {
        county: "Calhoun",
        count: 2,
      },
      {
        county: "Callahan",
        count: 2,
      },
      {
        county: "Castro",
        count: 2,
      },
      {
        county: "Chambers",
        count: 2,
      },
      {
        county: "Coke",
        count: 2,
      },
      {
        county: "Coleman",
        count: 2,
      },
      {
        county: "Crosby",
        count: 2,
      },
      {
        county: "Falls",
        count: 2,
      },
      {
        county: "Gonzales",
        count: 2,
      },
      {
        county: "Grimes",
        count: 2,
      },
      {
        county: "Hale",
        count: 2,
      },
      {
        county: "Hockley",
        count: 2,
      },
      {
        county: "Hutchinson",
        count: 2,
      },
      {
        county: "Jackson",
        count: 2,
      },
      {
        county: "Jones",
        count: 2,
      },
      {
        county: "Kleberg",
        count: 2,
      },
      {
        county: "Knox",
        count: 2,
      },
      {
        county: "Lamb",
        count: 2,
      },
      {
        county: "Lee",
        count: 2,
      },
      {
        county: "Madison",
        count: 2,
      },
      {
        county: "Mills",
        count: 2,
      },
      {
        county: "Montague",
        count: 2,
      },
      {
        county: "Moore",
        count: 2,
      },
      {
        county: "Nolan",
        count: 2,
      },
      {
        county: "Palo Pinto",
        count: 2,
      },
      {
        county: "Parmer",
        count: 2,
      },
      {
        county: "Red River",
        count: 2,
      },
      {
        county: "Runnels",
        count: 2,
      },
      {
        county: "Sabine",
        count: 2,
      },
      {
        county: "San Patricio",
        count: 2,
      },
      {
        county: "Somervell",
        count: 2,
      },
      {
        county: "Starr",
        count: 2,
      },
      {
        county: "Terry",
        count: 2,
      },
      {
        county: "Tyler",
        count: 2,
      },
      {
        county: "Upshur",
        count: 2,
      },
      {
        county: "Uvalde",
        count: 2,
      },
      {
        county: "Waller",
        count: 2,
      },
      {
        county: "Andrews",
        count: 1,
      },
      {
        county: "Armstrong",
        count: 1,
      },
      {
        county: "Bailey",
        count: 1,
      },
      {
        county: "Baylor",
        count: 1,
      },
      {
        county: "Blanco",
        count: 1,
      },
      {
        county: "Brooks",
        count: 1,
      },
      {
        county: "Camp",
        count: 1,
      },
      {
        county: "Childress",
        count: 1,
      },
      {
        county: "Clay",
        count: 1,
      },
      {
        county: "Collingsworth",
        count: 1,
      },
      {
        county: "Concho",
        count: 1,
      },
      {
        county: "Crane",
        count: 1,
      },
      {
        county: "Crockett",
        count: 1,
      },
      {
        county: "Dallam",
        count: 1,
      },
      {
        county: "Dawson",
        count: 1,
      },
      {
        county: "Deaf Smith",
        count: 1,
      },
      {
        county: "Delta",
        count: 1,
      },
      {
        county: "Dimmit",
        count: 1,
      },
      {
        county: "Donley",
        count: 1,
      },
      {
        county: "Duval",
        count: 1,
      },
      {
        county: "Foard",
        count: 1,
      },
      {
        county: "Franklin",
        count: 1,
      },
      {
        county: "Frio",
        count: 1,
      },
      {
        county: "Gaines",
        count: 1,
      },
      {
        county: "Garza",
        count: 1,
      },
      {
        county: "Goliad",
        count: 1,
      },
      {
        county: "Hall",
        count: 1,
      },
      {
        county: "Hansford",
        count: 1,
      },
      {
        county: "Haskell",
        count: 1,
      },
      {
        county: "Hemphill",
        count: 1,
      },
      {
        county: "Jack",
        count: 1,
      },
      {
        county: "Jim Hogg",
        count: 1,
      },
      {
        county: "Kent",
        count: 1,
      },
      {
        county: "La Salle",
        count: 1,
      },
      {
        county: "Leon",
        count: 1,
      },
      {
        county: "Lipscomb",
        count: 1,
      },
      {
        county: "Live Oak",
        count: 1,
      },
      {
        county: "Marion",
        count: 1,
      },
      {
        county: "Mcculloch",
        count: 1,
      },
      {
        county: "Menard",
        count: 1,
      },
      {
        county: "Mitchell",
        count: 1,
      },
      {
        county: "Morris",
        count: 1,
      },
      {
        county: "Motley",
        count: 1,
      },
      {
        county: "Newton",
        count: 1,
      },
      {
        county: "Ochiltree",
        count: 1,
      },
      {
        county: "Pecos",
        count: 1,
      },
      {
        county: "Rains",
        count: 1,
      },
      {
        county: "Reagan",
        count: 1,
      },
      {
        county: "Real",
        count: 1,
      },
      {
        county: "Reeves",
        count: 1,
      },
      {
        county: "Refugio",
        count: 1,
      },
      {
        county: "San Jacinto",
        count: 1,
      },
      {
        county: "San Saba",
        count: 1,
      },
      {
        county: "Schleicher",
        count: 1,
      },
      {
        county: "Scurry",
        count: 1,
      },
      {
        county: "Sherman",
        count: 1,
      },
      {
        county: "Stephens",
        count: 1,
      },
      {
        county: "Sterling",
        count: 1,
      },
      {
        county: "Stonewall",
        count: 1,
      },
      {
        county: "Upton",
        count: 1,
      },
      {
        county: "Ward",
        count: 1,
      },
      {
        county: "Wheeler",
        count: 1,
      },
      {
        county: "Wilbarger",
        count: 1,
      },
      {
        county: "Willacy",
        count: 1,
      },
      {
        county: "Yoakum",
        count: 1,
      },
      {
        county: "Zapata",
        count: 1,
      },
    ],
    alzheimer_certificate: 31,
    owner_present: 1174,
    administrator_present: 1175,
    management_present: 1046,
    certified_yes: 1169,
    licensed_yes: 1175,
  },
  hhscHospitalBasedNf: {
    source_name: "Directory of all Hospital-based Texas nursing facilities",
    source_url: "https://apps.hhs.texas.gov/providers/directories/HospNF.xlsx",
    source_file_hash: "707a58d0a5fed66837e9ed4906ffd5d49aa23d02ee8d12aa36c6f427bff91d67",
    publication_eligibility: "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
    note: "Sibling directory. Not added to NF.xlsx. Not a combined nursing-facility total.",
    title:
      "Texas Health and Human Services Commission Directory of Hospital Based Nursing Facility Providers with an Active License as of 09/03/2026",
    source_as_of: "2026-09-03",
    columns: [
      "Facility Name",
      "Facility ID",
      "Program Type",
      "State Region",
      "HHSC SubOffice",
      "County",
      "Service Type",
      "Facility Licensed",
      "Facility Certified",
      "License No",
      "License Effective Date",
      "License Expiration Date",
      "Initial License Date",
      "Physical Address",
      "Physical Address CITY",
      "Physical Address State",
      "Physical Address Zipcode",
      "Facility Phone Number",
      "Facility Fax",
      "Total Licensed Capacity",
      "Licensed Only Beds",
      "Medicaid Only Beds",
      "Medicare Only Beds",
      "Medicaid / Medicare Beds",
      "Alzheimer Capacity",
      "ICFIID Beds",
      "Owner",
      "Type of Entity",
      "Owner Mailing1",
      "Owner Mailing City",
      "Owner Mailing STATE",
      "Owner Mailing Zipcode",
      "Owner PHONE",
      "Owner FAX",
    ],
    source_row_count: 6,
    identifier_populated: 6,
    unique_identifiers: 6,
    native_ccn_populated: 0,
    unique_native_ccn: 0,
    phone_present: 5,
    email_present: 0,
    administrator_email_present: 0,
    address_present: 6,
    county_present: 6,
    by_type: [
      {
        label: "HOSPITAL-BASED SNF",
        count: 6,
      },
    ],
    by_status: [
      {
        label: "NO",
        count: 6,
      },
    ],
    by_service: [],
    counties: [
      {
        county: "Harris",
        count: 2,
      },
      {
        county: "Bell",
        count: 1,
      },
      {
        county: "Fort Bend",
        count: 1,
      },
      {
        county: "Taylor",
        count: 1,
      },
      {
        county: "Webb",
        count: 1,
      },
    ],
    alzheimer_certificate: 0,
    owner_present: 0,
    administrator_present: 0,
    management_present: 0,
    certified_yes: 6,
    licensed_yes: 0,
  },
  hhscAssistedLiving: {
    source_name: "Directory of all ALFs",
    source_url: "https://apps.hhs.texas.gov/providers/directories/al.xlsx",
    source_agency: "Texas Health and Human Services Commission",
    source_as_of: "2026-09-03",
    retrieved_at: "2026-09-04T13:53:53Z",
    source_file_hash: "37e13b002875d09a0c340da8eaf405fea75fcba10af77cb8c42816d2f22b4d4b",
    row_grain: "HHSC Assisted Living Facility (Facility ID / License Number)",
    identifier_fields: ["Facility ID", "License No"],
    publication_eligibility: "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
    note: "ALF != SNF. Alzheimer's Certified is an official directory field when present. Never infer from a facility name. Existing /assisted-living/texas landing uses this directory family; this page does not mint thousands of new profiles.",
    title:
      "Texas Health and Human Services Commission Directory of Assisted Living Facility Providers with an Active License as of 09/03/2026",
    columns: [
      "Facility Name",
      "Facility ID",
      "Program Type",
      "State Region",
      "HHSC SubOffice",
      "County",
      "Service Type",
      "Facility Licensed",
      "Facility Certified",
      "License No",
      "License Effective Date",
      "License Expiration Date",
      "Initial License Date",
      "Physical Address",
      "Physical Address CITY",
      "Physical Address State",
      "Physical Address Zipcode",
      "Geo Location",
      "Facility Phone Number",
      "Facility Fax",
      "Medicare Provider Number",
      "Medicaid Provider Number",
      "Total Licensed Capacity",
      "Licensed Only Beds",
      "Medicaid Only Beds",
      "Medicare Only Beds",
      "Medicaid / Medicare Beds",
      "ICFIID Beds",
      "Alzheimer Capacity",
      "Alzheimer Certificate No",
      "Alzheimer Certificate Effective Date",
      "Alzheimer Expiration Date",
      "Owner_",
      "Type of Entity",
      "Owner Mailing1",
      "Owner Mailing City",
      "Owner Mailing STATE",
      "Owner Mailing Zipcode",
      "Owner PHONE",
      "Owner FAX",
      "Administrator",
      "Management Company_",
      "Provider Email",
    ],
    source_row_count: 2000,
    identifier_populated: 2000,
    unique_identifiers: 2000,
    native_ccn_populated: 0,
    unique_native_ccn: 0,
    phone_present: 1941,
    email_present: 1998,
    administrator_email_present: 0,
    address_present: 2000,
    county_present: 2000,
    by_type: [
      {
        label: "TYPE B",
        count: 1655,
      },
      {
        label: "TYPE A",
        count: 337,
      },
      {
        label: "TYPE C",
        count: 8,
      },
    ],
    by_status: [
      {
        label: "YES",
        count: 2000,
      },
    ],
    by_service: [],
    counties: [
      {
        county: "Harris",
        count: 276,
      },
      {
        county: "Dallas",
        count: 192,
      },
      {
        county: "Bexar",
        count: 148,
      },
      {
        county: "Tarrant",
        count: 144,
      },
      {
        county: "Collin",
        count: 124,
      },
      {
        county: "Denton",
        count: 109,
      },
      {
        county: "Fort Bend",
        count: 92,
      },
      {
        county: "Montgomery",
        count: 89,
      },
      {
        county: "Travis",
        count: 72,
      },
      {
        county: "Williamson",
        count: 60,
      },
      {
        county: "Lubbock",
        count: 49,
      },
      {
        county: "El Paso",
        count: 31,
      },
      {
        county: "Brazoria",
        count: 30,
      },
      {
        county: "Galveston",
        count: 30,
      },
      {
        county: "Hays",
        count: 20,
      },
      {
        county: "Smith",
        count: 20,
      },
      {
        county: "Comal",
        count: 16,
      },
      {
        county: "Hidalgo",
        count: 16,
      },
      {
        county: "Jefferson",
        count: 15,
      },
      {
        county: "Mclennan",
        count: 15,
      },
      {
        county: "Brazos",
        count: 14,
      },
      {
        county: "Grayson",
        count: 13,
      },
      {
        county: "Johnson",
        count: 13,
      },
      {
        county: "Ellis",
        count: 12,
      },
      {
        county: "Nueces",
        count: 12,
      },
      {
        county: "Potter",
        count: 12,
      },
      {
        county: "Gregg",
        count: 11,
      },
      {
        county: "Parker",
        count: 11,
      },
      {
        county: "Taylor",
        count: 11,
      },
      {
        county: "Bell",
        count: 10,
      },
      {
        county: "Bowie",
        count: 10,
      },
      {
        county: "Guadalupe",
        count: 10,
      },
      {
        county: "Waller",
        count: 10,
      },
      {
        county: "Hood",
        count: 8,
      },
      {
        county: "Rockwall",
        count: 8,
      },
      {
        county: "Tom Green",
        count: 8,
      },
      {
        county: "Cameron",
        count: 7,
      },
      {
        county: "Gillespie",
        count: 7,
      },
      {
        county: "Kerr",
        count: 7,
      },
      {
        county: "Medina",
        count: 7,
      },
      {
        county: "Titus",
        count: 7,
      },
      {
        county: "Henderson",
        count: 6,
      },
      {
        county: "Hunt",
        count: 6,
      },
      {
        county: "Kendall",
        count: 6,
      },
      {
        county: "Randall",
        count: 6,
      },
      {
        county: "Victoria",
        count: 6,
      },
      {
        county: "Wichita",
        count: 6,
      },
      {
        county: "Wood",
        count: 6,
      },
      {
        county: "Burnet",
        count: 5,
      },
      {
        county: "Caldwell",
        count: 5,
      },
      {
        county: "Lamar",
        count: 5,
      },
      {
        county: "Montague",
        count: 5,
      },
      {
        county: "Polk",
        count: 5,
      },
      {
        county: "Van Zandt",
        count: 5,
      },
      {
        county: "Cherokee",
        count: 4,
      },
      {
        county: "Llano",
        count: 4,
      },
      {
        county: "Midland",
        count: 4,
      },
      {
        county: "Walker",
        count: 4,
      },
      {
        county: "Washington",
        count: 4,
      },
      {
        county: "Anderson",
        count: 3,
      },
      {
        county: "Angelina",
        count: 3,
      },
      {
        county: "Austin",
        count: 3,
      },
      {
        county: "Bastrop",
        count: 3,
      },
      {
        county: "Brown",
        count: 3,
      },
      {
        county: "Coryell",
        count: 3,
      },
      {
        county: "Ector",
        count: 3,
      },
      {
        county: "Erath",
        count: 3,
      },
      {
        county: "Hopkins",
        count: 3,
      },
      {
        county: "Kaufman",
        count: 3,
      },
      {
        county: "Liberty",
        count: 3,
      },
      {
        county: "Nacogdoches",
        count: 3,
      },
      {
        county: "Panola",
        count: 3,
      },
      {
        county: "Scurry",
        count: 3,
      },
      {
        county: "Colorado",
        count: 2,
      },
      {
        county: "Cooke",
        count: 2,
      },
      {
        county: "Dewitt",
        count: 2,
      },
      {
        county: "Fannin",
        count: 2,
      },
      {
        county: "Fayette",
        count: 2,
      },
      {
        county: "Gonzales",
        count: 2,
      },
      {
        county: "Hale",
        count: 2,
      },
      {
        county: "Hamilton",
        count: 2,
      },
      {
        county: "Hardin",
        count: 2,
      },
      {
        county: "Harrison",
        count: 2,
      },
      {
        county: "Hill",
        count: 2,
      },
      {
        county: "Hockley",
        count: 2,
      },
      {
        county: "Jackson",
        count: 2,
      },
      {
        county: "Jasper",
        count: 2,
      },
      {
        county: "Jim Wells",
        count: 2,
      },
      {
        county: "Lamb",
        count: 2,
      },
      {
        county: "Lampasas",
        count: 2,
      },
      {
        county: "Lavaca",
        count: 2,
      },
      {
        county: "Madison",
        count: 2,
      },
      {
        county: "Matagorda",
        count: 2,
      },
      {
        county: "Navarro",
        count: 2,
      },
      {
        county: "Orange",
        count: 2,
      },
      {
        county: "Palo Pinto",
        count: 2,
      },
      {
        county: "Rusk",
        count: 2,
      },
      {
        county: "Upshur",
        count: 2,
      },
      {
        county: "Uvalde",
        count: 2,
      },
      {
        county: "Val Verde",
        count: 2,
      },
      {
        county: "Wharton",
        count: 2,
      },
      {
        county: "Wilson",
        count: 2,
      },
      {
        county: "Wise",
        count: 2,
      },
      {
        county: "Young",
        count: 2,
      },
      {
        county: "Andrews",
        count: 1,
      },
      {
        county: "Aransas",
        count: 1,
      },
      {
        county: "Armstrong",
        count: 1,
      },
      {
        county: "Atascosa",
        count: 1,
      },
      {
        county: "Baylor",
        count: 1,
      },
      {
        county: "Bee",
        count: 1,
      },
      {
        county: "Bosque",
        count: 1,
      },
      {
        county: "Burleson",
        count: 1,
      },
      {
        county: "Calhoun",
        count: 1,
      },
      {
        county: "Camp",
        count: 1,
      },
      {
        county: "Cass",
        count: 1,
      },
      {
        county: "Childress",
        count: 1,
      },
      {
        county: "Comanche",
        count: 1,
      },
      {
        county: "Dallam",
        count: 1,
      },
      {
        county: "Dawson",
        count: 1,
      },
      {
        county: "Donley",
        count: 1,
      },
      {
        county: "Eastland",
        count: 1,
      },
      {
        county: "Fisher",
        count: 1,
      },
      {
        county: "Floyd",
        count: 1,
      },
      {
        county: "Franklin",
        count: 1,
      },
      {
        county: "Frio",
        count: 1,
      },
      {
        county: "Gaines",
        count: 1,
      },
      {
        county: "Gray",
        count: 1,
      },
      {
        county: "Grimes",
        count: 1,
      },
      {
        county: "Hemphill",
        count: 1,
      },
      {
        county: "Houston",
        count: 1,
      },
      {
        county: "Howard",
        count: 1,
      },
      {
        county: "Hutchinson",
        count: 1,
      },
      {
        county: "Jack",
        count: 1,
      },
      {
        county: "Lee",
        count: 1,
      },
      {
        county: "Limestone",
        count: 1,
      },
      {
        county: "Lynn",
        count: 1,
      },
      {
        county: "Marion",
        count: 1,
      },
      {
        county: "Mcculloch",
        count: 1,
      },
      {
        county: "Morris",
        count: 1,
      },
      {
        county: "Nolan",
        count: 1,
      },
      {
        county: "Ochiltree",
        count: 1,
      },
      {
        county: "San Augustine",
        count: 1,
      },
      {
        county: "San Jacinto",
        count: 1,
      },
      {
        county: "San Patricio",
        count: 1,
      },
      {
        county: "Shelby",
        count: 1,
      },
      {
        county: "Swisher",
        count: 1,
      },
      {
        county: "Terry",
        count: 1,
      },
      {
        county: "Travis Country",
        count: 1,
      },
      {
        county: "Tyler",
        count: 1,
      },
      {
        county: "Wheeler",
        count: 1,
      },
      {
        county: "Wilbarger",
        count: 1,
      },
      {
        county: "Willacy",
        count: 1,
      },
    ],
    alzheimer_certificate: 731,
    owner_present: 2000,
    administrator_present: 2000,
    management_present: 769,
    certified_yes: 1,
    licensed_yes: 2000,
  },
  hhscHcssa: {
    source_name: "HCSSA providers directory",
    source_url: "https://apps.hhs.texas.gov/providers/directories/HHA.xlsx",
    source_agency: "Texas Health and Human Services Commission",
    source_as_of: "2026-09-03",
    retrieved_at: "2026-09-04T13:53:53Z",
    source_file_hash: "2de0b99b78439ca5c66db3e810155fcf78a336a94dec8e35117ba1afdabb5524",
    row_grain: "HHSC Home and Community Support Services Agency directory row (License No)",
    identifier_fields: ["License No", "Medicare Number"],
    publication_eligibility: "PUBLIC_STATE_PAGE_SOURCE_LEVEL",
    service_type_labels: ["Parent Agency", "Branch Agency", "Alternate Delivery Site"],
    service_labels: [
      "Personal Assistance Services",
      "Licensed Home Health Services",
      "Licensed and Certified Home Health Services",
      "Hospice",
      "Hospice Alternative Delivery Site (ADS)",
      "Licensed Home Health Services with Dialysis",
      "Alternative Delivery Site (ADS)",
      "Licensed and Certified Home Health Services with Dialysis",
    ],
    note: "HHA.xlsx is the HCSSA directory filename, not a CMS Home Health extract. HOME HEALTH != PERSONAL ASSISTANCE. HOSPICE != HOME HEALTH. Office/registered county is not a service area.",
    title:
      "Texas Health and Human Services Commission Directory of Home and Community Support Services Agencies (HCSSA) with an Active License as of 09/03/2026",
    columns: [
      "Agency",
      "License No",
      "Medicare Number",
      "Agency Address",
      "Agency Address City",
      "Agency Address State",
      "Agency Address Zipcode",
      "Geo Location",
      "County",
      "State Region",
      "Agency Phone",
      "Agency FAX",
      "Agency Type",
      "Administrator",
      "Administrator Email",
      "Alternate Administrator",
      "Services Provided",
      "Current client census",
      "License Status",
      "License Expiration Date",
      "Date First License Issued",
      "Legal Entity",
      "Legal Entity Mailing Address1",
      "Legal Entity Mailing City",
      "Legal Entity Mailing State",
      "Legal Entity Mailing Zipcode",
      "Legal Entity PHONE",
      "Legal Entity FAX",
      "Inpatient Unit",
    ],
    source_row_count: 8799,
    identifier_populated: 8799,
    unique_identifiers: 7743,
    native_ccn_populated: 3275,
    unique_native_ccn: 2795,
    phone_present: 8799,
    email_present: 0,
    administrator_email_present: 8460,
    address_present: 8797,
    county_present: 8799,
    by_type: [
      {
        label: "Parent Agency",
        count: 7743,
      },
      {
        label: "Branch Agency",
        count: 643,
      },
      {
        label: "Alternate Delivery Site",
        count: 413,
      },
    ],
    by_status: [
      {
        label: "LICENSED FACILITY",
        count: 7481,
      },
      {
        label: "ENFORCEMENT ACTION PEND",
        count: 1151,
      },
      {
        label: "EXPIRED",
        count: 88,
      },
      {
        label: "RENEWAL IN PROCESS",
        count: 79,
      },
    ],
    by_service: [
      {
        label: "Personal Assistance Services",
        count: 6035,
      },
      {
        label: "Licensed Home Health Services",
        count: 3608,
      },
      {
        label: "Licensed and Certified Home Health Services",
        count: 2048,
      },
      {
        label: "Hospice",
        count: 1538,
      },
      {
        label: "Hospice Alternative Delivery Site (ADS)",
        count: 207,
      },
      {
        label: "Licensed Home Health Services with Dialysis",
        count: 42,
      },
      {
        label: "Alternative Delivery Site (ADS)",
        count: 16,
      },
      {
        label: "Licensed and Certified Home Health Services with Dialysis",
        count: 2,
      },
    ],
    counties: [
      {
        county: "Harris",
        count: 1617,
      },
      {
        county: "Dallas",
        count: 1118,
      },
      {
        county: "Fort Bend",
        count: 677,
      },
      {
        county: "Tarrant",
        count: 588,
      },
      {
        county: "Bexar",
        count: 506,
      },
      {
        county: "Hidalgo",
        count: 468,
      },
      {
        county: "Collin",
        count: 417,
      },
      {
        county: "El Paso",
        count: 242,
      },
      {
        county: "Denton",
        count: 229,
      },
      {
        county: "Cameron",
        count: 223,
      },
      {
        county: "Travis",
        count: 216,
      },
      {
        county: "Montgomery",
        count: 158,
      },
      {
        county: "Webb",
        count: 128,
      },
      {
        county: "Williamson",
        count: 112,
      },
      {
        county: "Brazoria",
        count: 104,
      },
      {
        county: "Nueces",
        count: 102,
      },
      {
        county: "Jefferson",
        count: 82,
      },
      {
        county: "Smith",
        count: 73,
      },
      {
        county: "Kaufman",
        count: 64,
      },
      {
        county: "Lubbock",
        count: 64,
      },
      {
        county: "Bell",
        count: 62,
      },
      {
        county: "Grayson",
        count: 55,
      },
      {
        county: "Galveston",
        count: 51,
      },
      {
        county: "Gregg",
        count: 49,
      },
      {
        county: "Rockwall",
        count: 46,
      },
      {
        county: "Ellis",
        count: 45,
      },
      {
        county: "Mclennan",
        count: 44,
      },
      {
        county: "Brazos",
        count: 42,
      },
      {
        county: "Comal",
        count: 42,
      },
      {
        county: "Hays",
        count: 42,
      },
      {
        county: "Taylor",
        count: 42,
      },
      {
        county: "Johnson",
        count: 38,
      },
      {
        county: "Potter",
        count: 38,
      },
      {
        county: "Wichita",
        count: 37,
      },
      {
        county: "Hunt",
        count: 31,
      },
      {
        county: "Starr",
        count: 31,
      },
      {
        county: "Angelina",
        count: 30,
      },
      {
        county: "Tom Green",
        count: 29,
      },
      {
        county: "Lamar",
        count: 27,
      },
      {
        county: "Midland",
        count: 27,
      },
      {
        county: "Bowie",
        count: 25,
      },
      {
        county: "Maverick",
        count: 25,
      },
      {
        county: "Ector",
        count: 24,
      },
      {
        county: "Jim Wells",
        count: 24,
      },
      {
        county: "Parker",
        count: 24,
      },
      {
        county: "Hood",
        count: 23,
      },
      {
        county: "Victoria",
        count: 23,
      },
      {
        county: "Waller",
        count: 23,
      },
      {
        county: "Val Verde",
        count: 22,
      },
      {
        county: "Brown",
        count: 16,
      },
      {
        county: "Henderson",
        count: 16,
      },
      {
        county: "Anderson",
        count: 14,
      },
      {
        county: "Burnet",
        count: 14,
      },
      {
        county: "Kerr",
        count: 14,
      },
      {
        county: "Walker",
        count: 14,
      },
      {
        county: "Jasper",
        count: 13,
      },
      {
        county: "Kendall",
        count: 13,
      },
      {
        county: "Orange",
        count: 13,
      },
      {
        county: "Wise",
        count: 13,
      },
      {
        county: "Hopkins",
        count: 12,
      },
      {
        county: "Bastrop",
        count: 11,
      },
      {
        county: "Navarro",
        count: 11,
      },
      {
        county: "Nacogdoches",
        count: 10,
      },
      {
        county: "Polk",
        count: 10,
      },
      {
        county: "Randall",
        count: 10,
      },
      {
        county: "Rusk",
        count: 10,
      },
      {
        county: "Wharton",
        count: 10,
      },
      {
        county: "Harrison",
        count: 9,
      },
      {
        county: "Howard",
        count: 9,
      },
      {
        county: "Cooke",
        count: 8,
      },
      {
        county: "Guadalupe",
        count: 8,
      },
      {
        county: "Hale",
        count: 8,
      },
      {
        county: "Kleberg",
        count: 8,
      },
      {
        county: "Washington",
        count: 8,
      },
      {
        county: "Erath",
        count: 7,
      },
      {
        county: "Gillespie",
        count: 7,
      },
      {
        county: "Liberty",
        count: 7,
      },
      {
        county: "Medina",
        count: 7,
      },
      {
        county: "Titus",
        count: 7,
      },
      {
        county: "Uvalde",
        count: 7,
      },
      {
        county: "Young",
        count: 7,
      },
      {
        county: "Austin",
        count: 6,
      },
      {
        county: "Bee",
        count: 6,
      },
      {
        county: "Duval",
        count: 6,
      },
      {
        county: "Eastland",
        count: 6,
      },
      {
        county: "Cass",
        count: 5,
      },
      {
        county: "Coryell",
        count: 5,
      },
      {
        county: "Frio",
        count: 5,
      },
      {
        county: "Matagorda",
        count: 5,
      },
      {
        county: "Palo Pinto",
        count: 5,
      },
      {
        county: "San Patricio",
        count: 5,
      },
      {
        county: "Shelby",
        count: 5,
      },
      {
        county: "Brooks",
        count: 4,
      },
      {
        county: "Chambers",
        count: 4,
      },
      {
        county: "Fayette",
        count: 4,
      },
      {
        county: "Freestone",
        count: 4,
      },
      {
        county: "Gray",
        count: 4,
      },
      {
        county: "Hamilton",
        count: 4,
      },
      {
        county: "Hill",
        count: 4,
      },
      {
        county: "Hockley",
        count: 4,
      },
      {
        county: "Jim Hogg",
        count: 4,
      },
      {
        county: "Lavaca",
        count: 4,
      },
      {
        county: "Montague",
        count: 4,
      },
      {
        county: "Stephens",
        count: 4,
      },
      {
        county: "Terry",
        count: 4,
      },
      {
        county: "Van Zandt",
        count: 4,
      },
      {
        county: "Wilbarger",
        count: 4,
      },
      {
        county: "Willacy",
        count: 4,
      },
      {
        county: "Zapata",
        count: 4,
      },
      {
        county: "Andrews",
        count: 3,
      },
      {
        county: "Aransas",
        count: 3,
      },
      {
        county: "Atascosa",
        count: 3,
      },
      {
        county: "Camp",
        count: 3,
      },
      {
        county: "Cherokee",
        count: 3,
      },
      {
        county: "Childress",
        count: 3,
      },
      {
        county: "Fannin",
        count: 3,
      },
      {
        county: "Franklin",
        count: 3,
      },
      {
        county: "Gonzales",
        count: 3,
      },
      {
        county: "Houston",
        count: 3,
      },
      {
        county: "Milam",
        count: 3,
      },
      {
        county: "Runnels",
        count: 3,
      },
      {
        county: "Scurry",
        count: 3,
      },
      {
        county: "Tyler",
        count: 3,
      },
      {
        county: "Wilson",
        count: 3,
      },
      {
        county: "Wood",
        count: 3,
      },
      {
        county: "Zavala",
        count: 3,
      },
      {
        county: "Baylor",
        count: 2,
      },
      {
        county: "Bosque",
        count: 2,
      },
      {
        county: "Brewster",
        count: 2,
      },
      {
        county: "Calhoun",
        count: 2,
      },
      {
        county: "Dawson",
        count: 2,
      },
      {
        county: "Dewitt",
        count: 2,
      },
      {
        county: "Falls",
        count: 2,
      },
      {
        county: "Hemphill",
        count: 2,
      },
      {
        county: "Hutchinson",
        count: 2,
      },
      {
        county: "Jackson",
        count: 2,
      },
      {
        county: "Lampasas",
        count: 2,
      },
      {
        county: "Madison",
        count: 2,
      },
      {
        county: "Marion",
        count: 2,
      },
      {
        county: "Nolan",
        count: 2,
      },
      {
        county: "Ochiltree",
        count: 2,
      },
      {
        county: "Panola",
        count: 2,
      },
      {
        county: "Red River",
        count: 2,
      },
      {
        county: "Robertson",
        count: 2,
      },
      {
        county: "Sabine",
        count: 2,
      },
      {
        county: "Somervell",
        count: 2,
      },
      {
        county: "Bandera",
        count: 1,
      },
      {
        county: "Clay",
        count: 1,
      },
      {
        county: "Coleman",
        count: 1,
      },
      {
        county: "Collingsworth",
        count: 1,
      },
      {
        county: "Colorado",
        count: 1,
      },
      {
        county: "Crosby",
        count: 1,
      },
      {
        county: "Deaf Smith",
        count: 1,
      },
      {
        county: "Dimmit",
        count: 1,
      },
      {
        county: "Donley",
        count: 1,
      },
      {
        county: "Garza",
        count: 1,
      },
      {
        county: "Grimes",
        count: 1,
      },
      {
        county: "Hansford",
        count: 1,
      },
      {
        county: "Hardin",
        count: 1,
      },
      {
        county: "Hartley",
        count: 1,
      },
      {
        county: "Haskell",
        count: 1,
      },
      {
        county: "Jack",
        count: 1,
      },
      {
        county: "Jim Wells County",
        count: 1,
      },
      {
        county: "Jones",
        count: 1,
      },
      {
        county: "Karnes",
        count: 1,
      },
      {
        county: "Knox",
        count: 1,
      },
      {
        county: "Lamb",
        count: 1,
      },
      {
        county: "Lee",
        count: 1,
      },
      {
        county: "Leon",
        count: 1,
      },
      {
        county: "Limestone",
        count: 1,
      },
      {
        county: "Llano",
        count: 1,
      },
      {
        county: "Mason",
        count: 1,
      },
      {
        county: "Mcclennan",
        count: 1,
      },
      {
        county: "Mcculloch",
        count: 1,
      },
      {
        county: "Mills",
        count: 1,
      },
      {
        county: "Mitchell",
        count: 1,
      },
      {
        county: "Moore",
        count: 1,
      },
      {
        county: "Newton",
        count: 1,
      },
      {
        county: "Parmer",
        count: 1,
      },
      {
        county: "Pecos",
        count: 1,
      },
      {
        county: "Rains",
        count: 1,
      },
      {
        county: "Reeves",
        count: 1,
      },
      {
        county: "San Jacinto",
        count: 1,
      },
      {
        county: "San Saba",
        count: 1,
      },
      {
        county: "Shackelford",
        count: 1,
      },
      {
        county: "Ward",
        count: 1,
      },
      {
        county: "Wheeler",
        count: 1,
      },
    ],
    alzheimer_certificate: 0,
    owner_present: 0,
    administrator_present: 8798,
    management_present: 0,
    certified_yes: 0,
    licensed_yes: 0,
  },
  tulip: {
    access: "OPEN_SEARCH_NO_LOGIN",
    scrape: "FORBIDDEN",
    coverage: "OPEN_SEARCH_ONLY",
    license_count_published: null,
    search: "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-search",
    how_to: "https://tulip.hhs.texas.gov/TULIP/s/ltc-provider-information",
    licensing: "https://tulip.hhs.texas.gov/TULIP/s/long-term-care-facility-agency-licensing",
    note: "TULIP SEARCH RESULT != COMPLETE BULK UNIVERSE. Consumers verify a current Texas license in TULIP. This page does not scrape TULIP and does not invent a TULIP roster count.",
  },
  crosswalk: {
    nfToCmsNh: {
      source_native_ccns: 1153,
      cms_rows: 1177,
      exact_matches: 1149,
      unmatched_state: 4,
      unmatched_cms: 28,
      note: "Exact padded CCN / Medicare Provider Number only. Name and city are not used.",
    },
    alfToCmsNh: {
      attempted: false,
      reason:
        "ALF != SNF. No name-only or address-only attachment of ALF rows to CMS Nursing Homes.",
    },
    hcssaToCms: {
      attempted: true,
      method: "exact padded Medicare Number only; service label is source text, not a CMS class",
      uniqueMedicareNumbers: 2795,
      licensedAndCertifiedHomeHealth: {
        source_native_ccns: 1782,
        cms_rows: 1854,
        exact_matches: 491,
        unmatched_state: 1291,
        unmatched_cms: 1363,
        note: "Exact padded CCN / Medicare Provider Number only. Name and city are not used.",
      },
      hospiceLabeled: {
        source_native_ccns: 1094,
        cms_rows: 1053,
        exact_matches: 989,
        unmatched_state: 105,
        unmatched_cms: 64,
        note: "Exact padded CCN / Medicare Provider Number only. Name and city are not used.",
      },
      personalAssistanceRows: 6035,
      note: "HOME HEALTH != PERSONAL ASSISTANCE. Licensed Home Health is not Licensed and Certified Home Health and is not CMS Home Health. Exact CCN matches are research metrics on this page, not new profile attachments.",
    },
  },
  cmsCounties: {
    nursingHomes: [
      {
        county: "Harris",
        count: 97,
      },
      {
        county: "Dallas",
        count: 81,
      },
      {
        county: "Tarrant",
        count: 71,
      },
      {
        county: "Bexar",
        count: 62,
      },
      {
        county: "Travis",
        count: 28,
      },
      {
        county: "Collin",
        count: 22,
      },
      {
        county: "El Paso",
        count: 22,
      },
      {
        county: "Hidalgo",
        count: 22,
      },
      {
        county: "Denton",
        count: 18,
      },
      {
        county: "Mc Lennan",
        count: 18,
      },
      {
        county: "Smith",
        count: 17,
      },
      {
        county: "Bell",
        count: 16,
      },
      {
        county: "Fort Bend",
        count: 15,
      },
      {
        county: "Lubbock",
        count: 15,
      },
      {
        county: "Williamson",
        count: 15,
      },
      {
        county: "Cameron",
        count: 14,
      },
      {
        county: "Jefferson",
        count: 14,
      },
      {
        county: "Nueces",
        count: 14,
      },
      {
        county: "Brazoria",
        count: 13,
      },
      {
        county: "Galveston",
        count: 12,
      },
      {
        county: "Gregg",
        count: 12,
      },
      {
        county: "Montgomery",
        count: 12,
      },
      {
        county: "Taylor",
        count: 12,
      },
      {
        county: "Grayson",
        count: 11,
      },
      {
        county: "Ellis",
        count: 10,
      },
      {
        county: "Wichita",
        count: 10,
      },
      {
        county: "Johnson",
        count: 9,
      },
      {
        county: "Parker",
        count: 9,
      },
      {
        county: "Potter",
        count: 9,
      },
      {
        county: "Angelina",
        count: 8,
      },
      {
        county: "Guadalupe",
        count: 8,
      },
      {
        county: "Kaufman",
        count: 8,
      },
      {
        county: "Tom Green",
        count: 8,
      },
      {
        county: "Bowie",
        count: 7,
      },
      {
        county: "Brazos",
        count: 7,
      },
      {
        county: "Brown",
        count: 7,
      },
      {
        county: "Anderson",
        count: 6,
      },
      {
        county: "Cherokee",
        count: 6,
      },
      {
        county: "Comal",
        count: 6,
      },
      {
        county: "Ector",
        count: 6,
      },
      {
        county: "Hays",
        count: 6,
      },
      {
        county: "Henderson",
        count: 6,
      },
      {
        county: "Kendall",
        count: 6,
      },
      {
        county: "Lavaca",
        count: 6,
      },
      {
        county: "Navarro",
        count: 6,
      },
      {
        county: "Van Zandt",
        count: 6,
      },
      {
        county: "Webb",
        count: 6,
      },
      {
        county: "Atascosa",
        count: 5,
      },
      {
        county: "Bastrop",
        count: 5,
      },
      {
        county: "Caldwell",
        count: 5,
      },
      {
        county: "Fannin",
        count: 5,
      },
      {
        county: "Fayette",
        count: 5,
      },
      {
        county: "Hardin",
        count: 5,
      },
      {
        county: "Hunt",
        count: 5,
      },
      {
        county: "Lamar",
        count: 5,
      },
      {
        county: "Limestone",
        count: 5,
      },
      {
        county: "Midland",
        count: 5,
      },
      {
        county: "Rockwall",
        count: 5,
      },
      {
        county: "Wood",
        count: 5,
      },
      {
        county: "Burnet",
        count: 4,
      },
      {
        county: "Cass",
        count: 4,
      },
      {
        county: "Colorado",
        count: 4,
      },
      {
        county: "Cooke",
        count: 4,
      },
      {
        county: "Coryell",
        count: 4,
      },
      {
        county: "Eastland",
        count: 4,
      },
      {
        county: "Gillespie",
        count: 4,
      },
      {
        county: "Hill",
        count: 4,
      },
      {
        county: "Hood",
        count: 4,
      },
      {
        county: "Hopkins",
        count: 4,
      },
      {
        county: "Kerr",
        count: 4,
      },
      {
        county: "Liberty",
        count: 4,
      },
      {
        county: "Nacogdoches",
        count: 4,
      },
      {
        county: "Polk",
        count: 4,
      },
      {
        county: "Rusk",
        count: 4,
      },
      {
        county: "Victoria",
        count: 4,
      },
      {
        county: "Wharton",
        count: 4,
      },
      {
        county: "Wilson",
        count: 4,
      },
      {
        county: "Wise",
        count: 4,
      },
      {
        county: "Bosque",
        count: 3,
      },
      {
        county: "Comanche",
        count: 3,
      },
      {
        county: "De Witt",
        count: 3,
      },
      {
        county: "Erath",
        count: 3,
      },
      {
        county: "Freestone",
        count: 3,
      },
      {
        county: "Gray",
        count: 3,
      },
      {
        county: "Hamilton",
        count: 3,
      },
      {
        county: "Harrison",
        count: 3,
      },
      {
        county: "Houston",
        count: 3,
      },
      {
        county: "Howard",
        count: 3,
      },
      {
        county: "Jasper",
        count: 3,
      },
      {
        county: "Jim Wells",
        count: 3,
      },
      {
        county: "Karnes",
        count: 3,
      },
      {
        county: "Lamb",
        count: 3,
      },
      {
        county: "Lampasas",
        count: 3,
      },
      {
        county: "Matagorda",
        count: 3,
      },
      {
        county: "Maverick",
        count: 3,
      },
      {
        county: "Medina",
        count: 3,
      },
      {
        county: "Milam",
        count: 3,
      },
      {
        county: "Orange",
        count: 3,
      },
      {
        county: "Panola",
        count: 3,
      },
      {
        county: "Randall",
        count: 3,
      },
      {
        county: "Robertson",
        count: 3,
      },
      {
        county: "San Augustine",
        count: 3,
      },
      {
        county: "Shelby",
        count: 3,
      },
      {
        county: "Titus",
        count: 3,
      },
      {
        county: "Trinity",
        count: 3,
      },
      {
        county: "Val Verde",
        count: 3,
      },
      {
        county: "Walker",
        count: 3,
      },
      {
        county: "Washington",
        count: 3,
      },
      {
        county: "Young",
        count: 3,
      },
      {
        county: "Aransas",
        count: 2,
      },
      {
        county: "Austin",
        count: 2,
      },
      {
        county: "Bandera",
        count: 2,
      },
      {
        county: "Bee",
        count: 2,
      },
      {
        county: "Burleson",
        count: 2,
      },
      {
        county: "Calhoun",
        count: 2,
      },
      {
        county: "Callahan",
        count: 2,
      },
      {
        county: "Castro",
        count: 2,
      },
      {
        county: "Chambers",
        count: 2,
      },
      {
        county: "Coke",
        count: 2,
      },
      {
        county: "Coleman",
        count: 2,
      },
      {
        county: "Crosby",
        count: 2,
      },
      {
        county: "Falls",
        count: 2,
      },
      {
        county: "Gonzales",
        count: 2,
      },
      {
        county: "Grimes",
        count: 2,
      },
      {
        county: "Hale",
        count: 2,
      },
      {
        county: "Hockley",
        count: 2,
      },
      {
        county: "Hutchinson",
        count: 2,
      },
      {
        county: "Jackson",
        count: 2,
      },
      {
        county: "Jones",
        count: 2,
      },
      {
        county: "Kleberg",
        count: 2,
      },
      {
        county: "Knox",
        count: 2,
      },
      {
        county: "Lee",
        count: 2,
      },
      {
        county: "Llano",
        count: 2,
      },
      {
        county: "Madison",
        count: 2,
      },
      {
        county: "Mills",
        count: 2,
      },
      {
        county: "Montague",
        count: 2,
      },
      {
        county: "Moore",
        count: 2,
      },
      {
        county: "Nolan",
        count: 2,
      },
      {
        county: "Palo Pinto",
        count: 2,
      },
      {
        county: "Parmer",
        count: 2,
      },
      {
        county: "Red River",
        count: 2,
      },
      {
        county: "Runnels",
        count: 2,
      },
      {
        county: "Sabine",
        count: 2,
      },
      {
        county: "San Patricio",
        count: 2,
      },
      {
        county: "Somervell",
        count: 2,
      },
      {
        county: "Starr",
        count: 2,
      },
      {
        county: "Terry",
        count: 2,
      },
      {
        county: "Tyler",
        count: 2,
      },
      {
        county: "Upshur",
        count: 2,
      },
      {
        county: "Uvalde",
        count: 2,
      },
      {
        county: "Andrews",
        count: 1,
      },
      {
        county: "Armstrong",
        count: 1,
      },
      {
        county: "Bailey",
        count: 1,
      },
      {
        county: "Baylor",
        count: 1,
      },
      {
        county: "Blanco",
        count: 1,
      },
      {
        county: "Brooks",
        count: 1,
      },
      {
        county: "Camp",
        count: 1,
      },
      {
        county: "Childress",
        count: 1,
      },
      {
        county: "Clay",
        count: 1,
      },
      {
        county: "Collingsworth",
        count: 1,
      },
      {
        county: "Concho",
        count: 1,
      },
      {
        county: "Crane",
        count: 1,
      },
      {
        county: "Crockett",
        count: 1,
      },
      {
        county: "Dallam",
        count: 1,
      },
      {
        county: "Dawson",
        count: 1,
      },
      {
        county: "Deaf Smith",
        count: 1,
      },
      {
        county: "Delta",
        count: 1,
      },
      {
        county: "Dimmit",
        count: 1,
      },
      {
        county: "Donley",
        count: 1,
      },
      {
        county: "Duval",
        count: 1,
      },
      {
        county: "Foard",
        count: 1,
      },
      {
        county: "Franklin",
        count: 1,
      },
      {
        county: "Frio",
        count: 1,
      },
      {
        county: "Gaines",
        count: 1,
      },
      {
        county: "Garza",
        count: 1,
      },
      {
        county: "Goliad",
        count: 1,
      },
      {
        county: "Hall",
        count: 1,
      },
      {
        county: "Hansford",
        count: 1,
      },
      {
        county: "Haskell",
        count: 1,
      },
      {
        county: "Hemphill",
        count: 1,
      },
      {
        county: "Jack",
        count: 1,
      },
      {
        county: "Jim Hogg",
        count: 1,
      },
      {
        county: "Kent",
        count: 1,
      },
      {
        county: "La Salle",
        count: 1,
      },
      {
        county: "Leon",
        count: 1,
      },
      {
        county: "Lipscomb",
        count: 1,
      },
      {
        county: "Live Oak",
        count: 1,
      },
      {
        county: "Marion",
        count: 1,
      },
      {
        county: "Mc Culloch",
        count: 1,
      },
      {
        county: "Menard",
        count: 1,
      },
      {
        county: "Mitchell",
        count: 1,
      },
      {
        county: "Morris",
        count: 1,
      },
      {
        county: "Motley",
        count: 1,
      },
      {
        county: "Newton",
        count: 1,
      },
      {
        county: "Ochiltree",
        count: 1,
      },
      {
        county: "Pecos",
        count: 1,
      },
      {
        county: "Rains",
        count: 1,
      },
      {
        county: "Reagan",
        count: 1,
      },
      {
        county: "Real",
        count: 1,
      },
      {
        county: "Reeves",
        count: 1,
      },
      {
        county: "Refugio",
        count: 1,
      },
      {
        county: "San Jacinto",
        count: 1,
      },
      {
        county: "San Saba",
        count: 1,
      },
      {
        county: "Schleicher",
        count: 1,
      },
      {
        county: "Scurry",
        count: 1,
      },
      {
        county: "Sherman",
        count: 1,
      },
      {
        county: "Stephens",
        count: 1,
      },
      {
        county: "Sterling",
        count: 1,
      },
      {
        county: "Stonewall",
        count: 1,
      },
      {
        county: "Upton",
        count: 1,
      },
      {
        county: "Waller",
        count: 1,
      },
      {
        county: "Ward",
        count: 1,
      },
      {
        county: "Wheeler",
        count: 1,
      },
      {
        county: "Wilbarger",
        count: 1,
      },
      {
        county: "Willacy",
        count: 1,
      },
      {
        county: "Yoakum",
        count: 1,
      },
      {
        county: "Zapata",
        count: 1,
      },
    ],
    homeHealth: [
      {
        county: "(Blank)",
        count: 1854,
      },
    ],
    hospice: [
      {
        county: "Harris",
        count: 204,
      },
      {
        county: "Bexar",
        count: 132,
      },
      {
        county: "Dallas",
        count: 123,
      },
      {
        county: "Tarrant",
        count: 63,
      },
      {
        county: "Fort Bend",
        count: 61,
      },
      {
        county: "Hidalgo",
        count: 36,
      },
      {
        county: "Collin",
        count: 33,
      },
      {
        county: "Montgomery",
        count: 30,
      },
      {
        county: "Travis",
        count: 25,
      },
      {
        county: "El Paso",
        count: 23,
      },
      {
        county: "Nueces",
        count: 19,
      },
      {
        county: "Cameron",
        count: 18,
      },
      {
        county: "Denton",
        count: 18,
      },
      {
        county: "Jefferson",
        count: 14,
      },
      {
        county: "Lubbock",
        count: 14,
      },
      {
        county: "Galveston",
        count: 12,
      },
      {
        county: "Williamson",
        count: 12,
      },
      {
        county: "Mclennan",
        count: 11,
      },
      {
        county: "Smith",
        count: 10,
      },
      {
        county: "Bell",
        count: 9,
      },
      {
        county: "Webb",
        count: 9,
      },
      {
        county: "Brazos",
        count: 8,
      },
      {
        county: "Grayson",
        count: 8,
      },
      {
        county: "Gregg",
        count: 8,
      },
      {
        county: "Hays",
        count: 7,
      },
      {
        county: "Angelina",
        count: 6,
      },
      {
        county: "Bowie",
        count: 6,
      },
      {
        county: "Brazoria",
        count: 6,
      },
      {
        county: "Comal",
        count: 5,
      },
      {
        county: "Kaufman",
        count: 5,
      },
      {
        county: "Lamar",
        count: 5,
      },
      {
        county: "Taylor",
        count: 5,
      },
      {
        county: "Midland",
        count: 4,
      },
      {
        county: "Potter",
        count: 4,
      },
      {
        county: "Tom Green",
        count: 4,
      },
      {
        county: "Wichita",
        count: 4,
      },
      {
        county: "-",
        count: 3,
      },
      {
        county: "Ellis",
        count: 3,
      },
      {
        county: "Gillespie",
        count: 3,
      },
      {
        county: "Hunt",
        count: 3,
      },
      {
        county: "Johnson",
        count: 3,
      },
      {
        county: "Maverick",
        count: 3,
      },
      {
        county: "Polk",
        count: 3,
      },
      {
        county: "Victoria",
        count: 3,
      },
      {
        county: "Ector",
        count: 2,
      },
      {
        county: "Guadalupe",
        count: 2,
      },
      {
        county: "Houston",
        count: 2,
      },
      {
        county: "Jasper",
        count: 2,
      },
      {
        county: "Jim Wells",
        count: 2,
      },
      {
        county: "Orange",
        count: 2,
      },
      {
        county: "Parker",
        count: 2,
      },
      {
        county: "Starr",
        count: 2,
      },
      {
        county: "Titus",
        count: 2,
      },
      {
        county: "Waller",
        count: 2,
      },
      {
        county: "Wise",
        count: 2,
      },
      {
        county: "Andrews",
        count: 1,
      },
      {
        county: "Aransas",
        count: 1,
      },
      {
        county: "Bastrop",
        count: 1,
      },
      {
        county: "Bee",
        count: 1,
      },
      {
        county: "Bosque",
        count: 1,
      },
      {
        county: "Brown",
        count: 1,
      },
      {
        county: "Burnet",
        count: 1,
      },
      {
        county: "Chambers",
        count: 1,
      },
      {
        county: "Childress",
        count: 1,
      },
      {
        county: "Coleman",
        count: 1,
      },
      {
        county: "Collingsworth",
        count: 1,
      },
      {
        county: "Dallam",
        count: 1,
      },
      {
        county: "Deaf Smith",
        count: 1,
      },
      {
        county: "Erath",
        count: 1,
      },
      {
        county: "Frio",
        count: 1,
      },
      {
        county: "Hale",
        count: 1,
      },
      {
        county: "Hansford",
        count: 1,
      },
      {
        county: "Harrison",
        count: 1,
      },
      {
        county: "Hemphill",
        count: 1,
      },
      {
        county: "Henderson",
        count: 1,
      },
      {
        county: "Kendall",
        count: 1,
      },
      {
        county: "Kerr",
        count: 1,
      },
      {
        county: "Kleberg",
        count: 1,
      },
      {
        county: "Liberty",
        count: 1,
      },
      {
        county: "Matagorda",
        count: 1,
      },
      {
        county: "Moore",
        count: 1,
      },
      {
        county: "Navarro",
        count: 1,
      },
      {
        county: "Ochiltree",
        count: 1,
      },
      {
        county: "Palo Pinto",
        count: 1,
      },
      {
        county: "Parmer",
        count: 1,
      },
      {
        county: "Pecos",
        count: 1,
      },
      {
        county: "Randall",
        count: 1,
      },
      {
        county: "Reeves",
        count: 1,
      },
      {
        county: "Rockwall",
        count: 1,
      },
      {
        county: "Runnels",
        count: 1,
      },
      {
        county: "Rusk",
        count: 1,
      },
      {
        county: "San Patricio",
        count: 1,
      },
      {
        county: "Scurry",
        count: 1,
      },
      {
        county: "Uvalde",
        count: 1,
      },
      {
        county: "Val Verde",
        count: 1,
      },
      {
        county: "Walker",
        count: 1,
      },
      {
        county: "Washington",
        count: 1,
      },
      {
        county: "Wharton",
        count: 1,
      },
      {
        county: "Wilbarger",
        count: 1,
      },
      {
        county: "Wood",
        count: 1,
      },
      {
        county: "Young",
        count: 1,
      },
    ],
    homeHealthCountyField:
      "CMS Home Health Care Agencies extract has City/Town and State, not a county field.",
    texasCountyCount: 254,
    note: "Facility address county, not a service area. No /texas/[county] routes. CMS Home Health county is unknown in this extract.",
  },
  enforcement: {
    pass: "bounded_easy_win",
    result: "PARTIAL_SOURCE_COVERAGE",
    nfClosures: {
      title:
        "Texas Health and Human Services Commission List of Nursing Facility Closures as of 7/20/2026",
      source_as_of: "2026-07-20",
      columns: [
        "Owner",
        "Facility",
        "Facility ID",
        "Address",
        "City",
        "State",
        "ZIP",
        "County",
        "Date of Closure",
        "Program",
        "Service Type",
        "Medicaid Beds at Closure",
      ],
      source_row_count: 404,
      identifier_populated: 404,
      by_program: [
        {
          label: "Nursing",
          count: 404,
        },
      ],
      by_service: [
        {
          label: "SNF/NF",
          count: 307,
        },
        {
          label: "NF LICENSED ONLY",
          count: 51,
        },
        {
          label: "NF MEDICAID ONLY",
          count: 29,
        },
        {
          label: "SNF",
          count: 15,
        },
        {
          label: "HOSPITAL-BASED SNF",
          count: 2,
        },
      ],
      note: "Closure workbook is a historical license-action listing as of the title date. It is not an inspection/SOD file, not a current roster, and not a quality rank.",
    },
    alfClosures: {
      title:
        "Texas Health and Human Services Commission List of Assisted Living Facility Closures as of 7/20/2026",
      source_as_of: "2026-07-20",
      columns: [
        "Owner",
        "Facility",
        "Facility ID",
        "Address",
        "City",
        "State",
        "ZIP",
        "County",
        "Date of Closure",
        "Program",
        "Service Type",
      ],
      source_row_count: 1496,
      identifier_populated: 1496,
      by_program: [
        {
          label: "Assisted Living",
          count: 1496,
        },
      ],
      by_service: [
        {
          label: "TYPE A",
          count: 787,
        },
        {
          label: "TYPE B",
          count: 497,
        },
        {
          label: "TYPE C",
          count: 190,
        },
        {
          label: "TYPE E",
          count: 22,
        },
      ],
      note: "Closure workbook is a historical license-action listing as of the title date. It is not an inspection/SOD file, not a current roster, and not a quality rank.",
    },
    hcssaClosures: {
      title:
        "Texas Health and Human Services Commission List of Home and Community Support Services Agency Closures as of 7/20/2026",
      source_as_of: "2026-07-20",
      columns: [
        "Owner",
        "Agency",
        "License No",
        "Address",
        "City",
        "State",
        "ZIP",
        "Date of Closure",
        "Agency Type",
        "Services",
      ],
      source_row_count: 22027,
      identifier_populated: 22027,
      by_program: [
        {
          label: "Parent Agency",
          count: 17022,
        },
        {
          label: "Branch Agency",
          count: 4480,
        },
        {
          label: "Alternate Delivery Site",
          count: 525,
        },
      ],
      by_service: [
        {
          label: "PAS",
          count: 3616,
        },
        {
          label: "L&CHHS",
          count: 3372,
        },
        {
          label: "LHHS   PAS",
          count: 3246,
        },
        {
          label: "LHHS",
          count: 2855,
        },
        {
          label: "L&CHHS LHHS   PAS",
          count: 2098,
        },
        {
          label: "(blank)",
          count: 1745,
        },
        {
          label: "L&CHHS LHHS",
          count: 1681,
        },
        {
          label: "Hospice",
          count: 1565,
        },
        {
          label: "L&CHHS     PAS",
          count: 517,
        },
        {
          label: "LHHS;PAS",
          count: 461,
        },
        {
          label: "L&CHHS;LHHS;PAS",
          count: 253,
        },
        {
          label: "L&CHHS;LHHS",
          count: 141,
        },
        {
          label: "LHHSw/D",
          count: 56,
        },
        {
          label: "LHHS   PAS Hospice",
          count: 49,
        },
        {
          label: "Hospice Alternative Delivery Site (ADS)",
          count: 43,
        },
        {
          label: "Hospice;PAS",
          count: 41,
        },
        {
          label: "PAS Hospice",
          count: 35,
        },
        {
          label: "Hospice;LHHS;PAS",
          count: 30,
        },
        {
          label: "L&CHHS;PAS",
          count: 29,
        },
        {
          label: "L&CHHS LHHS   PAS Hospice",
          count: 29,
        },
        {
          label: "PAS;PAS",
          count: 19,
        },
        {
          label: "LHHS;LHHS;PAS;PAS",
          count: 17,
        },
        {
          label: "Hospice;L&CHHS;LHHS;PAS",
          count: 12,
        },
        {
          label: "L&CHHS       Hospice",
          count: 12,
        },
        {
          label: "Hospice;LHHS",
          count: 11,
        },
        {
          label: "LHHS     Hospice",
          count: 11,
        },
        {
          label: "LHHS;LHHS",
          count: 9,
        },
        {
          label: "L&CHHS LHHS     Hospice",
          count: 9,
        },
        {
          label: "Hospice;Hospice",
          count: 8,
        },
        {
          label: "L&CHHS;LHHS;LHHS;PAS;PAS",
          count: 6,
        },
        {
          label: "Hospice;Hospice Alternative Delivery Site (ADS)",
          count: 4,
        },
        {
          label: "L&CHHS;LHHS;LHHS",
          count: 4,
        },
        {
          label: "LHHSw/D PAS",
          count: 4,
        },
        {
          label: "L&CHHS     PAS Hospice",
          count: 4,
        },
        {
          label: "Hospice;L&CHHS",
          count: 3,
        },
        {
          label: "LHHS;LHHSw/D",
          count: 3,
        },
        {
          label: "Hospice (In-Patient)",
          count: 3,
        },
        {
          label: "L&CHHS LHHS LHHSw/D PAS",
          count: 3,
        },
        {
          label: "L&CHHS   LHHSw/D",
          count: 3,
        },
        {
          label: "Hospice;L&CHHS;LHHS",
          count: 2,
        },
      ],
      note: "Closure workbook is a historical license-action listing as of the title date. It is not an inspection/SOD file, not a current roster, and not a quality rank.",
    },
    inspectionFindings: "SOURCE_NOT_ACQUIRED",
    statementOfDeficiencies: "SOURCE_NOT_ACQUIRED",
    administrativePenalties: "SOURCE_NOT_ACQUIRED",
    pdfStopped: [
      "https://apps.hhs.texas.gov/providers/directories/Closures/nf_closures.pdf",
      "https://apps.hhs.texas.gov/providers/directories/Closures/alf_closures.pdf",
      "https://apps.hhs.texas.gov/providers/directories/Closures/hcssa_closures.pdf",
      "https://www.hhs.texas.gov/sites/default/files/documents/nf-ij-data.pdf",
      "https://www.hhs.texas.gov/sites/default/files/documents/alf-violations-data.pdf",
    ],
    searches: {
      "nursing facility": {
        q: "nursing facility",
        http_status: 200,
        count: 3,
        titles: [
          "DataSet-02-Prescriptive Delegation",
          "Professional Medical Billing Services (SV1) Detail Information",
          "Professional Medical Billing Services (SV1) Detail Information - Historical",
        ],
        child_care_hits: [],
      },
      "assisted living": {
        q: "assisted living",
        http_status: 200,
        count: 2,
        titles: [
          "CPS 5.1 Youth in Substitute Care - Youth Eligible for PAL Services FY2016-2025",
          "CPS 5.1 Youth in Substitute Care - Youth Eligible for PAL Services by Region with Demographics FY2016-2025",
        ],
        child_care_hits: [],
      },
      "hospice HHSC": {
        q: "hospice HHSC",
        http_status: 200,
        count: 0,
        titles: [],
        child_care_hits: [],
      },
      HCSSA: {
        q: "HCSSA",
        http_status: 200,
        count: 0,
        titles: [],
        child_care_hits: [],
      },
      "home health HHSC": {
        q: "home health HHSC",
        http_status: 200,
        count: 1,
        titles: ["HHSC CCL Daycare and Residential Operations Data"],
        child_care_hits: ["bc5r-88dy:HHSC CCL Daycare and Residential Operations Data"],
      },
      "HHSC enforcement": {
        q: "HHSC enforcement",
        http_status: 200,
        count: 0,
        titles: [],
        child_care_hits: [],
      },
      "statement of deficiencies": {
        q: "statement of deficiencies",
        http_status: 200,
        count: 0,
        titles: [],
        child_care_hits: [],
      },
      "nursing facility sanctions": {
        q: "nursing facility sanctions",
        http_status: 200,
        count: 0,
        titles: [],
        child_care_hits: [],
      },
      "CCL inspection": {
        q: "CCL inspection",
        http_status: 200,
        count: 5,
        titles: [
          "HHSC CCL Inspection Investigation Assessment Data",
          "HHSC CCL Sections and Standards Evaluated Data",
          "HHSC CCL Non-Compliance Data",
          "DFPS CCL ReadMe file",
          "HHSC CCL Daycare and Residential Operations Data",
        ],
        child_care_hits: [
          "m5q4-3y3d:HHSC CCL Inspection Investigation Assessment Data",
          "ywgb-2ig8:HHSC CCL Sections and Standards Evaluated Data",
          "tqgd-mf4x:HHSC CCL Non-Compliance Data",
          "xb9g-mnmg:DFPS CCL ReadMe file",
          "bc5r-88dy:HHSC CCL Daycare and Residential Operations Data",
        ],
      },
      "child care licensing": {
        q: "child care licensing",
        http_status: 200,
        count: 51,
        titles: [
          "HHSC CCL Daycare and Residential Operations Data",
          "DFPS Employees 1.5 Average Monthly Salaries by Selected Program and Staff Type FY2016-2025",
          "Monthly Child Care Services Data Report - Child Care Facilities 2024 Q2",
          "Monthly Child Care Services Data Report - Child Care Facilities 2024 Q1",
          "Monthly Child Care Services Data Report - Child Care Facilities 2023 Q4",
          "DFPS Employees 1.2 Staff Tenure on 31 August by Program and Staff Type FY2016-2025",
          "CCI 4.4 Child Care Investigations (CCI) Priority and Response Time FY2016-2025",
          "Monthly Child Care Services Data Report - Child Care Facilities 2023 Q2",
        ],
        child_care_hits: [
          "bc5r-88dy:HHSC CCL Daycare and Residential Operations Data",
          "bsvz-ncuc:Monthly Child Care Services Data Report - Child Care Facilities 2024 Q2",
          "mpjn-894n:Monthly Child Care Services Data Report - Child Care Facilities 2024 Q1",
          "ttsw-3c2c:Monthly Child Care Services Data Report - Child Care Facilities 2023 Q4",
          "6x34-9q6a:CCI 4.4 Child Care Investigations (CCI) Priority and Response Time FY2016-2025",
          "wpef-mp5z:Monthly Child Care Services Data Report - Child Care Facilities 2023 Q2",
        ],
      },
    },
    childCareExcluded: {
      "bc5r-88dy": {
        name: "HHSC CCL Daycare and Residential Operations Data",
        url: "https://data.texas.gov/dataset/bc5r-88dy",
        http_status: 200,
        row_count: 14982,
        publication: "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
        reason:
          "Child Care Licensing operations/inspections are not senior-care LTC. CHILD CARE DATA != SENIOR CARE.",
      },
      "m5q4-3y3d": {
        name: "HHSC CCL Inspection Investigation Assessment Data",
        url: "https://data.texas.gov/dataset/m5q4-3y3d",
        http_status: 200,
        row_count: 206609,
        publication: "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
        reason:
          "Child Care Licensing operations/inspections are not senior-care LTC. CHILD CARE DATA != SENIOR CARE.",
      },
    },
    cmsFederalOverlay:
      "CMS inspection/deficiency/penalty/staffing evidence remains available on existing CMS Nursing Home class profiles using national definitions. Not re-scraped here. No facility ranking.",
    identityRule:
      "Exact adverse attach requires HHSC facility/license ID or exact CMS CCN. Name-only is UNSAFE. Name+address is HIGH_CONFIDENCE for non-adverse descriptive matching only.",
    note: "Closure Excel rows are license actions, not inspection findings and not a quality rank. Missing SOD/penalty bulk is unknown, not zero. Child-care CCL SODA is deliberately excluded.",
  },
  ownership: {
    cmsNursingHome:
      "Reuse existing SeniorTrustHub CMS Nursing Home ownership graph on exact CCN profiles.",
    stateOnly:
      "Do not infer ownership for state-only facilities by name. TULIP licensee/operator, if present on a looked-up record, is source semantics \u2014 no roster scrape.",
    excelFields: {
      nfOwnerPresent: 1174,
      nfAdministratorPresent: 1175,
      alfOwnerPresent: 2000,
      alfAdministratorPresent: 2000,
    },
    note: "TX NF Excel entity/capacity fields are unsafe for consumer entity publication. Administrator personal contacts are not published.",
  },
  contacts: {
    cms: "Use source-native CMS business/facility contact fields on existing class profiles.",
    tulip: "Do not harvest TULIP contacts one-by-one.",
    administratorPersonal: "Do not publish.",
    nfPhonePresent: 1174,
    alfPhonePresent: 1941,
    hcssaPhonePresent: 8799,
  },
  childCareExclusion: {
    status: "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
    datasets: {
      "bc5r-88dy": {
        name: "HHSC CCL Daycare and Residential Operations Data",
        url: "https://data.texas.gov/dataset/bc5r-88dy",
        http_status: 200,
        row_count: 14982,
        publication: "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
        reason:
          "Child Care Licensing operations/inspections are not senior-care LTC. CHILD CARE DATA != SENIOR CARE.",
      },
      "m5q4-3y3d": {
        name: "HHSC CCL Inspection Investigation Assessment Data",
        url: "https://data.texas.gov/dataset/m5q4-3y3d",
        http_status: 200,
        row_count: 206609,
        publication: "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE",
        reason:
          "Child Care Licensing operations/inspections are not senior-care LTC. CHILD CARE DATA != SENIOR CARE.",
      },
    },
    note: "CHILD CARE DATA != SENIOR CARE. bc5r-88dy and m5q4-3y3d must never appear as Texas senior-care denominators.",
  },
  gaps: [
    "No complete Texas state LTC roster covering NF + ALF + HCSSA + DAHS + ICF as one universe. Missing is not zero.",
    "TULIP remains search-only. A TULIP search result is not a complete bulk universe.",
    "HCSSA Personal Assistance is not CMS Home Health. HCSSA Hospice is not CMS Home Health.",
    "Exact state\u2194CMS crosswalk is available only where a source-native Medicare Provider Number / CCN exists. Name-only is unsafe.",
    "State inspection findings, statement-of-deficiencies, and administrative-penalty bulk were not acquired as structured open data in this pass.",
    "Immediate Jeopardy and ALF violations PDFs were not parsed (PDF-by-PDF STOP).",
    "Facility address county is not a Home Health or Hospice service area.",
    "Hospital-based NF.xlsx is a sibling directory and is not added to NF.xlsx.",
    "PPECC is pediatric and is excluded from the senior-care universe.",
    "CMS inspection/ownership evidence stays on existing national CCN architecture; this snapshot does not invent Texas-only inspection ranks.",
  ],
  files: {
    nf: {
      url: "https://apps.hhs.texas.gov/providers/directories/NF.xlsx",
      http_status: 200,
      bytes: 371666,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\nf.xlsx",
      sha256: "6730ec151f81519c4f279ca26da88cfd14e184e2b20412b4de222bdc616f499f",
    },
    hosp_nf: {
      url: "https://apps.hhs.texas.gov/providers/directories/HospNF.xlsx",
      http_status: 200,
      bytes: 15073,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\hosp_nf.xlsx",
      sha256: "707a58d0a5fed66837e9ed4906ffd5d49aa23d02ee8d12aa36c6f427bff91d67",
    },
    alf: {
      url: "https://apps.hhs.texas.gov/providers/directories/al.xlsx",
      http_status: 200,
      bytes: 571308,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\alf.xlsx",
      sha256: "37e13b002875d09a0c340da8eaf405fea75fcba10af77cb8c42816d2f22b4d4b",
    },
    hcssa: {
      url: "https://apps.hhs.texas.gov/providers/directories/HHA.xlsx",
      http_status: 200,
      bytes: 1975629,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\hcssa.xlsx",
      sha256: "2de0b99b78439ca5c66db3e810155fcf78a336a94dec8e35117ba1afdabb5524",
    },
    nf_closures: {
      url: "https://apps.hhs.texas.gov/providers/directories/Closures/nf_closures.xlsx",
      http_status: 200,
      bytes: 52767,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\nf_closures.xlsx",
      sha256: "bb251726f80dec51b2466cf3a272ed7f126ed2c9007ad5b80adc80c0a2f54fba",
    },
    alf_closures: {
      url: "https://apps.hhs.texas.gov/providers/directories/Closures/alf_closures.xlsx",
      http_status: 200,
      bytes: 148971,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\alf_closures.xlsx",
      sha256: "7dcdfef0145bbabe764e054bf68491604f877dbf90f10b2a66249cf26fddf805",
    },
    hcssa_closures: {
      url: "https://apps.hhs.texas.gov/providers/directories/Closures/hcssa_closures.xlsx",
      http_status: 200,
      bytes: 1733508,
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\hcssa_closures.xlsx",
      sha256: "2d617f0363fdc6f3961b253b9a9ddce5de7620c156d1f37aadf2367ef97e77c2",
    },
    cms_nh: {
      url: "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0/download?format=csv",
      http_status: 200,
      bytes: 8960329,
      content_type: "text/csv; charset=UTF-8",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\cms_nh.csv",
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
          "With a Resident and Family Council",
          "Automatic Sprinkler Systems in All Required Areas",
          "Overall Rating",
          "Overall Rating Footnote",
          "Health Inspection Rating",
          "Health Inspection Rating Footnote",
          "QM Rating",
          "QM Rating Footnote",
          "Long-Stay QM Rating",
          "Long-Stay QM Rating Footnote",
        ],
        state_key: "State",
        ccn_key: "CMS Certification Number (CCN)",
        tx_rows: 1177,
        tx_unique_ccn: 1177,
      },
    },
    cms_hha: {
      url: "https://data.cms.gov/provider-data/api/1/datastore/query/6jpm-sxkc/0/download?format=csv",
      http_status: 200,
      bytes: 13028353,
      content_type: "text/csv; charset=UTF-8",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\cms_hha.csv",
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
          "Denominator for how often patients got better at getting in and out of bed",
          "How often patients got better at getting in and out of bed",
          "Footnote for how often patients got better at getting in and out of bed",
          "Numerator for how often patients got better at bathing",
          "Denominator for how often patients got better at bathing",
          "How often patients got better at bathing",
          "Footnote for how often patients got better at bathing",
          "Numerator for how often patients' breathing improved",
          "Denominator for how often patients' breathing improved",
          "How often patients' breathing improved",
        ],
        state_key: "State",
        ccn_key: "CMS Certification Number (CCN)",
        tx_rows: 1854,
        tx_unique_ccn: 1854,
      },
    },
    cms_hospice: {
      url: "https://data.cms.gov/provider-data/api/1/datastore/query/yc9t-dgbk/0/download?format=csv",
      http_status: 200,
      bytes: 894972,
      content_type: "text/csv; charset=UTF-8",
      saved: true,
      path: "C:\\Users\\Michael.Savitsky\\care-tx-sen-001\\data\\raw\\texas\\cms_hospice.csv",
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
        tx_rows: 1053,
        tx_unique_ccn: 1053,
      },
    },
  },
  fingerprint: "21a477348aa7e5f8de242acaa64526633a454ee4bbd59e232feefa5aa34ef407",
} as const;
