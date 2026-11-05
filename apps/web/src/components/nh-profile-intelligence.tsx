import Link from "next/link";
import {
  NURSING_HOME_REPEATED_LIMITATIONS,
  chowAbsenceCopy,
  directoryBanner,
  partyCapCopy,
  type NursingHomeProviderIntelligence,
  type ProviderIntelParty,
} from "@care/domain";
import { ratingText } from "@/server/care/facility-profile-model";
import {
  CMS_OWNERSHIP_HREF,
  CMS_QUALITY_FAMILIES_HREF,
  CMS_RATINGS_HREF,
  CMS_RELEASE_DATES_HREF,
  CMS_RESEARCH_METHOD_HREF,
  NATIONAL_CMS_RELEASE_KEYS,
} from "./repeated-evidence-links";

const REPEATED_LIMITATIONS = new Set<string>(NURSING_HOME_REPEATED_LIMITATIONS);
const NATIONAL_RELEASE_KEYS = new Set<string>(NATIONAL_CMS_RELEASE_KEYS);
const MISSING_QUALITY_FAMILY = [
  ["mds", "MDS quality observations are not in the CMS extract."],
  ["pbj", "PBJ staffing records are not in the CMS extract."],
  ["inspection", "Inspection evidence is not in the CMS extract."],
  ["fire", "Fire-safety evidence is not in the CMS extract."],
] as const;

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
  if (parties.length === 0 || total === 0) return null;
  const cap = partyCapCopy(parties.length, total);
  return (
    <section className="nh-intel-parties">
      <h3>{title}</h3>
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
      {cap ? <p className="nh-intel-cap">{cap}</p> : null}
    </section>
  );
}

export function NhProfileIntelligence({ intel }: { intel: NursingHomeProviderIntelligence }) {
  if (intel.contract_version !== "provider-intel-v1") return null;
  const stars = intel.quality_summary.cms_stars;
  const flags = intel.quality_summary.nh_evidence_flags;
  const banner = directoryBanner(intel.directory.projection);
  const chowEvents = intel.chow.events ?? [];
  const freshnessEntries = Object.entries(intel.evidence_as_of_by_family);
  const facilityFreshness = freshnessEntries.filter(([key]) => !NATIONAL_RELEASE_KEYS.has(key));
  const facilityLimitations = intel.limitations.filter((item) => !REPEATED_LIMITATIONS.has(item));
  const missingQualityFamilies = MISSING_QUALITY_FAMILY.filter(([key]) => !flags?.[key]).map(
    ([, line]) => line,
  );
  const glance = [
    ["CMS overall rating", stars?.overall ?? null],
    ["CMS health inspection rating", stars?.health_inspection ?? null],
    ["CMS staffing rating", stars?.staffing ?? null],
    ["CMS quality-measure rating", stars?.quality_measure ?? null],
  ] as const;

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
        Research this nursing home using CMS and federal public records. CMS Certification Number{" "}
        {intel.canonical_id}.
      </p>

      <section className="nh-intel-glance" id="at-a-glance" aria-labelledby="glance-title">
        <div className="section-heading">
          <p className="eyebrow">At a glance</p>
          <h2 id="glance-title">CMS research snapshot</h2>
        </div>
        <div className="nh-intel-glance__grid">
          {glance.map(([label, value]) => {
            const text = ratingText(value);
            if (!text) return null;
            return (
              <div key={label}>
                <h3>{label}</h3>
                <p>{text}</p>
              </div>
            );
          })}
          <div>
            <h3>CMS ownership-change history</h3>
            <p>
              {(intel.chow.confirmed_event_count ?? 0) > 0
                ? `CMS has published ${intel.chow.confirmed_event_count} ownership-change record${
                    intel.chow.confirmed_event_count === 1 ? "" : "s"
                  } for this provider.`
                : "No attached CMS ownership-change event."}
            </p>
          </div>
          {flags?.sff ? (
            <div>
              <h3>CMS Special Focus Facility</h3>
              <p>
                CMS currently identifies Special Focus Facility or candidate status in the loaded
                Provider Information extract. That is a CMS designation, not a Trust Hub watchlist.
              </p>
            </div>
          ) : null}
        </div>
        <p className="provider-overview__note">
          <Link href={CMS_RATINGS_HREF}>How CMS star ratings are read</Link>
        </p>
      </section>

      <section className="profile-section" id="quality-evidence" aria-labelledby="quality-title">
        <div className="section-heading">
          <p className="eyebrow">Quality & care evidence</p>
          <h2 id="quality-title">What CMS reports about quality</h2>
        </div>
        {missingQualityFamilies.length > 0 ? (
          <ul className="nh-intel-flags">
            {missingQualityFamilies.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <p>
          <Link href={CMS_QUALITY_FAMILIES_HREF}>
            How CMS quality evidence families are reported
          </Link>
        </p>
      </section>

      <section className="profile-section" id="ownership-intel" aria-labelledby="own-title">
        <div className="section-heading">
          <p className="eyebrow">Ownership & management</p>
          <h2 id="own-title">Who CMS/PECOS connects to this nursing home</h2>
          <p>
            Current ownership uses CURRENT OWNED_BY evidence only. UNKNOWN is not a former owner.
          </p>
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
        <PartyList
          title="Enrollment organizations"
          parties={intel.ownership_summary.enrollment_organizations}
          total={intel.ownership_summary.counts.enrollment_organizations ?? 0}
        />
        {intel.ownership_summary.historical_ownership_observations.length > 0 &&
        (intel.ownership_summary.counts.historical_ownership_observations ?? 0) > 0 ? (
          <details>
            <summary>Historical ownership observations</summary>
            <PartyList
              title="Historical"
              parties={intel.ownership_summary.historical_ownership_observations}
              total={intel.ownership_summary.counts.historical_ownership_observations ?? 0}
            />
          </details>
        ) : null}
        <details>
          <summary>Ownership observations with UNKNOWN status</summary>
          <p>
            <Link href={CMS_OWNERSHIP_HREF}>How CMS ownership disclosures are read</Link>
          </p>
          <PartyList
            title="UNKNOWN"
            parties={intel.ownership_summary.unknown_ownership_observations}
            total={intel.ownership_summary.counts.unknown_ownership_observations ?? 0}
          />
        </details>
      </section>

      <section className="profile-section" id="chow-history" aria-labelledby="chow-title">
        <div className="section-heading">
          <p className="eyebrow">Ownership change history</p>
          <h2 id="chow-title">CMS ownership-change records</h2>
        </div>
        {chowEvents.length === 0 ? (
          <p>{chowAbsenceCopy()}</p>
        ) : (
          <>
            <p>CMS publishes Change of Ownership records for this nursing home.</p>
            <ol className="nh-intel-chow">
              {chowEvents.map((event) => (
                <li key={event.event_id}>
                  <p>
                    {event.safe_language ??
                      `CMS records show a Change of Ownership effective ${formatDay(event.effective_date)}.`}
                  </p>
                  <dl>
                    {event.cms_raw_type_text || event.normalized_type ? (
                      <div>
                        <dt>CMS type</dt>
                        <dd>{event.cms_raw_type_text ?? event.normalized_type}</dd>
                      </div>
                    ) : null}
                    {event.buyer_legal_entity ? (
                      <div>
                        <dt>Buyer legal entity</dt>
                        <dd>{event.buyer_legal_entity}</dd>
                      </div>
                    ) : null}
                    {event.seller_legal_entity ? (
                      <div>
                        <dt>Seller legal entity</dt>
                        <dd>{event.seller_legal_entity}</dd>
                      </div>
                    ) : null}
                    {event.effective_date ? (
                      <div>
                        <dt>Effective date</dt>
                        <dd>{formatDay(event.effective_date)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ol>
            <p>
              These are CMS transaction records. They are not a Trust Hub quality, stability, or
              sale judgment.
            </p>
          </>
        )}
      </section>

      <section className="profile-section" id="freshness" aria-labelledby="fresh-title">
        <div className="section-heading">
          <p className="eyebrow">Source freshness</p>
          <h2 id="fresh-title">How current each evidence family is</h2>
        </div>
        <p>
          <Link href={CMS_RELEASE_DATES_HREF}>CMS evidence family release dates</Link>
        </p>
        {facilityFreshness.length > 0 ? (
          <dl className="nh-intel-fresh">
            {facilityFreshness.map(([key, value]) => (
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
        ) : freshnessEntries.length === 0 ? (
          <p>Source-specific freshness is not available for this request.</p>
        ) : null}
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
        <p>
          <Link href={CMS_RESEARCH_METHOD_HREF}>How Trust Hub reads CMS nursing-home records</Link>
        </p>
        {facilityLimitations.length > 0 ? (
          <ul>
            {facilityLimitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
