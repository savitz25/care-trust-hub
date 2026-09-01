import "server-only";
import {
  agencyProfileIsIndexable,
  type AgencyIndexCohort,
  type AgencyPublicationClass,
  type DirectoryProjection,
} from "@care/domain";
import cohort from "@/data/agency-index-cohort.json";
import { isPublicLaunchEnabled } from "@/config/deployment";
import {
  isAgencyProfileIndexEnabled,
  isHhProfileIntelEnabled,
  isHospiceProfileIntelEnabled,
} from "./feature-flags";

export const agencyIndexCohort = cohort as AgencyIndexCohort;

export function isAgencyProfileIndexableForPage(
  kind: AgencyPublicationClass,
  input: {
    ccn: string;
    name: string | null | undefined;
    city: string | null | undefined;
    state: string | null | undefined;
    directoryProjection: DirectoryProjection;
  },
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return agencyProfileIsIndexable({
    kind,
    ...input,
    publicLaunch: isPublicLaunchEnabled(environment),
    profileUiEnabled:
      kind === "home_health"
        ? isHhProfileIntelEnabled(environment)
        : isHospiceProfileIntelEnabled(environment),
    indexKillSwitchEnabled: isAgencyProfileIndexEnabled(environment),
    cohort: agencyIndexCohort,
  });
}

export function getAgencyIndexSitemapRows(kind: AgencyPublicationClass) {
  return agencyIndexCohort[kind];
}
