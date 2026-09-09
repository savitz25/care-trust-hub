import Link from "next/link";
import {
  CO_SOURCE_CATALOG,
  formatHubCount,
  coTraceMetrics,
  type CoPublicSnapshot,
  type CoTraceMetric,
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

function Trace({ metric }: { metric: CoTraceMetric }) {
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

export function CoIntelligenceView({ intel }: { intel: CoPublicSnapshot }) {
  const traces = coTraceMetrics(intel);
  const trace = (id: string) => traces.find((row) => row.id === id);
  const cms = intel.cmsOverlay;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="co-scale-title">
        <div className="section-heading">
          <p className="eyebrow">Separate official universes</p>
          <h2 id="co-scale-title">Source families, not one Colorado senior-provider total</h2>
          <p>
            CMS Nursing Homes, CMS Home Health, CMS Hospice, CDPHE verification, and Assisted
            Living Residences are not added together. CMS is the bulk identity spine. CDPHE is the
            state verification and inspection context.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CMS Nursing Homes in Colorado"
            value={formatHubCount(cms.nursingHomes)}
            note={`Independent overlay · as of ${cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Home Health in Colorado"
            value={formatHubCount(cms.homeHealth)}
            note={`Independent overlay · as of ${cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CMS Hospice in Colorado"
            value={formatHubCount(cms.hospice)}
            note={`Independent overlay · as of ${cms.clocks.hospice.sourceModifiedAt.slice(0, 10)}`}
          />
          <Stat
            label="CDPHE Find and Compare"
            value="Search-only"
            note="Live verification path. Not a bulk roster count."
          />
          <Stat
            label="Assisted Living Residences"
            value="No current bulk"
            note="Separate state class. Press counts are not used."
          />
        </div>
        {trace("cms-nh-overlay") ? <Trace metric={trace("cms-nh-overlay")!} /> : null}
        {trace("cdphe-universe") ? <Trace metric={trace("cdphe-universe")!} /> : null}
      </section>

      <section aria-labelledby="co-findings-title">
        <div className="section-heading">
          <p className="eyebrow">What the files show</p>
          <h2 id="co-findings-title">Source-backed findings</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.findings.map((finding) => (
            <li key={finding.id}>
              <strong>{finding.title}.</strong> {finding.summary} This does not mean{" "}
              {finding.doesNotMean.join("; ")}.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="co-regulate-title">
        <div className="section-heading">
          <p className="eyebrow">Question 1</p>
          <h2 id="co-regulate-title">What senior-care classes does Colorado regulate?</h2>
          <p>
            CDPHE HFEMSD licenses Nursing Care Facilities (Chapter 5), Assisted Living Residences
            (Chapter 7), Home Care Agencies Class A and Class B (Chapter 26), and Hospices (Chapter
            21). CMS separately certifies Nursing Homes, Home Health, and Hospice. Alternative Care
            Facilities are a Medicaid certification on an ALR. Home Care Placement Agencies are not
            Home Care Agencies. Adult Day is not Assisted Living. Nursing Home != Home Health !=
            Hospice.
          </p>
        </div>
      </section>

      <section aria-labelledby="co-cms-title">
        <div className="section-heading">
          <p className="eyebrow">Questions 2–4</p>
          <h2 id="co-cms-title">Which CMS-certified facilities can TrustHub research?</h2>
          <p>
            CMS Nursing Homes, Home Health, and Hospice in Colorado use existing national CCN
            routes. Accepted unique CCN counts are {formatHubCount(cms.nursingHomes)} /{" "}
            {formatHubCount(cms.homeHealth)} / {formatHubCount(cms.hospice)}. CMS CCN is preserved.
            A state license is not a CMS CCN unless an exact official ID establishes the
            relationship. Home Health office address is not a service area. Hospice is not Home
            Health. These Colorado partitions already live in national CMS totals and are not added
            again.
          </p>
        </div>
        {trace("cms-hha-overlay") ? <Trace metric={trace("cms-hha-overlay")!} /> : null}
        {trace("cms-hospice-overlay") ? <Trace metric={trace("cms-hospice-overlay")!} /> : null}
      </section>

      <section aria-labelledby="co-alr-title">
        <div className="section-heading">
          <p className="eyebrow">Question 5</p>
          <h2 id="co-alr-title">Assisted Living Residence is not a Nursing Home</h2>
          <p>
            Colorado Assisted Living Residences are licensed under 6 CCR 1011-1 Chapter 7. They are
            a separate state class. No current official ALR roster was acquired this ticket, so no
            ALR count is published. Approximate assisted-living press counts are not network
            metrics. State-only ALR profiles are not created without a safe identity source. ALR !=
            Nursing Home.
          </p>
        </div>
        {trace("alr-count") ? <Trace metric={trace("alr-count")!} /> : null}
      </section>

      <section aria-labelledby="co-verify-title">
        <div className="section-heading">
          <p className="eyebrow">Question 6</p>
          <h2 id="co-verify-title">How do I verify a Colorado facility with CDPHE?</h2>
          <p>
            CDPHE Find and Compare is {intel.cdpheVerification.CDPHE_FIND_AND_COMPARE}. The
            dashboard covers inspection results and self-reported occurrences from the last three
            years, including citations, regulation text, and plans of correction. Interactive search
            is the official path and is not scraped. Search-only is not zero. A search result is not
            the complete CDPHE universe and is not claim eligibility.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.findAndCompare}>CDPHE Find and Compare Facilities</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.findAndCompareDashboard}>
              Health Facility Search dashboard
            </Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.officialHub}>CDPHE Health Facilities</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.cmsCareCompare}>CMS Care Compare</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="co-inspect-title">
        <div className="section-heading">
          <p className="eyebrow">Question 7</p>
          <h2 id="co-inspect-title">Inspections, citations, occurrences, and complaints stay distinct</h2>
          <p>
            A citation is not a penalty. An occurrence is not a violation. A plan of correction is
            not an admission. Inspection is not deficiency is not enforcement. Staffing is not
            quality. CMS stars are not a TrustHub rating. The public complaint-intake process is not
            a complaint dataset. Name-only adverse attachment is unsafe. CMS Nursing Home
            inspection, deficiency, penalty, staffing, and ownership stay on exact CCN. Home Health
            and Hospice have no CMS national inspection/enforcement file on this hub.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.complaints}>CDPHE health facilities complaint contacts</Link>
          </li>
          <li>
            <Link href={intel.regulatorMap.nursingHomeSurveys}>How the state surveys nursing homes</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="co-nha-title">
        <div className="section-heading">
          <p className="eyebrow">Question 8</p>
          <h2 id="co-nha-title">Nursing Home Administrator licenses are people, not facilities</h2>
          <p>
            DORA licenses Nursing Home Administrators as a person-grain profession. That lookup is a
            public research path. It is not a facility count and does not create person pages. NHA
            != facility.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>
            <Link href={intel.regulatorMap.doraLicenseLookup}>DORA professional license lookup</Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="co-stale-title">
        <div className="section-heading">
          <p className="eyebrow">Stale source exclusion</p>
          <h2 id="co-stale-title">The 2017 CDPHE GIS file is not a current roster</h2>
          <p>
            Colorado Information Marketplace dataset 98pp-s4r4 is a January 2017 address-derived
            point file. It is historical and stale. It cannot be promoted to current identity and
            cannot be used as a current Colorado facility roster.
          </p>
        </div>
      </section>

      <section aria-labelledby="co-claim-title">
        <div className="section-heading">
          <p className="eyebrow">Claim safety</p>
          <h2 id="co-claim-title">A state search result is not claim eligibility</h2>
          <p>
            Existing Senior claim rules remain authoritative. Colorado state intelligence does not
            broaden claim eligibility. A search result is not eligibility. Claimed is not verified.
            Colorado state verification does not automatically create new public facility profiles
            without safe identity.
          </p>
        </div>
      </section>

      <section aria-labelledby="co-added-title">
        <div className="section-heading">
          <p className="eyebrow">What this ticket added</p>
          <h2 id="co-added-title">Statewide research, not a bulk directory build</h2>
          <p>
            Net-new canonical organizations:{" "}
            {formatHubCount(intel.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS)}. CMS Colorado
            CCNs were already in the national graph. No current CDPHE bulk identities were minted.
            This page does not create Colorado county routes, a Denver page, or local facility
            pages. No Trust Score. No ranking. No AggregateRating.
          </p>
        </div>
        {trace("net-new-canonical") ? <Trace metric={trace("net-new-canonical")!} /> : null}
      </section>

      <section aria-labelledby="co-depth-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="co-depth-title">What each source can support</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>Colorado source catalog. Missing is unknown, not zero.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Agency</th>
                <th scope="col">Count</th>
                <th scope="col">Identity</th>
                <th scope="col">Access</th>
                <th scope="col">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {CO_SOURCE_CATALOG.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.source}</th>
                  <td>{row.agency}</td>
                  <td>{row.rows == null ? "—" : formatHubCount(row.rows)}</td>
                  <td>{row.identityKey}</td>
                  <td>{row.access}</td>
                  <td>{row.limitations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
