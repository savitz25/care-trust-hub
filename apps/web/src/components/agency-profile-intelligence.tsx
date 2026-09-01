import {
  agencyDirectoryBanner,
  chowUnsupportedCopy,
  cmsMeasureAvailabilityCopy,
  partyCapCopy,
  type AgencyQualityFamily,
  type HomeHealthProviderIntelligence,
  type HospiceProviderIntelligence,
  type ProviderIntelParty,
} from "@care/domain";
import { CmsStarRating } from "./real-provider";

function formatDay(value: string | null | undefined): string {
  if (!value) return "Not reported";
  const day = value.slice(0, 10);
  const [year, month, date] = day.split("-");
  if (!year || !month || !date) return day;
  return `${year}-${month}-${date}`;
}

function PartyList({
  title,
  parties,
  total,
  currentOnly = false,
}: {
  title: string;
  parties: ProviderIntelParty[];
  total: number;
  currentOnly?: boolean;
}) {
  const cap = partyCapCopy(parties.length, total);
  return (
    <section className="nh-intel-parties">
      <h3>{title}</h3>
      {total === 0 ? (
        <p>No resolved CMS/PECOS relationships in this category.</p>
      ) : (
        <ul>
          {parties.map((party) => (
            <li key={`${party.party_id}-${party.relationship_type}-${party.temporal_status}`}>
              <strong>{party.display_name}</strong>
              <span>
                {party.party_kind === "individual" ? "Individual owner" : "Organization"}
                {currentOnly ? "" : ` · ${party.temporal_status}`}
              </span>
              <span>{party.raw_cms_role}</span>
              {party.ownership_percentage != null ? (
                <span>{party.ownership_percentage}% ownership interest</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {cap ? <p className="nh-intel-cap">{cap}</p> : null}
    </section>
  );
}

function familyTitle(family: AgencyQualityFamily["family"]): string {
  if (family === "hh_quality") return "CMS quality-of-patient-care measures";
  if (family === "hh_hhcahps") return "CMS HHCAHPS patient-experience measures";
  if (family === "hospice_quality") return "CMS Hospice quality measures";
  return "CMS CAHPS Hospice Survey measures";
}

function FamilyList({ families }: { families: AgencyQualityFamily[] }) {
  if (families.length === 0) {
    return (
      <p>CMS measure observations are not reported for this provider in the loaded extracts.</p>
    );
  }
  return (
    <>
      {families.map((family) => (
        <section key={family.family} className="nh-intel-parties">
          <h3>{familyTitle(family.family)}</h3>
          <p>
            {family.observation_count} CMS observation
            {family.observation_count === 1 ? "" : "s"} in this family. Survey scores are not
            clinical quality scores.
          </p>
          <ul>
            {family.measures.map((measure) => (
              <li key={`${measure.family}-${measure.measure_code}-${measure.reporting_period}`}>
                <strong>{measure.official_name}</strong>
                <span>
                  {cmsMeasureAvailabilityCopy(
                    measure.availability,
                    measure.score,
                    measure.score_text,
                  )}
                </span>
                {measure.star_rating != null ? <CmsStarRating value={measure.star_rating} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function OwnershipBlock({
  intel,
}: {
  intel: HomeHealthProviderIntelligence | HospiceProviderIntelligence;
}) {
  return (
    <section className="profile-section" id="ownership-intel" aria-labelledby="own-title">
      <div className="section-heading">
        <p className="eyebrow">Ownership & management</p>
        <h2 id="own-title">Who CMS/PECOS connects to this provider</h2>
        <p>Current ownership uses CURRENT OWNED_BY evidence only. UNKNOWN is not a former owner.</p>
      </div>
      <PartyList
        title="Current owners"
        parties={intel.ownership_summary.current_owners}
        total={intel.ownership_summary.counts.current_owners ?? 0}
        currentOnly
      />
      <PartyList
        title="Operators"
        parties={intel.ownership_summary.operators}
        total={intel.ownership_summary.counts.operators ?? 0}
      />
      <PartyList
        title="Managers"
        parties={intel.ownership_summary.managers}
        total={intel.ownership_summary.counts.managers ?? 0}
      />
      <details>
        <summary>Ownership observations with UNKNOWN status</summary>
        <p>
          These relationships were observed in an older snapshot. UNKNOWN does not mean former
          owner, previous owner, or that ownership ended.
        </p>
        <PartyList
          title="UNKNOWN"
          parties={intel.ownership_summary.unknown_ownership_observations}
          total={intel.ownership_summary.counts.unknown_ownership_observations ?? 0}
        />
      </details>
    </section>
  );
}

function FreshnessAndMethod({
  intel,
}: {
  intel: HomeHealthProviderIntelligence | HospiceProviderIntelligence;
}) {
  const freshnessEntries = Object.entries(intel.evidence_as_of_by_family);
  return (
    <>
      <section className="profile-section" id="freshness" aria-labelledby="fresh-title">
        <div className="section-heading">
          <p className="eyebrow">Source freshness</p>
          <h2 id="fresh-title">How current each evidence family is</h2>
        </div>
        {freshnessEntries.length === 0 ? (
          <p>Source-specific freshness is not available for this request.</p>
        ) : (
          <dl className="nh-intel-fresh">
            {freshnessEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>
                  {value.band ?? "UNKNOWN"}
                  {value.source_modified_at
                    ? ` · source as of ${formatDay(value.source_modified_at)}`
                    : ""}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p>
          Profile generated {formatDay(intel.profile_generated_at)}. That timestamp is not CMS
          evidence freshness.
        </p>
      </section>
      <section className="profile-section" id="methodology" aria-labelledby="method-title">
        <div className="section-heading">
          <p className="eyebrow">Methodology</p>
          <h2 id="method-title">How Trust Hub researches this provider</h2>
        </div>
        <ul>
          {intel.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function HomeHealthProfileIntelligence({
  intel,
}: {
  intel: HomeHealthProviderIntelligence;
}) {
  const banner = agencyDirectoryBanner("home_health", intel.directory.projection);
  const star =
    intel.home_health?.cms_quality_of_patient_care_star ??
    intel.quality_summary.cms_quality_of_patient_care_star;
  const qualityFamily = intel.quality_summary.families.filter(
    (item) => item.family === "hh_quality",
  );
  const surveyFamily = intel.quality_summary.families.filter(
    (item) => item.family === "hh_hhcahps",
  );
  return (
    <div className="nh-intel">
      {banner ? (
        <aside className="nh-intel-banner" role="status">
          <p>{banner}</p>
        </aside>
      ) : null}
      <p className="nh-intel-kicker">
        Independent research from official CMS public records. No paid ranking. No Trust Hub quality
        score.
      </p>
      <p className="lede">
        Research this Home Health agency using CMS public records. CMS Home Health CCN{" "}
        {intel.canonical_id}. An office address is not proof of the ZIP codes CMS lists as coverage
        evidence.
      </p>
      <section className="nh-intel-glance" id="at-a-glance" aria-labelledby="glance-title">
        <div className="section-heading">
          <p className="eyebrow">At a glance</p>
          <h2 id="glance-title">CMS Home Health research snapshot</h2>
        </div>
        <div className="nh-intel-glance__grid">
          <div>
            <h3>CMS Quality of Patient Care star</h3>
            <CmsStarRating value={star?.value ?? null} />
            {star?.footnote ? <p>{star.footnote}</p> : null}
          </div>
          <div>
            <h3>CMS ZIP coverage records</h3>
            <p>
              {intel.geography.coverage.zip_observation_count
                ? `${intel.geography.coverage.zip_observation_count} CMS-published ZIP observations. Not a verified county service area.`
                : "Not reported"}
            </p>
          </div>
          <div>
            <h3>CMS ownership-change history</h3>
            <p>{chowUnsupportedCopy("home_health")}</p>
          </div>
        </div>
        <p className="provider-overview__note">
          These are CMS measures, not Trust Hub ratings. Missing evidence is shown as not reported,
          not as zero.
        </p>
      </section>
      <section className="profile-section" id="quality-evidence" aria-labelledby="quality-title">
        <div className="section-heading">
          <p className="eyebrow">Quality of patient care</p>
          <h2 id="quality-title">What CMS reports about Home Health quality</h2>
        </div>
        <FamilyList families={qualityFamily} />
      </section>
      <section className="profile-section" id="patient-experience" aria-labelledby="survey-title">
        <div className="section-heading">
          <p className="eyebrow">Patient experience</p>
          <h2 id="survey-title">CMS HHCAHPS survey measures</h2>
          <p>HHCAHPS scores are patient-experience survey results, not clinical quality scores.</p>
        </div>
        <FamilyList families={surveyFamily} />
      </section>
      <section className="profile-section" id="services" aria-labelledby="svc-title">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h2 id="svc-title">CMS-reported service offerings</h2>
        </div>
        {intel.services.length === 0 ? (
          <p>CMS service-offering fields are not reported for this agency in the loaded extract.</p>
        ) : (
          <ul className="nh-intel-flags">
            {intel.services.map((service) => (
              <li key={service.code}>
                {service.official_field}:{" "}
                {service.offered == null
                  ? "Not reported"
                  : service.offered
                    ? "Offered"
                    : "Not offered"}
              </li>
            ))}
          </ul>
        )}
      </section>
      <OwnershipBlock intel={intel} />
      <section className="profile-section" id="chow-history" aria-labelledby="chow-title">
        <div className="section-heading">
          <p className="eyebrow">Ownership change history</p>
          <h2 id="chow-title">CMS ownership-change records</h2>
        </div>
        <p>{chowUnsupportedCopy("home_health")}</p>
      </section>
      <FreshnessAndMethod intel={intel} />
    </div>
  );
}

export function HospiceProfileIntelligence({ intel }: { intel: HospiceProviderIntelligence }) {
  const banner = agencyDirectoryBanner("hospice", intel.directory.projection);
  const qualityFamily = intel.quality_summary.families.filter(
    (item) => item.family === "hospice_quality",
  );
  const surveyFamily = intel.quality_summary.families.filter(
    (item) => item.family === "hospice_cahps",
  );
  return (
    <div className="nh-intel">
      {banner ? (
        <aside className="nh-intel-banner" role="status">
          <p>{banner}</p>
        </aside>
      ) : null}
      <p className="nh-intel-kicker">
        Independent research from official CMS public records. No paid ranking. No Trust Hub quality
        score.
      </p>
      <p className="lede">
        Research this hospice using CMS public records. CMS Hospice CCN {intel.canonical_id}. An
        office county is not proof of the full service area.
      </p>
      <section className="nh-intel-glance" id="at-a-glance" aria-labelledby="glance-title">
        <div className="section-heading">
          <p className="eyebrow">At a glance</p>
          <h2 id="glance-title">CMS Hospice research snapshot</h2>
        </div>
        <div className="nh-intel-glance__grid">
          <div>
            <h3>Office county</h3>
            <p>
              {intel.hospice?.office_county_name ?? "Not reported"}. Office county is not a verified
              service area.
            </p>
          </div>
          <div>
            <h3>CMS ZIP coverage records</h3>
            <p>
              {intel.geography.coverage.zip_observation_count
                ? `${intel.geography.coverage.zip_observation_count} CMS-published ZIP observations. Not a verified county service area.`
                : "Not reported"}
            </p>
          </div>
          <div>
            <h3>CMS ownership-change history</h3>
            <p>{chowUnsupportedCopy("hospice")}</p>
          </div>
        </div>
        <p className="provider-overview__note">
          Hospice quality measures stay separate from CAHPS Hospice Survey results. Missing evidence
          is shown as not reported, not as zero.
        </p>
      </section>
      <section className="profile-section" id="quality-evidence" aria-labelledby="quality-title">
        <div className="section-heading">
          <p className="eyebrow">Quality measures</p>
          <h2 id="quality-title">What CMS reports about Hospice quality</h2>
        </div>
        <FamilyList families={qualityFamily} />
      </section>
      <section className="profile-section" id="family-experience" aria-labelledby="survey-title">
        <div className="section-heading">
          <p className="eyebrow">Family experience</p>
          <h2 id="survey-title">CMS CAHPS Hospice Survey measures</h2>
          <p>CAHPS Hospice Survey results are family-experience scores, not clinical quality.</p>
        </div>
        <FamilyList families={surveyFamily} />
      </section>
      <OwnershipBlock intel={intel} />
      <section className="profile-section" id="chow-history" aria-labelledby="chow-title">
        <div className="section-heading">
          <p className="eyebrow">Ownership change history</p>
          <h2 id="chow-title">CMS ownership-change records</h2>
        </div>
        <p>{chowUnsupportedCopy("hospice")}</p>
      </section>
      <FreshnessAndMethod intel={intel} />
    </div>
  );
}
