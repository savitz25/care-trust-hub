import "server-only";
import {
  type SeniorProviderClass,
  type SeniorResearchQuery,
  validateSeniorResearchQuery,
} from "./senior-ask-contract";

export const SENIOR_SPECIALIST_EXECUTION_CONTRACT = "trusthub-specialist-execution-v2" as const;

export type SeniorSpecialistRequest = {
  providerClass?: SeniorProviderClass;
  identifier?: string;
  geography?: {
    type: "state" | "county" | "city" | "zip";
    value: string;
  };
  filters?: {
    overallStars?: number[];
    staffingStars?: number[];
    inspectionStars?: number[];
    qpcStars?: number[];
  };
  page?: number;
};

export class SeniorSpecialistRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const TOP_LEVEL_FIELDS = new Set(["providerClass", "identifier", "geography", "filters", "page"]);
const FILTER_FIELDS = new Set(["overallStars", "staffingStars", "inspectionStars", "qpcStars"]);
const PROVIDER_CLASSES = new Set<SeniorProviderClass>(["nursing_home", "home_health", "hospice"]);
const GEOGRAPHY_TYPES = new Set(["state", "county", "city", "zip"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SeniorSpecialistRequestError("invalid_request", 400, `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertKnownFields(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length) {
    throw new SeniorSpecialistRequestError(
      "unsupported_field",
      400,
      `${label} contains unsupported fields.`,
      { fields: unsupported },
    );
  }
}

function stars(value: unknown, label: string): number[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((star) => !Number.isInteger(star) || star < 1 || star > 5)
  ) {
    throw new SeniorSpecialistRequestError(
      "invalid_filter",
      400,
      `${label} must be a non-empty array of integer CMS ratings from 1 through 5.`,
    );
  }
  return [...new Set(value as number[])];
}

export function normalizeSeniorSpecialistRequest(input: unknown): {
  request: SeniorSpecialistRequest;
  query: SeniorResearchQuery;
} {
  const body = record(input, "request");
  assertKnownFields(body, TOP_LEVEL_FIELDS, "request");

  const providerClass = body.providerClass;
  if (providerClass !== undefined && !PROVIDER_CLASSES.has(providerClass as SeniorProviderClass)) {
    throw new SeniorSpecialistRequestError(
      "invalid_provider_class",
      400,
      "providerClass must be nursing_home, home_health, or hospice.",
    );
  }

  const identifier =
    typeof body.identifier === "string" ? body.identifier.trim().toUpperCase() : undefined;
  if (body.identifier !== undefined && !identifier) {
    throw new SeniorSpecialistRequestError(
      "invalid_identifier",
      400,
      "identifier must be a CMS CCN.",
    );
  }
  if (!providerClass && !identifier) {
    throw new SeniorSpecialistRequestError(
      "provider_class_or_identifier_required",
      400,
      "Provide providerClass or an exact CMS CCN identifier.",
    );
  }

  let geography: SeniorResearchQuery["geography"];
  if (body.geography !== undefined) {
    const supplied = record(body.geography, "geography");
    assertKnownFields(supplied, new Set(["type", "value"]), "geography");
    const type = supplied.type;
    const rawValue = typeof supplied.value === "string" ? supplied.value.trim() : "";
    if (!GEOGRAPHY_TYPES.has(String(type)) || !rawValue) {
      throw new SeniorSpecialistRequestError(
        "invalid_geography",
        400,
        "geography requires a supported type and non-empty value.",
      );
    }
    const value = type === "state" ? rawValue.toUpperCase() : rawValue;
    if (type === "state" && !/^[A-Z]{2}$/.test(value)) {
      throw new SeniorSpecialistRequestError(
        "invalid_geography",
        400,
        "State geography must use a two-letter postal code.",
      );
    }
    if (type === "zip" && !/^\d{5}$/.test(value)) {
      throw new SeniorSpecialistRequestError(
        "invalid_geography",
        400,
        "ZIP geography must contain five digits.",
      );
    }
    if (providerClass === "home_health" && type === "county") {
      throw new SeniorSpecialistRequestError(
        "unsupported_home_health_county_geography",
        422,
        "The accepted Home Health query source does not support county execution.",
        {
          providerClass,
          geography: { type, value },
          supportedAlternatives: ["state", "city", "zip"],
          limitation: "Home Health office location is not service area.",
        },
      );
    }
    const noun = providerClass === "nursing_home" ? "provider" : "office";
    geography = {
      type: type as "state" | "county" | "city" | "zip",
      value,
      meaning: `${noun} recorded ${String(type)} in the current CMS directory; not service area or availability.`,
    };
  }

  let qualityFilters: SeniorResearchQuery["qualityFilters"];
  if (body.filters !== undefined) {
    const supplied = record(body.filters, "filters");
    assertKnownFields(supplied, FILTER_FIELDS, "filters");
    qualityFilters = {
      overallStars: stars(supplied.overallStars, "overallStars"),
      staffingStars: stars(supplied.staffingStars, "staffingStars"),
      inspectionStars: stars(supplied.inspectionStars, "inspectionStars"),
      qpcStars: stars(supplied.qpcStars, "qpcStars"),
    };
    if (
      providerClass !== "nursing_home" &&
      (qualityFilters.overallStars ||
        qualityFilters.staffingStars ||
        qualityFilters.inspectionStars)
    ) {
      throw new SeniorSpecialistRequestError(
        "unsupported_class_filter",
        422,
        "Nursing Home CMS rating filters do not apply to this provider class.",
      );
    }
    if (providerClass !== "home_health" && qualityFilters.qpcStars) {
      throw new SeniorSpecialistRequestError(
        "unsupported_class_filter",
        422,
        "Quality of Patient Care stars apply only to Home Health.",
      );
    }
    if (qualityFilters.qpcStars && qualityFilters.qpcStars.length !== 1) {
      throw new SeniorSpecialistRequestError(
        "invalid_filter",
        400,
        "Home Health Quality of Patient Care execution accepts one CMS rating at a time.",
      );
    }
  }

  const page = body.page === undefined ? 1 : Number(body.page);
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    throw new SeniorSpecialistRequestError(
      "invalid_page",
      400,
      "page must be an integer from 1 through 500.",
    );
  }

  const request: SeniorSpecialistRequest = {
    providerClass: providerClass as SeniorProviderClass | undefined,
    identifier,
    geography: geography ? { type: geography.type, value: geography.value } : undefined,
    filters: qualityFilters,
    page,
  };
  const query = validateSeniorResearchQuery({
    mode: identifier ? "identifier" : "entity",
    providerClass: providerClass as SeniorProviderClass | undefined,
    identifier: identifier ? { type: "ccn", value: identifier } : undefined,
    geography,
    status: "current",
    qualityFilters,
    sort: "name",
    page,
  });
  return { request, query };
}

export const SENIOR_SPECIALIST_CAPABILITIES = {
  contract: SENIOR_SPECIALIST_EXECUTION_CONTRACT,
  hub: "senior",
  entityClasses: ["nursing_home", "home_health", "hospice"],
  identifiers: ["CMS_CCN"],
  requiredSlots: ["providerClass_or_identifier"],
  supportedGeography: {
    nursing_home: ["state", "county", "city", "zip"],
    home_health: ["state", "city", "zip"],
    hospice: ["state", "county", "city", "zip"],
  },
  geographyMeaning: {
    nursing_home: "CMS provider recorded location/address; not service area.",
    home_health: "CMS office recorded location/address; not service area.",
    hospice: "CMS office recorded location/address; not service area.",
  },
  evidenceFamilies: {
    nursing_home: [
      "cms_overall_rating",
      "staffing_rating",
      "inspection_rating",
      "ownership_category",
    ],
    home_health: ["quality_of_patient_care_rating", "hhcahps_presence", "ownership_presence"],
    hospice: ["quality_measure_presence", "cahps_presence", "ownership_presence"],
  },
  canReturnRows: true,
  refinements: ["providerClass", "geography", "source_native_rating_filters", "page"],
  publicationSemantics:
    "Existing public provider/profile gates only; this contract does not publish providers.",
  destinationTemplates: {
    profile: "Canonical public profile URL returned per row.",
    sections:
      "No section anchors are advertised because stable public anchors are not currently contracted.",
  },
  limitations: [
    "Provider classes are never combined into a single total.",
    "Recorded provider or office geography is not service area or availability.",
    "CMS ratings are source-native measures, not a TrustHub score or ranking.",
    "Home Health county execution is unsupported by the accepted query source.",
    "Hospice has no CMS overall star in this directory.",
  ],
} as const;
