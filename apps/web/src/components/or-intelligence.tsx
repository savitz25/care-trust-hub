import Link from "next/link";
import {
  formatHubCount,
  orTraceMetrics,
  type OrPublicSnapshot,
  type OrTraceMetric,
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

function Trace({ metric }: { metric: OrTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number</summary>
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

export function OrIntelligenceView({ intel }: { intel: OrPublicSnapshot }) {
  const traces = orTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const p = intel.odhsProviders;
  const cms = intel.cmsOverlay;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="or-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="or-scale-title">Provider classes, not one Oregon senior-facilities total</h2>
          <p>
            ODHS Nursing Facilities, Assisted Living, Residential Care, and Adult Foster Homes are
            not added together. CMS Nursing Homes, Home Health, and Hospice are federal overlays.
            OHA Home Health licenses are not CMS Home Health CCNs. No score and no ranking.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="ODHS open Nursing Facilities"
            value={formatHubCount(p.OPEN_NF)}
            note="State NF identities · Status=Open"
          />
          <Stat
            label="ODHS open Assisted Living Facilities"
            value={formatHubCount(p.OPEN_ALF)}
            note="ALF != RCF != AFH"
          />
          <Stat
            label="ODHS open Residential Care Facilities"
            value={formatHubCount(p.OPEN_RCF)}
            note="Includes memory-care RCFs as a service flag"
          />
          <Stat
            label="ODHS open Adult Foster Homes"
            value={formatHubCount(p.OPEN_AFH)}
            note="AFH != facility classes above"
          />
        </div>
        {trace("odhs-nf") ? <Trace metric={trace("odhs-nf")!} /> : null}
        {trace("odhs-alf") ? <Trace metric={trace("odhs-alf")!} /> : null}
      </section>

      <section aria-labelledby="or-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Federal overlay</p>
          <h2 id="or-cms-title">CMS Oregon directories stay on CCN identity</h2>
          <p>
            CMS Nursing Home CCN is not an ODHS Nursing Facility license. Matching open-NF and CMS
            NH counts of {formatHubCount(cms.nursingHomes)} is not an exact CCN bridge. Exact
            state→CMS bridges in this snapshot: {intel.crosswalk.exactStateToCmsBridges}.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="CMS Nursing Homes in Oregon" value={formatHubCount(cms.nursingHomes)} />
          <Stat label="CMS Home Health Agencies in Oregon" value={formatHubCount(cms.homeHealth)} />
          <Stat label="CMS Hospice providers in Oregon" value={formatHubCount(cms.hospice)} />
        </div>
        {trace("cms-nh") ? <Trace metric={trace("cms-nh")!} /> : null}
      </section>

      <section aria-labelledby="or-oha-title">
        <div className="section-heading">
          <p className="eyebrow">Oregon Health Authority</p>
          <h2 id="or-oha-title">Home Health and Hospice licenses are quarterly OHA lists</h2>
          <p>
            OHA Home Health license {formatHubCount(intel.ohaHomeHealth.rows)} is not CMS Home
            Health {formatHubCount(cms.homeHealth)}. OHA Hospice{" "}
            {formatHubCount(intel.ohaHospice.rows)} is not CMS Hospice {formatHubCount(cms.hospice)}
            .
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="OHA Home Health licenses"
            value={formatHubCount(intel.ohaHomeHealth.rows)}
            note="State license != CMS Home Health CCN"
          />
          <Stat
            label="OHA Hospice licenses"
            value={formatHubCount(intel.ohaHospice.rows)}
            note="State license != CMS Hospice CCN"
          />
        </div>
      </section>

      <section aria-labelledby="or-insp-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections</p>
          <h2 id="or-insp-title">One Event ID is one inspection observation</h2>
          <p>
            {formatHubCount(intel.odhsInspections.INSPECTION_ROWS)} inspection rows equal{" "}
            {formatHubCount(intel.odhsInspections.DISTINCT_EVENT_IDS)} Event IDs. Deficiencies cited
            on a row are not extra inspections.{" "}
            {formatHubCount(intel.odhsInspections.COMPLAINT_RELATED_INSPECTION_ROWS)} rows have
            complaint-related inspection types. That is inspection evidence, not a complaint filing
            count. ODHS displays five years of inspection history.
          </p>
        </div>
      </section>

      <section aria-labelledby="or-viol-title">
        <div className="section-heading">
          <p className="eyebrow">Substantiated violations</p>
          <h2 id="or-viol-title">Listed violations are substantiated; appeals are excluded</h2>
          <p>
            {formatHubCount(intel.odhsViolations.VIOLATION_ROWS)} violation rows /{" "}
            {formatHubCount(intel.odhsViolations.DISTINCT_VIOLATION_MATTERS)} report numbers.{" "}
            {formatHubCount(intel.odhsViolations.LICENSING_VIOLATION_ROWS)} licensing-violation rows
            and {formatHubCount(intel.odhsViolations.ABUSE_SUBSTANTIATED_ROWS)} abuse-substantiated
            rows. Open investigations and complaints being appealed by the provider are not listed.
            A substantiated violation is not a complaint.
          </p>
        </div>
      </section>

      <section aria-labelledby="or-action-title">
        <div className="section-heading">
          <p className="eyebrow">Regulatory actions — limited public scope</p>
          <h2 id="or-action-title">
            Public ODHS regulatory-action dataset currently shows license conditions
          </h2>
          <p>
            {intel.odhsRegulatoryActions.scopeNote}{" "}
            {formatHubCount(intel.odhsRegulatoryActions.REGULATORY_ACTION_ROWS)} action rows /{" "}
            {formatHubCount(intel.odhsRegulatoryActions.UNIQUE_REGULATORY_MATTERS)} unique Sanction
            identifiers. Absence of other action types is not a clean history. A license condition
            is not a revocation universe.
          </p>
        </div>
      </section>

      <section aria-labelledby="or-limits-title">
        <div className="section-heading">
          <p className="eyebrow">What these numbers do not mean</p>
          <h2 id="or-limits-title">No combined Oregon facilities total</h2>
          <ul>
            <li>Credential != unique company.</li>
            <li>Person/AFH identity != facility identity.</li>
            <li>
              Inspection != complaint. Violation != complaint. Regulatory action != violation.
            </li>
            <li>Missing or unlisted != zero. Search-only != zero.</li>
            <li>No Trust Score. No AggregateRating. No ranking.</li>
          </ul>
          <p>
            Official lookup:{" "}
            <Link href={intel.regulatorMap.ltcSearch}>
              ODHS Licensed Long-Term Care Settings Search
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
