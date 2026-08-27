import type { HomeHealthProviderIntelligence, HospiceProviderIntelligence } from "@care/domain";
import {
  HomeHealthProfileIntelligence,
  HospiceProfileIntelligence,
} from "./agency-profile-intelligence";

export function AgencyProfilePage({
  intel,
}: {
  intel: HomeHealthProviderIntelligence | HospiceProviderIntelligence;
}) {
  const office = intel.common.office;
  const name = intel.common.display_name ?? "CMS provider";
  const identifierLabel =
    intel.provider_type === "home_health" ? "CMS Home Health CCN" : "CMS Hospice CCN";
  const directoryLine =
    intel.directory.projection === "KNOWN_NOT_CURRENT"
      ? intel.provider_type === "home_health"
        ? "Not listed in the current CMS Home Health agency directory"
        : "Not listed in the current CMS Hospice General Information directory"
      : intel.directory.projection === "EVIDENCE_ONLY"
        ? "Quality evidence is on file; this CCN is not in the current Hospice directory"
        : intel.provider_type === "home_health"
          ? "Listed in the current CMS Home Health agency directory"
          : "Listed in the current CMS Hospice General Information directory";
  return (
    <div className="investigation-page real-investigation-page">
      <div className="page-shell">
        <header className="facility-hero">
          <div>
            <p className="eyebrow">
              {intel.provider_type === "home_health" ? "CMS Home Health agency" : "CMS Hospice"}
            </p>
            <h1>{name}</h1>
            <p className="lede">
              {[office.city, office.state].filter(Boolean).join(", ")}
            </p>
            <div className="facility-hero__meta">
              <span>
                {identifierLabel} {intel.canonical_id}
              </span>
              {office.phone ? <span>{office.phone}</span> : null}
              <span>{directoryLine}</span>
            </div>
          </div>
        </header>
        {intel.provider_type === "home_health" ? (
          <HomeHealthProfileIntelligence intel={intel} />
        ) : (
          <HospiceProfileIntelligence intel={intel} />
        )}
      </div>
    </div>
  );
}
