import Link from "next/link";
import {
  HOMEPAGE_EVIDENCE_METRIC_KEYS,
  STATE_NAMES,
  metricByKey,
  type SeniorHomeIntel,
  type SeniorNetworkMetricsV1,
} from "@care/domain";
import { SeniorHomeChecklist } from "./senior-home-checklist";

function dateLabel(value: string | null): string {
  return value ?? "Not reported";
}

function CoverageBar({
  value,
  max,
  label,
  note,
}: {
  value: number;
  max: number;
  label: string;
  note?: string;
}) {
  const width = max > 0 ? Math.max(2, Math.round((100 * value) / max)) : 0;
  return (
    <div className="intel-bar">
      <div className="intel-bar__meta">
        <span>{label}</span>
        <span>
          {note ?? (max === 100 ? `${value.toFixed(1)}%` : value.toLocaleString("en-US"))}
        </span>
      </div>
      <div className="intel-bar__track" aria-hidden="true">
        <span className="intel-bar__fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function SeniorHomeIntelligence({
  intel,
  networkMetrics,
  tools,
}: {
  intel: SeniorHomeIntel;
  networkMetrics: SeniorNetworkMetricsV1;
  tools: {
    navigator: boolean;
    planner: boolean;
    workspace: boolean;
  };
}) {
  const evidenceMetrics = HOMEPAGE_EVIDENCE_METRIC_KEYS.map((key) => {
    const metric = metricByKey(networkMetrics, key);
    if (!metric || metric.publicationStatus !== "PUBLIC" || metric.value == null) {
      throw new Error(`Homepage evidence metric ${key} is missing from senior-network-metrics-v1`);
    }
    return metric;
  });
  return (
    <div className="intel-home">
      <section className="intel-hero" aria-labelledby="home-title">
        <p className="eyebrow">National senior-care intelligence</p>
        <h1 id="home-title">Understand senior care through public evidence.</h1>
        <p className="intel-hero__lede">
          Independent research for families. Nursing homes, home health, hospice, ownership,
          staffing, inspections, quality evidence, and state evidence where it exists — each kept in
          its own class. {""}
          <strong>Research senior care without being sold senior care.</strong>
        </p>
        <p className="intel-hero__promise">We cite the evidence. You decide.</p>
        <div className="intel-hero__actions">
          <a className="button button--primary" href="#record">
            Explore Senior Care Intelligence
          </a>
          <a className="button button--secondary" href="/ask">
            Ask SeniorTrustHub
          </a>
          <a className="button button--secondary" href="#lookup">
            Research a provider
          </a>
        </div>
        <form id="lookup" className="intel-lookup" action="/search" method="get">
          <input type="hidden" name="search" value="1" />
          <p className="eyebrow">Provider lookup</p>
          <div className="intel-lookup__grid">
            <label>
              Name or CCN
              <input name="q" type="search" autoComplete="off" />
            </label>
            <label>
              State
              <select name="state" defaultValue="">
                <option value="">Any</option>
                {intel.geography.map((row) => (
                  <option key={row.state} value={row.state}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider class
              <select name="class" defaultValue="nursing_home">
                <option value="nursing_home">Nursing Homes</option>
                <option value="home_health">Home Health</option>
                <option value="hospice">Hospice</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">
              Search published evidence
            </button>
          </div>
          <p className="hub-kicker">
            Search uses the existing CMS directory interface. It does not rank results.
          </p>
        </form>
      </section>

      <section className="intel-section" id="record" aria-labelledby="record-title">
        <div className="section-heading">
          <p className="eyebrow">State of the record</p>
          <h2 id="record-title">What is in the research universe</h2>
          <p>
            These are snapshot metrics, not findings about quality. Nursing Home, Home Health, and
            Hospice remain separate CMS directories. They are not added into one combined directory
            total.
          </p>
        </div>
        <div className="intel-metric-rail">
          {intel.stateOfRecord.map((metric) => (
            <article className="intel-metric" key={metric.id}>
              <p className="intel-metric__value">{metric.display}</p>
              <h3>{metric.label}</h3>
              <p className="hub-kicker">
                Official as-of {dateLabel(metric.officialAsOf)} · Retrieved{" "}
                {dateLabel(metric.retrievedAt)}
              </p>
              <details className="intel-disclose">
                <summary>Trace this number</summary>
                <p>{metric.definition}</p>
                <ul>
                  {metric.components.map((part) => (
                    <li key={part.payloadKey}>
                      {part.label}: {part.value}
                    </li>
                  ))}
                </ul>
                <p>
                  Method: {metric.method} Payload key: <code>{metric.payloadKey}</code>
                </p>
                <ul>
                  {metric.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section
        className="intel-section"
        id="indexed-evidence"
        aria-labelledby="indexed-evidence-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Indexed CMS evidence</p>
          <h2 id="indexed-evidence-title">Evidence depth by source-native grain</h2>
          <p>
            These counts come from the SeniorTrustHub {networkMetrics.schemaVersion} publication
            contract. Each family keeps its CMS grain. They are not provider counts and are not one
            combined evidence total.
          </p>
        </div>
        <div className="intel-metric-rail">
          {evidenceMetrics.map((metric) => (
            <article className="intel-metric" key={metric.key}>
              <p className="intel-metric__value">{(metric.value ?? 0).toLocaleString("en-US")}</p>
              <h3>{metric.label}</h3>
              <p className="hub-kicker">
                Official as-of {dateLabel(metric.sourceAsOf)} · Grain{" "}
                {metric.grain.replaceAll("_", " ")}
              </p>
              <details className="intel-disclose">
                <summary>Trace this number</summary>
                <p>{metric.description}</p>
                <ul>
                  {metric.trace.components.map((part) => (
                    <li key={part.payloadKey}>
                      {part.label}: {part.value}
                    </li>
                  ))}
                </ul>
                <p>
                  Method: {metric.trace.method} Payload key: <code>{metric.trace.payloadKey}</code>
                </p>
                <p>
                  Source systems: {metric.contributingSourceSystems.join(", ")}. Manifest generated{" "}
                  {metric.generatedAt.slice(0, 10)}.
                </p>
                <ul>
                  {metric.trace.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="intel-section" id="findings" aria-labelledby="findings-title">
        <div className="section-heading">
          <p className="eyebrow">What the data says</p>
          <h2 id="findings-title">Three national evidence stories</h2>
          <p>
            Each story is a benchmark or a coverage gap. None is a ranking of providers or states.
          </p>
        </div>
        <div className="intel-findings">
          {intel.findings.map((finding) => (
            <article className="intel-finding" key={finding.storyId}>
              <p className="eyebrow">{finding.storyType}</p>
              <h3>{finding.title}</h3>
              <p>{finding.summary}</p>
              <figure>
                <figcaption>{finding.chart.caption}</figcaption>
                <div className="intel-chart" role="img" aria-label={finding.chart.caption}>
                  {finding.chart.series.map((series) => (
                    <CoverageBar
                      key={series.label}
                      value={series.value}
                      max={finding.chart.max}
                      label={series.label}
                      note={series.note}
                    />
                  ))}
                </div>
                <div className="hub-table-scroll">
                  <table className="hub-table hub-table--compact">
                    <caption className="visually-hidden">{finding.chart.caption}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Class / measure</th>
                        <th scope="col">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finding.chart.series.map((series) => (
                        <tr key={series.label}>
                          <th scope="row">{series.label}</th>
                          <td>{series.note ?? series.value.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </figure>
              <details className="intel-disclose">
                <summary>Explain this chart</summary>
                <p>
                  <strong>What am I looking at?</strong> {finding.chart.caption}
                </p>
                <p>
                  <strong>Why might this matter?</strong> {finding.whyItMatters}
                </p>
                <p>
                  <strong>What this does not mean</strong>
                </p>
                <ul>
                  {finding.doesNotMean.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>
                  Official as-of {dateLabel(finding.officialAsOf)} · Retrieved{" "}
                  {dateLabel(finding.retrievedAt)}
                </p>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className="intel-section" id="depth" aria-labelledby="depth-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence depth</p>
          <h2 id="depth-title">How complete is the research?</h2>
          <p>
            Coverage describes whether SeniorTrustHub has published evidence for a family and class.
            It does not describe how trustworthy a provider is.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>Evidence availability by family and provider class</caption>
            <thead>
              <tr>
                <th scope="col">Evidence family</th>
                <th scope="col">Class</th>
                <th scope="col">Coverage</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {intel.coverage.map((row) => (
                <tr key={`${row.family}-${row.providerClass}`}>
                  <th scope="row">{row.family}</th>
                  <td>{row.providerClass}</td>
                  <td>{row.display}</td>
                  <td>{row.status.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="intel-section" id="gaps" aria-labelledby="gaps-title">
        <div className="section-heading">
          <p className="eyebrow">What we don&apos;t know</p>
          <h2 id="gaps-title">Where the record is incomplete</h2>
        </div>
        <ul className="hub-plain-list">
          {intel.gaps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h3>Things you may still want to verify directly</h3>
        <ul className="hub-plain-list">
          {intel.verifyDirectly.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="intel-section" id="explore" aria-labelledby="explore-title">
        <div className="section-heading">
          <p className="eyebrow">Localize</p>
          <h2 id="explore-title">Explore senior-care intelligence by state</h2>
          <p>
            Color intensity encodes current CMS Nursing Home directory volume in that jurisdiction.
            It does not encode quality, safety, or risk. Florida and New Jersey currently have state
            intelligence pages.
          </p>
        </div>
        <p className="intel-legend">
          Legend: darker cells have more current CMS Nursing Homes in the directory. Not a ranking.
        </p>
        <div className="intel-geo-grid">
          {intel.geography
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((row) => (
              <a
                key={row.state}
                className="intel-geo-cell"
                href={row.intelligenceHref ?? row.searchHref}
                style={{ ["--intel-volume" as string]: String(row.nhVolumeShare / 100) }}
              >
                <strong>{row.state}</strong>
                <span className="visually-hidden">
                  {row.name}. Nursing Homes {row.nursingHomes.toLocaleString("en-US")}, Home Health{" "}
                  {row.homeHealth.toLocaleString("en-US")}, Hospice{" "}
                  {row.hospice.toLocaleString("en-US")}.
                  {row.intelligenceHref
                    ? ` Opens ${row.name} state intelligence.`
                    : " Opens CMS Nursing Home search."}
                </span>
                <span aria-hidden="true">{row.nursingHomes}</span>
              </a>
            ))}
        </div>
        <article className="intel-florida">
          <p className="eyebrow">Florida preview</p>
          <h3>{STATE_NAMES.FL} intelligence</h3>
          <p>{intel.floridaPreview.note}</p>
          <ul className="hub-plain-list">
            <li>AHCA identities: {intel.floridaPreview.ahcaIdentities.toLocaleString("en-US")}</li>
            <li>
              State regulatory observations:{" "}
              {intel.floridaPreview.regulatoryObservations.toLocaleString("en-US")}
            </li>
            <li>
              CMS Nursing Homes / Home Health / Hospice:{" "}
              {intel.floridaPreview.cmsNursingHomes.toLocaleString("en-US")} /{" "}
              {intel.floridaPreview.cmsHomeHealth.toLocaleString("en-US")} /{" "}
              {intel.floridaPreview.cmsHospice.toLocaleString("en-US")}
            </li>
            <li>Published ALF/AFCH profiles: {intel.floridaPreview.publishedAlfAfch}</li>
          </ul>
          <Link className="button button--secondary" href={intel.floridaPreview.href}>
            Explore Florida Intelligence →
          </Link>
        </article>
        <article className="intel-florida">
          <p className="eyebrow">New Jersey preview</p>
          <h3>{STATE_NAMES.NJ} intelligence</h3>
          <p>{intel.newJerseyPreview.note}</p>
          <ul className="hub-plain-list">
            <li>
              NJDOH All_LTC identities:{" "}
              {intel.newJerseyPreview.ltcIdentities.toLocaleString("en-US")}
            </li>
            <li>
              NJDOH All_Acute identities:{" "}
              {intel.newJerseyPreview.acuteIdentities.toLocaleString("en-US")}
            </li>
            <li>
              CMS Nursing Homes / Home Health / Hospice:{" "}
              {intel.newJerseyPreview.cmsNursingHomes.toLocaleString("en-US")} /{" "}
              {intel.newJerseyPreview.cmsHomeHealth.toLocaleString("en-US")} /{" "}
              {intel.newJerseyPreview.cmsHospice.toLocaleString("en-US")}
            </li>
          </ul>
          <Link className="button button--secondary" href={intel.newJerseyPreview.href}>
            Explore New Jersey Intelligence →
          </Link>
        </article>
        <article className="intel-florida">
          <p className="eyebrow">California preview</p>
          <h3>{STATE_NAMES.CA} intelligence</h3>
          <p>{intel.californiaPreview.note}</p>
          <ul className="hub-plain-list">
            <li>CDPH ELMS locations: {intel.californiaPreview.elmsRows.toLocaleString("en-US")}</li>
            <li>
              CCLD RCFE LICENSED (as of 2025-05-25):{" "}
              {intel.californiaPreview.rcfeLicensed.toLocaleString("en-US")}
            </li>
            <li>
              CMS Nursing Homes / Home Health / Hospice:{" "}
              {intel.californiaPreview.cmsNursingHomes.toLocaleString("en-US")} /{" "}
              {intel.californiaPreview.cmsHomeHealth.toLocaleString("en-US")} /{" "}
              {intel.californiaPreview.cmsHospice.toLocaleString("en-US")}
            </li>
          </ul>
          <Link className="button button--secondary" href={intel.californiaPreview.href}>
            Explore California Intelligence →
          </Link>
        </article>
        <article className="intel-florida">
          <p className="eyebrow">Texas preview</p>
          <h3>{STATE_NAMES.TX} intelligence</h3>
          <p>{intel.texasPreview.note}</p>
          <ul className="hub-plain-list">
            <li>
              CMS Nursing Homes / Home Health / Hospice:{" "}
              {intel.texasPreview.cmsNursingHomes.toLocaleString("en-US")} /{" "}
              {intel.texasPreview.cmsHomeHealth.toLocaleString("en-US")} /{" "}
              {intel.texasPreview.cmsHospice.toLocaleString("en-US")}
            </li>
            <li>HHSC nursing facilities: {intel.texasPreview.hhscNf.toLocaleString("en-US")}</li>
            <li>HHSC assisted living: {intel.texasPreview.hhscAlf.toLocaleString("en-US")}</li>
            <li>HHSC HCSSA rows: {intel.texasPreview.hhscHcssa.toLocaleString("en-US")}</li>
          </ul>
          <Link className="button button--secondary" href={intel.texasPreview.href}>
            Explore Texas Intelligence →
          </Link>
        </article>
        <article className="intel-florida">
          <p className="eyebrow">Washington preview</p>
          <h3>{STATE_NAMES.WA} intelligence</h3>
          <p>{intel.washingtonPreview.note}</p>
          <ul className="hub-plain-list">
            <li>DSHS Adult Family Homes: {intel.washingtonPreview.afh.toLocaleString("en-US")}</li>
            <li>
              DSHS Assisted Living Facilities: {intel.washingtonPreview.alf.toLocaleString("en-US")}
            </li>
            <li>
              CMS Nursing Homes / Home Health / Hospice:{" "}
              {intel.washingtonPreview.cmsNursingHomes.toLocaleString("en-US")} /{" "}
              {intel.washingtonPreview.cmsHomeHealth.toLocaleString("en-US")} /{" "}
              {intel.washingtonPreview.cmsHospice.toLocaleString("en-US")}
            </li>
          </ul>
          <Link className="button button--secondary" href={intel.washingtonPreview.href}>
            Explore Washington Intelligence →
          </Link>
        </article>
        <details className="intel-disclose">
          <summary>Accessible state list</summary>
          <div className="hub-table-scroll">
            <table className="hub-table">
              <caption>
                Current CMS directory counts by jurisdiction. Florida, New Jersey, California,
                Texas, and Washington link to state intelligence; other jurisdictions open Nursing
                Home search.
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
                  <tr key={`list-${row.state}`}>
                    <th scope="row">
                      <Link href={row.intelligenceHref ?? row.searchHref}>
                        {row.state} · {row.name}
                      </Link>
                    </th>
                    <td>{row.nursingHomes.toLocaleString("en-US")}</td>
                    <td>{row.homeHealth.toLocaleString("en-US")}</td>
                    <td>{row.hospice.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="intel-section" id="ask" aria-labelledby="ask-title">
        <div className="section-heading">
          <p className="eyebrow">Ask the market</p>
          <h2 id="ask-title">Structured questions, not a chatbot</h2>
        </div>
        <div className="intel-ask">
          {intel.askMarket.map((item) => (
            <details key={item.id} className="intel-disclose">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
              <p>
                <Link className="text-link" href={item.href}>
                  {item.hrefLabel} <span aria-hidden="true">→</span>
                </Link>
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="intel-section" id="use" aria-labelledby="use-title">
        <div className="section-heading">
          <p className="eyebrow">Use the research</p>
          <h2 id="use-title">Act after you understand the evidence</h2>
        </div>
        <div className="hub-cta-grid">
          {tools.navigator ? (
            <Link className="hub-cta" href="/tools/care-needs-navigator">
              Find care that matches your needs
            </Link>
          ) : null}
          {tools.planner ? (
            <Link className="hub-cta" href="/tools/senior-care-cost-planner">
              Estimate care costs
            </Link>
          ) : null}
          <Link className="hub-cta" href="/compare">
            Compare facilities
          </Link>
          <Link className="hub-cta" href="/shortlist">
            Save research to your shortlist
          </Link>
          {tools.workspace ? (
            <Link className="hub-cta" href="/workspace">
              Open family workspace
            </Link>
          ) : null}
        </div>
        <h3>Research checklist</h3>
        <SeniorHomeChecklist />
        <h3>How this research was assembled</h3>
        <ol className="intel-journey">
          <li>CMS identity in a class directory</li>
          <li>CCN (class-scoped)</li>
          <li>Quality, staffing, or survey evidence when that class publishes it</li>
          <li>Ownership graph when a link resolves</li>
          <li>State regulator identity only where a public state page exists</li>
          <li>SeniorTrustHub research profile</li>
        </ol>
        <p className="hub-kicker">
          Connected, unavailable, and review states stay class-specific. Internal identity
          candidates are not shown on this page.
        </p>
      </section>

      <section className="intel-section" id="sources" aria-labelledby="sources-title">
        <div className="section-heading">
          <p className="eyebrow">Evidence, sources &amp; limitations</p>
          <h2 id="sources-title">How this research is built</h2>
          <p>
            Official as-of and retrieved dates are evidence freshness. This homepage is not live
            data. {intel.changeModule.reason}
          </p>
        </div>
        <h3>What this research does not infer</h3>
        <ul className="hub-plain-list">
          {intel.doesNotInfer.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>Primary CMS source families used on this homepage</caption>
            <thead>
              <tr>
                <th scope="col">Dataset</th>
                <th scope="col">Official as-of</th>
                <th scope="col">Retrieved</th>
              </tr>
            </thead>
            <tbody>
              {intel.sources
                .filter((source) =>
                  [
                    "nursing-home-provider-information",
                    "home-health-care-agencies",
                    "hospice-general-information",
                    "nursing-home-ownership",
                    "skilled-nursing-facility-change-of-ownership",
                    "nursing-home-health-deficiencies",
                    "nursing-home-penalties",
                  ].includes(source.datasetKey),
                )
                .map((source) => (
                  <tr key={source.datasetKey}>
                    <th scope="row">{source.displayName}</th>
                    <td>{source.sourceModifiedAt?.slice(0, 10) ?? "Not reported"}</td>
                    <td>{source.retrievedAt?.slice(0, 10) ?? "Not reported"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p>
          <Link className="text-link" href="/sources">
            View full Source Ledger <span aria-hidden="true">→</span>
          </Link>
          {" · "}
          <Link className="text-link" href="/methodology">
            Methodology <span aria-hidden="true">→</span>
          </Link>
        </p>
        <p className="hub-kicker">
          Snapshot {intel.homepagePublicationVersion}. Payload{" "}
          {intel.payloadFingerprint.slice(0, 12)}… Generated from {intel.contractVersion} /{" "}
          {intel.sourceFingerprint.slice(0, 12)}…
        </p>
      </section>
    </div>
  );
}
