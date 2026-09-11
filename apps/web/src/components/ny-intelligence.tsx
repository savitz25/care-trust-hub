import Link from "next/link";
import {
  formatHubCount,
  nyTraceMetrics,
  type NyPublicSnapshot,
  type NyTraceMetric,
} from "@care/domain";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: NyTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
      <p>{metric.computation}</p>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Agency clock: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
        <li>Source grain: {metric.sourceGrain}</li>
        <li>Coverage: {metric.coverageState}</li>
        <li>Limitation: {metric.caveat}</li>
      </ul>
    </details>
  );
}

export function NyIntelligenceView({ intel }: { intel: NyPublicSnapshot }) {
  const traces = nyTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id)!;
  const nh = intel.nursingHomeProfile;
  const acf = intel.acf;
  const dnr = intel.doNotRefer;
  const cms = intel.cmsOverlay;
  const al = intel.assistedLivingDesignations;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="ny-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="ny-scale-title">Source families, not one New York senior-provider total</h2>
          <p>
            Adult Care Facilities, nursing homes, Do Not Refer observations, CMS Home Health, and
            CMS Hospice are not added together. Adult Home is not Enriched Housing. ALP is not ALR.
            LHCSA is not CMS Home Health. No score and no ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Adult Care Facility identities"
            value={formatHubCount(acf.acfFacilities)}
            note="381 Adult Homes + 146 Enriched Housing. Not nursing homes."
          />
          <Stat
            label="NYSDOH Nursing Home Profile facilities"
            value={formatHubCount(nh.sourceRows)}
            note="Facility_Info grain. Not the CMS directory count."
          />
          <Stat
            label="Nursing-home survey observations"
            value={formatHubCount(nh.surveyRows)}
            note="Surveys.csv rows. Not a deficiency count."
          />
          <Stat
            label="Do Not Refer observations"
            value={formatHubCount(dnr.observationCount)}
            note="Official PDF blocks. Not a blacklist score."
          />
          <Stat
            label="CMS Home Health Agencies in New York"
            value={formatHubCount(cms.homeHealth)}
            note="CMS HHA CCN overlay. Not LHCSA."
          />
          <Stat
            label="CMS Hospice providers in New York"
            value={formatHubCount(cms.hospice)}
            note="CMS Hospice overlay. Not Home Health."
          />
        </div>
        <Trace metric={trace("acf-count")} />
        <Trace metric={trace("nh-count")} />
        <Trace metric={trace("nh-surveys")} />
        <Trace metric={trace("dnr-count")} />
        <Trace metric={trace("cms-hha")} />
        <Trace metric={trace("cms-hospice")} />
      </section>

      <section className="hub-findings" aria-labelledby="ny-nh-title">
        <h2 id="ny-nh-title">Nursing homes</h2>
        <p>
          The Nursing Home Profile lists {formatHubCount(nh.sourceRows)} facilities (
          {formatHubCount(nh.distinctFacilityIds)} distinct Facility IDs). Source-native Medicare
          numbers appear on {formatHubCount(nh.rowsWithCcn)} rows ({formatHubCount(nh.distinctCcn)}{" "}
          distinct CCNs; {formatHubCount(nh.rowsWithoutCcn)} without CCN). CMS New York nursing
          homes are {formatHubCount(cms.nursingHomes)} — a different directory grain, not forced
          equal.
        </p>
        <p>
          Surveys: {formatHubCount(nh.surveyRows)} observations covering every Profile facility.
          Citations: {formatHubCount(nh.citationRows)} rows; IS_COMPLAINT=1 on{" "}
          {formatHubCount(nh.citationRowsIsComplaint1)} citation rows — that flag is not a complaint
          filing count. State enforcement/fine rows: {formatHubCount(nh.enforcementRows)} covering{" "}
          {formatHubCount(nh.enforcementFacilityCoverage)} facilities. A fine is not a criminal
          conviction.
        </p>
      </section>

      <section className="hub-findings" aria-labelledby="ny-acf-title">
        <h2 id="ny-acf-title">Adult Care / assisted living</h2>
        <p>
          {formatHubCount(acf.adultHomeFacilities)} Adult Homes and{" "}
          {formatHubCount(acf.enrichedHousingFacilities)} Enriched Housing Programs (
          {formatHubCount(acf.acfFacilities)} Facility IDs;{" "}
          {formatHubCount(acf.distinctOperatingCertificates)} operating certificates). Certification
          Bed rows ({formatHubCount(acf.ahBedCertificationRows)} Adult Home +{" "}
          {formatHubCount(acf.ehpBedCertificationRows)} Enriched Housing) are credentials, not extra
          facilities. Capacity is not occupancy.
        </p>
        <p>
          Designations at those sites: ALR {formatHubCount(al.alrFacilities)}, EALR{" "}
          {formatHubCount(al.ealrFacilities)}, SNALR {formatHubCount(al.snalrFacilities)},
          residential ALP {formatHubCount(al.alpResidentialFacilities)}. These are not summed as
          “assisted living facilities.” LHCSA specialty ALP (
          {formatHubCount(al.alpLhCsaSpecialtyFacilities)}) is a home-care class, not an Adult Home.
        </p>
      </section>

      <section className="hub-findings" aria-labelledby="ny-dnr-title">
        <h2 id="ny-dnr-title">Do Not Refer</h2>
        <p>
          {formatHubCount(dnr.observationCount)} official observations as of {dnr.sourceAsOf}. Exact
          operating-certificate matches to the current GI Adult Care universe:{" "}
          {formatHubCount(dnr.exactOpcertMatchesToCurrentGiAcf)}. Name-only remainder is not
          attached. Placement is not a criminal conviction and is not a TrustHub blacklist.
        </p>
      </section>

      <section className="hub-findings" aria-labelledby="ny-home-title">
        <h2 id="ny-home-title">Home care and hospice</h2>
        <p>
          State LHCSA Facility IDs: {formatHubCount(intel.homeCare.lhcsaDistinctFacilityIds)}. State
          CHHA Facility IDs: {formatHubCount(intel.homeCare.chhaDistinctFacilityIds)}. CMS Home
          Health remains {formatHubCount(cms.homeHealth)}. LHCSA is not CMS HHA. State hospice
          Facility IDs ({formatHubCount(cms.stateHospiceDistinctFacilities)}) were not name-matched
          to CMS hospice.
        </p>
      </section>

      <section className="hub-findings" aria-labelledby="ny-verify-title">
        <h2 id="ny-verify-title">Current verification</h2>
        <ul>
          <li>
            <a href={intel.regulatorMap.nursingHomeProfilesSite}>NYS Nursing Home Profiles</a>
          </li>
          <li>
            <a href={intel.regulatorMap.healthProfilesAcf}>NYS Health Profiles — Adult Care</a>
          </li>
          <li>
            <a href={intel.regulatorMap.doNotRefer}>Do Not Refer List (PDF)</a>
          </li>
          <li>
            <a href={intel.regulatorMap.cmsCareCompare}>Medicare Care Compare</a>
          </li>
        </ul>
        <p>
          <Link href="/search?search=1&state=NY">
            Research CMS providers with a New York location
          </Link>
        </p>
      </section>

      <section className="hub-findings" aria-labelledby="ny-not-title">
        <h2 id="ny-not-title">What these numbers do not mean</h2>
        <ul>
          <li>There is no combined New York senior-provider total.</li>
          <li>
            Adult Care Facility is not a nursing home. CMS CCN is not a state operating certificate.
          </li>
          <li>
            Inspection is not a deficiency count. Complaint-related citation is not a substantiated
            complaint.
          </li>
          <li>Missing ACF current-status flag is unknown, not zero. Search-only is not zero.</li>
          <li>No Trust Score. No ranking. New York City is not a separate route.</li>
        </ul>
      </section>
    </div>
  );
}
