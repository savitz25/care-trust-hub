import type { DirectoryProjection } from "./provider-intelligence";

export type AgencyPublicationClass = "home_health" | "hospice";

export interface AgencyIndexCohortEntry {
  ccn: string;
  name: string;
  city: string;
  state: string;
  slug: string;
}

export interface AgencyIndexCohort {
  home_health: AgencyIndexCohortEntry[];
  hospice: AgencyIndexCohortEntry[];
}

export function isValidAgencyCcn(ccn: string): boolean {
  return /^[A-Z0-9]{6}$/.test(ccn);
}

export function isAgencyDirectoryEligible(input: {
  ccn: string;
  name: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
  directoryProjection: DirectoryProjection;
}): boolean {
  if (input.directoryProjection === "KNOWN_NOT_CURRENT") return false;
  if (input.directoryProjection === "EVIDENCE_ONLY") return false;
  return (
    isValidAgencyCcn(input.ccn.trim().toUpperCase()) &&
    Boolean(input.name?.trim()) &&
    Boolean(input.city?.trim()) &&
    /^[A-Z]{2}$/.test(input.state?.trim() ?? "")
  );
}

export function isAgencyCohortMember(
  kind: AgencyPublicationClass,
  ccn: string,
  cohort: AgencyIndexCohort,
): boolean {
  const value = ccn.trim().toUpperCase();
  return cohort[kind].some((row) => row.ccn === value);
}

export function agencyProfileIsIndexable(input: {
  kind: AgencyPublicationClass;
  ccn: string;
  name: string | null | undefined;
  city: string | null | undefined;
  state: string | null | undefined;
  directoryProjection: DirectoryProjection;
  publicLaunch: boolean;
  profileUiEnabled: boolean;
  indexKillSwitchEnabled: boolean;
  cohort: AgencyIndexCohort;
}): boolean {
  if (!input.publicLaunch || !input.profileUiEnabled || !input.indexKillSwitchEnabled) {
    return false;
  }
  return (
    isAgencyDirectoryEligible(input) && isAgencyCohortMember(input.kind, input.ccn, input.cohort)
  );
}

export function homeHealthResearchDescription(
  name: string,
  location: string,
  hasQualityStar: boolean,
): string {
  const loc = location ? ` in ${location}` : "";
  if (hasQualityStar) {
    return `Research ${name}${loc} using published CMS Home Health quality, HHCAHPS, ownership, and coverage evidence. No Trust Hub score.`;
  }
  return `Research ${name}${loc} using published CMS Home Health public records, ownership, and coverage evidence. Missing CMS quality is shown as not reported. No Trust Hub score.`;
}

export function hospiceResearchDescription(
  name: string,
  location: string,
  hasQuality: boolean,
): string {
  const loc = location ? ` in ${location}` : "";
  if (hasQuality) {
    return `Research ${name}${loc} using published CMS Hospice quality, CAHPS Hospice Survey, ownership, and coverage evidence. No Trust Hub score.`;
  }
  return `Research ${name}${loc} using published CMS Hospice public records, ownership, and coverage evidence. Missing CMS quality is shown as not reported. No Trust Hub score.`;
}
