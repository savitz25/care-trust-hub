import Link from "next/link";
import {
  VA_SOURCE_CATALOG,
  formatHubCount,
  vaTraceMetrics,
  type VaPublicSnapshot,
  type VaTraceMetric,
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

function Trace({ metric }: { metric: VaTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
      <p>{metric.computation}</p>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Agency clock: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
        <li>Source grain: {metric.sourceGrain}</li>
        <li>
          Numerator: {metric.numerator == null ? "Not a rate" : formatHubCount(metric.numerator)}
        </li>
        <li>
          Denominator:{" "}
          {metric.denominator == null ? "Not a share" : formatHubCount(metric.denominator)}
        </li>
        <li>Coverage: {metric.coverageState}</li>
        <li>Limitation: {metric.caveat}</li>
      </ul>
    </details>
  );
}

export function VaIntelligenceView({ intel }: { intel: VaPublicSnapshot }) {
  const traces = vaTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const cms = intel.cmsOverlay;
  const alf = intel.dssAlf;
  const insp = intel.dssAlfInspections;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="va-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="va-scale-title">Source families, not one Virginia senior-provider total</h2>
          <p>
            Virginia DSS Assisted Living, Virginia DSS Adult Day, CMS Nursing Homes, CMS Home
            Health, and CMS Hospice are not added together. Assisted living is not a nursing home. A
            state license is not a CMS CCN. No score and no ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Licensed DSS Assisted Living Facilities"
            value={formatHubCount(alf.licensedFacilityCount)}
            note="Complete official search universe. VA-DSS-ALF:{licenseId}."
          />
          <Stat
            label="Licensed ALF capacity"
            value={formatHubCount(alf.licensedCapacitySum)}
            note="Sum of source licensed-capacity fields. Not occupancy."
          />
          <Stat
            label="ALF inspection observations"
            value={formatHubCount(insp.observationCount)}
            note="One DSS inspection row = one observation."
          />
          <Stat
            label="CMS Nursing Homes in Virginia"
            value={formatHubCount(cms.nursingHomes)}
            note={`Independent overlay · as of ${cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Home Health in Virginia"
            value={formatHubCount(cms.homeHealth)}
            note="Independent overlay. Not a VDH HCO roster."
          />
          <Stat
            label="CMS Hospice in Virginia"
            value={formatHubCount(cms.hospice)}
            note="Independent overlay. Not a VDH hospice roster."
          />
        </div>
        {trace("dss-alf-count") ? <Trace metric={trace("dss-alf-count")!} /> : null}
        {trace("dss-alf-capacity") ? <Trace metric={trace("dss-alf-capacity")!} /> : null}
      </section>

      <section aria-labelledby="va-alf-title">
        <div className="section-heading">
          <p className="eyebrow">Virginia-specific prize</p>
          <h2 id="va-alf-title">Assisted living is a DSS license, not a CMS nursing home</h2>
          <p>
            The Virginia Department of Social Services Division of Licensing Programs licenses
            Assisted Living Facilities. {formatHubCount(alf.licensedFacilityCount)} licensed
            facilities were enumerated from the official search JSON. Identity is{" "}
            <code>VA-DSS-ALF:{"{licenseId}"}</code>. Facility name is not identity. Name-only joins
            to CMS are unsafe and were not attempted.
          </p>
          <p>
            License types in this snapshot: {alf.licenseTypes["1YR"]} 1YR, {alf.licenseTypes["2YR"]}{" "}
            2YR, {alf.licenseTypes["3YR"]} 3YR, {alf.licenseTypes.COND} COND,{" "}
            {alf.licenseTypes.PROV} PROV. Those are license terms, not quality tiers. Qualifications
            such as Assisted Living, Special Care, Non-Ambulatory, Ambulatory Only, and
            ResidentialOnly are regulatory designations, not ratings. Licensed capacity is not
            occupancy.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.alfSearch}>Official DSS Assisted Living search</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.alfHub}>DSS Assisted Living Facilities hub</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="va-insp-title">
        <div className="section-heading">
          <p className="eyebrow">Inspection intelligence</p>
          <h2 id="va-insp-title">Inspection flags are observations, not guilt</h2>
          <p>
            {formatHubCount(insp.observationCount)} inspection observations were returned for{" "}
            {formatHubCount(insp.facilitiesWithAtLeastOneObservation)} of{" "}
            {formatHubCount(alf.licensedFacilityCount)} licensed ALFs.{" "}
            {formatHubCount(insp.complaintRelatedObservations)} observations have a non-zero
            complaintNumber. {formatHubCount(insp.violationFlagYes)} have violations=Y.
          </p>
          <p>
            A complaint-related inspection is not a substantiated complaint. Violations=Y is not the
            number of violations. An inspection is not a disciplinary action. No violation shown is
            not a perfect facility. Detailed violation PDFs were not crawled.
          </p>
        </div>
        {trace("dss-alf-inspections") ? <Trace metric={trace("dss-alf-inspections")!} /> : null}
        {trace("dss-alf-complaint-related") ? (
          <Trace metric={trace("dss-alf-complaint-related")!} />
        ) : null}
        {trace("dss-alf-violation-flag") ? (
          <Trace metric={trace("dss-alf-violation-flag")!} />
        ) : null}
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.complaint}>Submit a DSS licensing complaint</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="va-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal spine</p>
          <h2 id="va-cms-title">CMS Nursing Homes, Home Health, and Hospice stay separate</h2>
          <p>
            CMS Virginia overlays are {formatHubCount(cms.nursingHomes)} Nursing Homes,{" "}
            {formatHubCount(cms.homeHealth)} Home Health agencies, and {formatHubCount(cms.hospice)}{" "}
            Hospice providers. They already live in national CMS totals and are not added again.
            Nursing Home != Home Health != Hospice. CMS star ratings are not a TrustHub rating.
          </p>
        </div>
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.cmsCareCompare}>CMS Care Compare</Link>
          </li>
          <li>
            <Link href="/search?search=1&state=VA">Search Virginia CMS directories</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="va-vdh-title">
        <div className="section-heading">
          <p className="eyebrow">VDH easy-win audit</p>
          <h2 id="va-vdh-title">VDH remains a verification path, not a second CMS</h2>
          <p>
            The VDH Nursing Home Informational Portal and LTC survey library are useful live
            verification paths. They are interactive or document-heavy, so they are not bulk
            acquired here. Search-only is not zero. CMS already supplies the nursing-home backbone.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.vdhNursingHomePortal}>
              VDH Office of Licensure and Certification
            </Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.vdhLtcSurveys}>
              VDH nursing home / ICF survey library
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="va-adc-title">
        <div className="section-heading">
          <p className="eyebrow">Same DSS adapter</p>
          <h2 id="va-adc-title">Adult Day Centers stay a separate class</h2>
          <p>
            The same DSS search architecture exposes{" "}
            {formatHubCount(intel.dssAdc.licensedFacilityCount)} licensed Adult Day Centers. Adult
            Day is not Assisted Living and is not a Nursing Home. The classes are not added
            together.
          </p>
        </div>
        {trace("dss-adc-count") ? <Trace metric={trace("dss-adc-count")!} /> : null}
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.adcSearch}>Official DSS Adult Day Center search</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="va-claim-title">
        <div className="section-heading">
          <p className="eyebrow">Publication contract</p>
          <h2 id="va-claim-title">Research identity is not a claimable profile</h2>
          <p>
            This ticket does not create public Virginia ALF profile routes and does not broaden
            claim eligibility. A DSS search result is not a verified organization. SourceAsOf for
            the DSS JSON is unknown; retrieval date is not a source date.
          </p>
        </div>
        {trace("net-new-profiles") ? <Trace metric={trace("net-new-profiles")!} /> : null}
      </section>

      <section aria-labelledby="va-catalog-title">
        <div className="section-heading">
          <p className="eyebrow">Source catalog</p>
          <h2 id="va-catalog-title">What was grabbed, and what was left</h2>
        </div>
        <ul className="hub-plain-list">
          {VA_SOURCE_CATALOG.map((row) => (
            <li key={row.id}>
              <strong>{row.source}.</strong> {row.coverage}. {row.limitations}
            </li>
          ))}
        </ul>
        <ul className="hub-plain-list">
          {intel.juiceSqueeze.map((row) => (
            <li key={row.source}>
              <strong>{row.decision}.</strong> {row.source} — {row.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
