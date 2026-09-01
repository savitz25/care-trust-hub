export const SFF_STATUSES = ["SFF", "SFF_CANDIDATE", "NOT_SFF", "NOT_OBSERVED"] as const;
export type SffStatus = (typeof SFF_STATUSES)[number];

export const ABUSE_ICON_STATUSES = ["DESIGNATED", "NOT_DESIGNATED", "NOT_OBSERVED"] as const;
export type AbuseIconStatus = (typeof ABUSE_ICON_STATUSES)[number];

export const DIRECTORY_STATUSES = [
  "CURRENT_ACTIVE",
  "ABSENT_FROM_CURRENT_DIRECTORY",
  "TERMINATED_CONFIRMED",
  "HISTORICAL",
  "STATUS_UNKNOWN",
] as const;
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

export function sffConsumerExplanation(status: SffStatus): string {
  if (status === "SFF") {
    return "CMS currently identifies this nursing home as a Special Focus Facility. That is a CMS designation for facilities with a history of serious quality problems, not a Trust Hub ranking.";
  }
  if (status === "SFF_CANDIDATE") {
    return "CMS currently identifies this nursing home as a Special Focus Facility candidate. Candidate status is not the same as being designated a Special Focus Facility.";
  }
  if (status === "NOT_SFF") {
    return "CMS does not currently identify this nursing home as a Special Focus Facility or candidate in the loaded Provider Information extract.";
  }
  return "Trust Hub does not have a sufficient current CMS Special Focus observation for this facility.";
}

export function abuseIconConsumerExplanation(status: AbuseIconStatus): string {
  if (status === "DESIGNATED") {
    return "CMS currently applies its abuse-icon designation to this facility. That is CMS's published designation, not a Trust Hub verdict.";
  }
  if (status === "NOT_DESIGNATED") {
    return "CMS does not currently apply its abuse-icon designation to this facility in the loaded Provider Information extract.";
  }
  return "Trust Hub does not have a sufficient current CMS abuse-icon observation for this facility.";
}

export function directoryStatusConsumerExplanation(status: DirectoryStatus): string {
  if (status === "CURRENT_ACTIVE") {
    return "This CMS Certification Number appears in the latest CMS Nursing Home Provider Information extract of currently listed nursing homes.";
  }
  if (status === "ABSENT_FROM_CURRENT_DIRECTORY") {
    return "This CMS Certification Number is not in the latest Provider Information extract. Absence from the current directory is not proof the facility is closed or terminated.";
  }
  if (status === "TERMINATED_CONFIRMED") {
    return "An authoritative CMS termination record confirms this certification ended.";
  }
  return "Current operating status is unknown from the loaded CMS sources.";
}

export const ENROLLMENT_NPI_LABEL =
  "Medicare enrollment organization NPI associated with this CMS Certification Number";

export const MDS_NOT_STAR_RATING =
  "These MDS quality measures are individual CMS-published scores. They are not the CMS quality-measure star rating.";
