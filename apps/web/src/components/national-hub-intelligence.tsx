import Link from "next/link";
import {
  STATE_NAMES,
  coverageShare,
  formatHubCount,
  type SeniorNationalIntelligence,
  type StarDistribution,
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

function StarTable({ id, title, dist }: { id: string; title: string; dist: StarDistribution }) {
  return (
    <figure className="hub-stars">
      <figcaption id={`${id}-caption`}>{title}</figcaption>
      <p className="hub-kicker">{dist.label}</p>
      <div className="hub-table-scroll">
      <table className="hub-table hub-table--compact" aria-labelledby={`${id}-caption`}>
        <thead>
          <tr>
            <th scope="col">CMS stars</th>
            <th scope="col">Providers</th>
            <th scope="col">Share of reported</th>
            <th scope="col">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {(["5", "4", "3", "2", "1"] as const).map((star) => {
            const percent = dist.percentsOfReported[star] ?? 0;
            return (
              <tr key={star}>
                <th scope="row">{star} of 5 CMS stars</th>
                <td>{formatHubCount(dist.counts[star])}</td>
                <td>{percent.toFixed(1)}%</td>
                <td>
                  <span className="hub-bar" aria-hidden="true">
                    <span className="hub-bar__fill" style={{ width: `${percent}%` }} />
                  </span>
                </td>
              </tr>
            );
          })}
          <tr>
            <th scope="row">Not reported</th>
            <td>{formatHubCount(dist.missing)}</td>
            <td colSpan={2}>Missing is not a zero score</td>
          </tr>
        </tbody>
      </table>
      </div>
    </figure>
  );
}

export function NationalHubIntelligence({ intel }: { intel: SeniorNationalIntelligence }) {
  const nh = intel.nursingHome;
  const hh = intel.homeHealth;
  const hospice = intel.hospice;
  return (
    <div className="national-hub">
      <section className="hub-scale" aria-labelledby="hub-scale-title">
        <div className="section-heading">
          <p className="eyebrow">National CMS directories</p>
          <h2 id="hub-scale-title">Three provider classes, not one senior-care total</h2>
          <p>
            Nursing Homes, Home Health agencies, and Hospice providers are different CMS programs.
            They use different identifiers, measures, and ownership-change sources. SeniorTrustHub
            does not add them into a single “senior facilities” number, because that would mix
            unlike directories and would not count unique companies.
          </p>
        </div>
        <div className="hub-class-grid">
          <article className="hub-card">
            <p className="eyebrow">Nursing Homes</p>
            <h3>{formatHubCount(nh.current)} current</h3>
            <p>
              CMS Nursing Home Provider Information. Identity is the CMS certification number (CCN).{" "}
              {formatHubCount(nh.known)} known CCNs exist in the research graph; absence from the
              current directory is not proof a facility closed.
            </p>
            <ul>
              <li>
                CMS overall star reported: {coverageShare(nh.starDistribution.reported, nh.current)}
              </li>
              <li>
                Staffing (PBJ) evidence:{" "}
                {coverageShare(nh.coverage.staffingPbjProviders, nh.current)}
              </li>
              <li>
                Inspection events on file:{" "}
                {coverageShare(nh.coverage.inspectionProviders, nh.current)}
              </li>
              <li>
                CURRENT OWNED_BY evidence: {coverageShare(nh.coverage.ownedByProviders, nh.current)}
              </li>
            </ul>
            <Link className="text-link" href="/search">
              Research Nursing Homes <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">Home Health Agencies</p>
            <h3>{formatHubCount(hh.current)} current</h3>
            <p>
              CMS Home Health Care Agencies directory. Identity is the CMS Home Health CCN. An
              office address is not a verified service area.
            </p>
            <ul>
              <li>
                CMS Quality of Patient Care star reported:{" "}
                {coverageShare(hh.starDistribution.reported, hh.current)}
              </li>
              <li>
                Quality-of-care observations:{" "}
                {coverageShare(hh.coverage.qualityOfPatientCareProviders, hh.current)}
              </li>
              <li>
                HHCAHPS observations: {coverageShare(hh.coverage.hhcahpsProviders, hh.current)}
              </li>
              <li>
                CURRENT OWNED_BY evidence: {coverageShare(hh.coverage.ownedByProviders, hh.current)}
              </li>
            </ul>
            <p className="hub-kicker">
              Quality of Patient Care stars stay separate from HHCAHPS. There is not yet a national
              Home Health name-search directory; profiles are researched by CCN.
            </p>
            <Link className="text-link" href="/home-health">
              Home Health research spine <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">Hospice Providers</p>
            <h3>{formatHubCount(hospice.current)} current GI</h3>
            <p>
              CMS Hospice General Information. Identity is the CMS Hospice CCN.{" "}
              {formatHubCount(hospice.evidenceOnly)} additional typed identities appear in quality
              files only. That is not proof they closed, and they are not in this current count.
            </p>
            <ul>
              <li>
                Quality-measure observations:{" "}
                {coverageShare(hospice.coverage.qualityMeasureProviders, hospice.current)}
              </li>
              <li>
                CAHPS Hospice observations:{" "}
                {coverageShare(hospice.coverage.cahpsProviders, hospice.current)}
              </li>
              <li>
                CURRENT OWNED_BY evidence:{" "}
                {coverageShare(hospice.coverage.ownedByProviders, hospice.current)}
              </li>
              <li>
                ZIP coverage records:{" "}
                {coverageShare(hospice.coverage.zipCoverageProviders, hospice.current)}
              </li>
            </ul>
            <p className="hub-kicker">
              Hospice quality measures stay separate from CAHPS Hospice Survey. There is not yet a
              national Hospice name-search directory.
            </p>
            <Link className="text-link" href="/hospice">
              Hospice research spine <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>

      <section className="entry-section" id="quality" aria-labelledby="hub-quality-title">
        <div className="section-heading">
          <p className="eyebrow">What CMS measures</p>
          <h2 id="hub-quality-title">Quality evidence families are not interchangeable</h2>
          <p>
            CMS stars remain CMS stars. They are not SeniorTrustHub scores. A Hospice measure is not
            an HH star, and neither is a Nursing Home overall rating.
          </p>
        </div>
        <StarTable
          id="nh-stars"
          title={`CMS overall star distribution for current Nursing Homes (${formatHubCount(nh.starDistribution.reported)} reported)`}
          dist={nh.starDistribution}
        />
        <StarTable
          id="hh-stars"
          title={`CMS Quality of Patient Care star distribution for current Home Health agencies (${formatHubCount(hh.starDistribution.reported)} reported)`}
          dist={hh.starDistribution}
        />
        <p>
          Hospice has no CMS overall star in this directory. Current GI providers with quality
          measures on file:{" "}
          {coverageShare(hospice.coverage.qualityMeasureProviders, hospice.current)}. Current GI
          providers with CAHPS Hospice observations:{" "}
          {coverageShare(hospice.coverage.cahpsProviders, hospice.current)}.
        </p>
      </section>

      <section className="entry-section" id="missing" aria-labelledby="hub-missing-title">
        <div className="section-heading">
          <p className="eyebrow">Missing data</p>
          <h2 id="hub-missing-title">Not reported is evidence availability, not a grade</h2>
        </div>
        <ul className="hub-plain-list">
          <li>
            {formatHubCount(nh.starDistribution.missing)} current Nursing Homes have no published
            CMS overall star in the latest snapshot.
          </li>
          <li>
            {formatHubCount(hh.starDistribution.missing)} current Home Health agencies have no
            published CMS Quality of Patient Care star, even when other quality observations exist.
          </li>
          <li>
            {formatHubCount(nh.current - nh.coverage.ownedByProviders)} current Nursing Homes,{" "}
            {formatHubCount(hh.current - hh.coverage.ownedByProviders)} current Home Health
            agencies, and {formatHubCount(hospice.current - hospice.coverage.ownedByProviders)}{" "}
            current Hospice providers do not currently have resolved OWNED_BY evidence.
          </li>
        </ul>
      </section>

      <section className="entry-section" id="ownership" aria-labelledby="hub-own-title">
        <div className="section-heading">
          <p className="eyebrow">Ownership evidence</p>
          <h2 id="hub-own-title">Who is connected in CMS/PECOS sources — not who is “better”</h2>
          <p>
            Ownership is a research graph, not a quality score. UNKNOWN is not a former owner. Large
            or private ownership is not labeled good or bad.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Canonical organizations"
            value={formatHubCount(intel.ownership.organizations)}
          />
          <Stat
            label="Person-party ownership observations"
            value={formatHubCount(intel.ownership.personEquityOwners)}
            note="Distinct individual parties on OWNERSHIP edges. Not a public person directory."
          />
          <Stat
            label="UNKNOWN ownership edges"
            value={formatHubCount(intel.ownership.unknownEdges)}
            note="UNKNOWN is not historical ownership or a confirmed sale."
          />
        </div>
        <h3>Observed CURRENT OWNED_BY coverage in current directories</h3>
        <ul className="hub-plain-list">
          <li>Nursing Homes: {coverageShare(nh.coverage.ownedByProviders, nh.current)}</li>
          <li>Home Health: {coverageShare(hh.coverage.ownedByProviders, hh.current)}</li>
          <li>Hospice: {coverageShare(hospice.coverage.ownedByProviders, hospice.current)}</li>
        </ul>
        <h3>Observed owner-network size</h3>
        <p className="hub-kicker">
          Count of organizations with CURRENT OWNED_BY links, grouped by how many provider entities
          they connect to. This is a size distribution, not a ranking of quality.
        </p>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Organizations by observed provider-entity count</caption>
            <thead>
              <tr>
                <th scope="col">Observed providers owned</th>
                <th scope="col">Organizations</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["1", "1"],
                  ["2_5", "2–5"],
                  ["6_10", "6–10"],
                  ["11_25", "11–25"],
                  ["26_50", "26–50"],
                  ["51_100", "51–100"],
                  ["101_plus", "101+"],
                ] as const
              ).map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{formatHubCount(intel.ownership.networkSize[key] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>CMS ownership-change events</h3>
        <p>
          Nursing Home CHOW: {formatHubCount(nh.chow.events)} events attached to{" "}
          {formatHubCount(nh.chow.providersWithHistory)} providers, from {nh.chow.sourceFamily}. A
          CHOW record is not a sale and is not a quality finding.
        </p>
        <p>
          Home Health CHOW: <strong>not available</strong>. {hh.chow.reason}
        </p>
        <p>
          Hospice CHOW: <strong>not available</strong>. {hospice.chow.reason}
        </p>
      </section>

      <section className="entry-section" id="regulatory" aria-labelledby="hub-reg-title">
        <div className="section-heading">
          <p className="eyebrow">Nursing Home inspections and enforcement</p>
          <h2 id="hub-reg-title">Separate event families, not one “negative events” score</h2>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Inspection events (observations)"
            value={formatHubCount(intel.regulatory.inspection.observations)}
            note={`${formatHubCount(intel.regulatory.inspection.currentProvidersWithObservation)} current Nursing Homes have at least one. ${intel.regulatory.inspection.dateMin} to ${intel.regulatory.inspection.dateMax}.`}
          />
          <Stat
            label="Deficiency findings (observations)"
            value={formatHubCount(intel.regulatory.deficiencies.observations)}
            note={`${formatHubCount(intel.regulatory.deficiencies.currentProvidersWithObservation)} current Nursing Homes. Complaint-tagged findings: ${formatHubCount(intel.regulatory.deficiencies.complaintObservations)}.`}
          />
          <Stat
            label="Penalty actions (observations)"
            value={formatHubCount(intel.regulatory.enforcement.observations)}
            note={`${formatHubCount(intel.regulatory.enforcement.fines)} fines and ${formatHubCount(intel.regulatory.enforcement.paymentDenials)} payment denials. ${formatHubCount(intel.regulatory.enforcement.currentProvidersWithObservation)} current Nursing Homes.`}
          />
        </div>
        <p className="hub-kicker">
          These are CMS Nursing Home datasets. They are not Home Health or Hospice enforcement
          files, and they are not a SeniorTrustHub severity score.
        </p>
      </section>

      <section className="entry-section" id="sources" aria-labelledby="hub-src-title">
        <div className="section-heading">
          <p className="eyebrow">Sources and freshness</p>
          <h2 id="hub-src-title">Each dataset keeps its own as-of date</h2>
          <p>
            Source modified / reporting period is evidence freshness. Last ingest success is
            operational status, not a substitute for the source date.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>
              CMS and related source families used in national SeniorTrustHub research
            </caption>
            <thead>
              <tr>
                <th scope="col">Dataset</th>
                <th scope="col">Agency</th>
                <th scope="col">Source as-of</th>
                <th scope="col">Reporting period</th>
                <th scope="col">Last ingest success</th>
                <th scope="col">Band</th>
              </tr>
            </thead>
            <tbody>
              {intel.sources.map((source) => (
                <tr key={source.datasetKey}>
                  <th scope="row">{source.displayName}</th>
                  <td>{source.sourceAgency}</td>
                  <td>{source.sourceModifiedAt?.slice(0, 10) ?? "Not reported"}</td>
                  <td>{source.sourcePeriod ?? "Not reported"}</td>
                  <td>{source.lastIngestSuccessAt?.slice(0, 10) ?? "Not reported"}</td>
                  <td>{source.freshnessBand ?? "UNKNOWN"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <Link className="text-link" href="/sources">
            Read the sources page <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>

      <section className="entry-section" id="geography" aria-labelledby="hub-geo-title">
        <div className="section-heading">
          <p className="eyebrow">National geography</p>
          <h2 id="hub-geo-title">Current directory counts by jurisdiction</h2>
          <p>
            DC and territories appear when CMS publishes them. This table is national aggregation,
            not a set of state Intelligence pages. Nursing Home counts link to the existing CMS
            Nursing Home search.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>
              Current CMS Nursing Home, Home Health, and Hospice directory counts by state or
              territory
            </caption>
            <thead>
              <tr>
                <th scope="col">Jurisdiction</th>
                <th scope="col">Nursing Homes</th>
                <th scope="col">Home Health</th>
                <th scope="col">Hospice</th>
              </tr>
            </thead>
            <tbody>
              {intel.geography.map((row) => (
                <tr key={row.state}>
                  <th scope="row">
                    {row.state} {STATE_NAMES[row.state] ? `· ${STATE_NAMES[row.state]}` : ""}
                  </th>
                  <td>
                    <Link href={`/search?search=1&state=${row.state}`}>
                      {formatHubCount(row.nursingHomes)}
                    </Link>
                  </td>
                  <td>{formatHubCount(row.homeHealth)}</td>
                  <td>{formatHubCount(row.hospice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">National current directories</th>
                <td>{formatHubCount(nh.current)}</td>
                <td>{formatHubCount(hh.current)}</td>
                <td>{formatHubCount(hospice.current)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="entry-section" id="methodology" aria-labelledby="hub-method-title">
        <div className="section-heading">
          <p className="eyebrow">How to read this hub</p>
          <h2 id="hub-method-title">Official-source research, not a ranking</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          <Link className="text-link" href="/methodology">
            Full methodology <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>

      <section className="entry-section" aria-labelledby="hub-start-title">
        <div className="section-heading">
          <p className="eyebrow">Start research</p>
          <h2 id="hub-start-title">Go to the evidence, not a “best of” list</h2>
        </div>
        <div className="hub-cta-grid">
          <Link className="hub-cta" href="/search">
            Research Nursing Homes
          </Link>
          <Link className="hub-cta" href="/home-health">
            Research Home Health agencies
          </Link>
          <Link className="hub-cta" href="/hospice">
            Research Hospice providers
          </Link>
          <Link className="hub-cta" href="#ownership">
            Explore ownership evidence
          </Link>
          <Link className="hub-cta" href="#quality">
            Understand CMS ratings
          </Link>
          <Link className="hub-cta" href="#regulatory">
            Understand inspections and enforcement
          </Link>
          <Link className="hub-cta" href="/sources">
            Learn how SeniorTrustHub sources data
          </Link>
          <Link className="hub-cta" href="/shortlist">
            I already have a list of names
          </Link>
        </div>
      </section>
    </div>
  );
}
