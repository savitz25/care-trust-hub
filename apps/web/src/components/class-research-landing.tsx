import Link from "next/link";
import {
  STATE_NAMES,
  coverageShare,
  formatHubCount,
  type HubSourceRow,
  type SeniorNationalIntelligence,
  type StarDistribution,
} from "@care/domain";
import { StructuredData } from "./structured-data";

export type AgencyClass = "home_health" | "hospice";

function sourcesFor(classId: AgencyClass, sources: HubSourceRow[]): HubSourceRow[] {
  const keys =
    classId === "home_health"
      ? [
          "home-health-care-agencies",
          "home-health-patient-survey-hhcahps",
          "home-health-zip-codes",
          "home-health-agency-all-owners",
          "home-health-agency-enrollments",
        ]
      : [
          "hospice-general-information",
          "hospice-provider-data",
          "hospice-provider-cahps",
          "hospice-zip-data",
          "hospice-all-owners",
          "hospice-enrollments",
        ];
  return sources.filter((row) => keys.includes(row.datasetKey));
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
              <th scope="col">CMS Quality of Patient Care stars</th>
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

export function ClassResearchLanding({
  classId,
  intel,
  canonical,
}: {
  classId: AgencyClass;
  intel: SeniorNationalIntelligence;
  canonical?: string;
}) {
  const isHh = classId === "home_health";
  const hh = intel.homeHealth;
  const hospice = intel.hospice;
  const current = isHh ? hh.current : hospice.current;
  const searchClass = classId;
  const searchAction = "/search";
  const geography = intel.geography.filter((row) => (isHh ? row.homeHealth : row.hospice) > 0);
  const geoSum = geography.reduce((sum, row) => sum + (isHh ? row.homeHealth : row.hospice), 0);
  const classSources = sourcesFor(classId, intel.sources);
  const h1 = isHh ? "CMS Home Health research" : "CMS Hospice research";
  const datasetName = isHh ? "CMS Home Health Care Agencies" : "CMS Hospice General Information";

  return (
    <div className="page-shell class-research-page national-hub">
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: h1,
          url: canonical,
          about: {
            "@type": "Dataset",
            name: datasetName,
            creator: { "@type": "Organization", name: "Centers for Medicare & Medicaid Services" },
            description: isHh
              ? `${formatHubCount(current)} current CMS Home Health directory providers.`
              : `${formatHubCount(current)} current CMS Hospice General Information providers.`,
          },
        }}
      />

      <header className="home-hero class-hero" aria-labelledby="class-title">
        <p className="eyebrow">{isHh ? "Home Health" : "Hospice"}</p>
        <h1 id="class-title">{h1}</h1>
        <p className="home-hero__lede">
          {formatHubCount(current)} current CMS {isHh ? "Home Health" : "Hospice"} providers. Search
          by provider name, {isHh ? "CMS Home Health CCN" : "CMS Hospice CCN"}, office city, office
          state, or office ZIP. Independent research using official CMS and ownership sources — not
          a ranking and not a Trust Hub score.
        </p>
      </header>

      <section className="entry-section" aria-labelledby="class-search-title">
        <div className="section-heading">
          <p className="eyebrow">Directory search</p>
          <h2 id="class-search-title">
            {isHh ? "Search Home Health providers" : "Search Hospice providers"}
          </h2>
          <p>
            This uses the existing national directory. Location fields are the CMS office address,
            not a verified service area. There is no distance search because office coordinates are
            not published in this evidence layer.
          </p>
        </div>
        <form className="search-panel landing-search" method="get" action={searchAction}>
          <input type="hidden" name="search" value="1" />
          <input type="hidden" name="class" value={searchClass} />
          <div className="field">
            <label htmlFor={`${classId}-q`}>
              Provider name or {isHh ? "CMS Home Health CCN" : "CMS Hospice CCN"}
            </label>
            <input id={`${classId}-q`} name="q" />
          </div>
          <div className="filter-row">
            <div className="field">
              <label htmlFor={`${classId}-city`}>Office city</label>
              <input id={`${classId}-city`} name="city" />
            </div>
            <div className="field">
              <label htmlFor={`${classId}-state`}>Office state</label>
              <input id={`${classId}-state`} name="state" maxLength={2} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor={`${classId}-zip`}>Office ZIP</label>
              <input id={`${classId}-zip`} name="zip" inputMode="numeric" maxLength={5} />
            </div>
          </div>
          <button className="button button--primary" type="submit">
            {isHh ? "Search current Home Health agencies" : "Search current Hospice providers"}
          </button>
        </form>
        <p>
          <Link className="text-link" href={`/search?class=${searchClass}`}>
            Open the full directory search <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>

      <section className="entry-section" aria-labelledby="class-overview-title">
        <div className="section-heading">
          <p className="eyebrow">National evidence</p>
          <h2 id="class-overview-title">What SeniorTrustHub currently knows</h2>
        </div>
        <div className="hub-stat-grid">
          <div className="hub-stat">
            <p className="hub-stat__value">{formatHubCount(current)}</p>
            <p className="hub-stat__label">
              Current {isHh ? "Home Health" : "Hospice GI"} directory providers
            </p>
          </div>
          {isHh ? (
            <>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hh.starDistribution.reported, hh.current)}
                </p>
                <p className="hub-stat__label">CMS Quality of Patient Care star reported</p>
              </div>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hh.coverage.hhcahpsProviders, hh.current)}
                </p>
                <p className="hub-stat__label">HHCAHPS observations on file</p>
              </div>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hh.coverage.ownedByProviders, hh.current)}
                </p>
                <p className="hub-stat__label">CURRENT OWNED_BY evidence</p>
              </div>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hh.coverage.zipCoverageProviders, hh.current)}
                </p>
                <p className="hub-stat__label">CMS ZIP coverage records on file</p>
              </div>
            </>
          ) : (
            <>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hospice.coverage.qualityMeasureProviders, hospice.current)}
                </p>
                <p className="hub-stat__label">Hospice quality-measure observations on file</p>
              </div>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hospice.coverage.cahpsProviders, hospice.current)}
                </p>
                <p className="hub-stat__label">CAHPS Hospice Survey observations on file</p>
              </div>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hospice.coverage.ownedByProviders, hospice.current)}
                </p>
                <p className="hub-stat__label">CURRENT OWNED_BY evidence</p>
              </div>
              <div className="hub-stat">
                <p className="hub-stat__value">
                  {coverageShare(hospice.coverage.zipCoverageProviders, hospice.current)}
                </p>
                <p className="hub-stat__label">CMS ZIP coverage records on file</p>
              </div>
            </>
          )}
        </div>
        {!isHh ? (
          <p>
            {formatHubCount(hospice.evidenceOnly)} additional typed Hospice identities appear in
            other CMS quality files but are not in the current General Information directory. They
            are not counted here as current providers, they are not shown in default search, and
            that is not proof a provider stopped operating.
          </p>
        ) : null}
      </section>

      <section className="entry-section" id="quality" aria-labelledby="class-quality-title">
        <div className="section-heading">
          <p className="eyebrow">
            {isHh ? "Understand CMS Home Health stars" : "Understand Hospice quality measures"}
          </p>
          <h2 id="class-quality-title">
            {isHh
              ? "Quality of Patient Care stars are CMS stars"
              : "Hospice has no overall CMS star"}
          </h2>
        </div>
        {isHh ? (
          <>
            <p>
              The CMS Quality of Patient Care star summarizes selected Home Health process and
              outcome measures published by CMS. It is not a SeniorTrustHub rating and it is not
              HHCAHPS. {formatHubCount(hh.starDistribution.missing)} current agencies have no
              published star in the latest snapshot; that is not reported, not a zero.
            </p>
            <StarTable
              id="hh-qoc-stars"
              title={`CMS Quality of Patient Care star distribution (${formatHubCount(hh.starDistribution.reported)} reported)`}
              dist={hh.starDistribution}
            />
            <h3 id="hhcahps">Understand HHCAHPS</h3>
            <p>
              HHCAHPS is patient-experience survey evidence. It is not the same as the Quality of
              Patient Care star. Missing HHCAHPS is not reported — not a zero, and not a finding of
              poor care. Current agencies with HHCAHPS observations on file:{" "}
              {coverageShare(hh.coverage.hhcahpsProviders, hh.current)}.
            </p>
          </>
        ) : (
          <>
            <p>
              CMS does not publish an overall Hospice star in this directory. Hospice quality
              measures (process and claims-based clinical measures) stay separate from the CAHPS
              Hospice Survey. Survey scores are not clinical quality, and neither family is a Trust
              Hub score.
            </p>
            <h3 id="cahps">Understand CAHPS Hospice Survey</h3>
            <p>
              CAHPS Hospice Survey evidence is family and caregiver experience. It is not a
              substitute for Hospice quality measures. Missing survey results are not reported, not
              zero.
            </p>
          </>
        )}
      </section>

      <section className="entry-section" id="ownership" aria-labelledby="class-own-title">
        <div className="section-heading">
          <p className="eyebrow">Research ownership</p>
          <h2 id="class-own-title">Ownership evidence is not a quality grade</h2>
        </div>
        <p>
          SeniorTrustHub uses CMS/PECOS ownership evidence where it is available. CURRENT OWNED_BY
          means current resolved ownership evidence. UNKNOWN is not a former owner. Ownership
          structure is not provider quality. Large, corporate, or private ownership is not labeled
          good or bad here.
        </p>
        <p>
          CHOW (change of ownership) events: <strong>not available</strong>.{" "}
          {isHh ? hh.chow.reason : hospice.chow.reason} That is not the same as zero ownership
          changes, and it does not mean ownership never changed.
        </p>
      </section>

      <section className="entry-section" id="geography" aria-labelledby="class-geo-title">
        <div className="section-heading">
          <p className="eyebrow">Office geography</p>
          <h2 id="class-geo-title">Office city, state, and ZIP are not a service area</h2>
        </div>
        <p>
          Directory location is the CMS office address. CMS ZIP coverage records, when present, are
          a separate evidence family. This page does not say a provider serves your ZIP unless a
          specific coverage record is shown on a research profile.
        </p>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>
              Current {isHh ? "Home Health" : "Hospice"} directory providers by jurisdiction (
              {formatHubCount(geoSum)} total)
            </caption>
            <thead>
              <tr>
                <th scope="col">Jurisdiction</th>
                <th scope="col">Current providers</th>
              </tr>
            </thead>
            <tbody>
              {geography.map((row) => {
                const count = isHh ? row.homeHealth : row.hospice;
                return (
                  <tr key={row.state}>
                    <th scope="row">
                      {row.state}
                      {STATE_NAMES[row.state] ? ` · ${STATE_NAMES[row.state]}` : ""}
                    </th>
                    <td>
                      <Link href={`/search?class=${searchClass}&search=1&state=${row.state}`}>
                        {formatHubCount(count)}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">National current directory</th>
                <td>{formatHubCount(current)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="entry-section" id="sources" aria-labelledby="class-src-title">
        <div className="section-heading">
          <p className="eyebrow">Sources and methodology</p>
          <h2 id="class-src-title">Official CMS families, each with its own as-of date</h2>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>{isHh ? "Home Health" : "Hospice"} source families used on this page</caption>
            <thead>
              <tr>
                <th scope="col">Dataset</th>
                <th scope="col">Agency</th>
                <th scope="col">Source as-of</th>
                <th scope="col">Reporting period</th>
                <th scope="col">Limitation</th>
              </tr>
            </thead>
            <tbody>
              {classSources.map((source) => (
                <tr key={source.datasetKey}>
                  <th scope="row">{source.displayName}</th>
                  <td>{source.sourceAgency}</td>
                  <td>{source.sourceModifiedAt?.slice(0, 10) ?? "Not reported"}</td>
                  <td>{source.sourcePeriod ?? "Not reported"}</td>
                  <td>{source.limitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 id="method">How to read this class</h3>
        <ul className="hub-plain-list">
          <li>
            Research uses official CMS and PECOS public records. Canonical identity is{" "}
            {isHh ? "HOME_HEALTH_CCN" : "HOSPICE_CCN"}.
          </li>
          <li>
            The current-directory denominator is {formatHubCount(current)}{" "}
            {isHh ? "Home Health" : "Hospice GI"} providers, not companies.
          </li>
          <li>
            Missing, suppressed, or insufficient evidence is not a zero and not a quality failure.
          </li>
          <li>
            Unlike CMS measure families are not scored together and are not a Trust Hub score.
          </li>
          <li>
            Ownership evidence is not quality. UNKNOWN is not former. Unsupported CHOW is not zero
            sales.
          </li>
        </ul>
        <p>
          <Link className="text-link" href="/methodology">
            Full methodology <span aria-hidden="true">→</span>
          </Link>
        </p>
      </section>

      <section className="entry-section" aria-labelledby="class-tasks-title">
        <div className="section-heading">
          <p className="eyebrow">Research tasks</p>
          <h2 id="class-tasks-title">Start with a question, not a ranking</h2>
        </div>
        <div className="hub-cta-grid">
          <Link className="hub-cta" href={`/search?class=${searchClass}`}>
            {isHh ? "Search Home Health providers" : "Search Hospice providers"}
          </Link>
          <Link className="hub-cta" href="#quality">
            {isHh ? "Understand CMS Home Health stars" : "Understand Hospice quality measures"}
          </Link>
          <Link className="hub-cta" href={isHh ? "#hhcahps" : "#cahps"}>
            {isHh ? "Understand HHCAHPS" : "Understand CAHPS Hospice Survey"}
          </Link>
          <Link className="hub-cta" href="#ownership">
            Research ownership
          </Link>
          <Link className="hub-cta" href={`/search?class=${searchClass}`}>
            View a provider profile after you find it
          </Link>
        </div>
      </section>
    </div>
  );
}
