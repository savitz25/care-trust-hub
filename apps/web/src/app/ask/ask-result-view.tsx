import Link from "next/link";
import type { SeniorAskResult } from "@/server/care/senior-ask-execute";
import { CmsStarRating } from "@/components/real-provider";

export function AskResultView({ result }: { result: SeniorAskResult }) {
  const changeHref = `/ask?q=${encodeURIComponent(result.rawQuery)}`;
  return (
    <div className="senior-ask">
      <section className="senior-ask__interpretation" aria-labelledby="ask-interp-title">
        <h2 id="ask-interp-title">We interpreted your question as</h2>
        <dl>
          {result.interpretation.map((chip) => (
            <div key={chip.label}>
              <dt>{chip.label}</dt>
              <dd>{chip.value}</dd>
            </div>
          ))}
        </dl>
        <form className="senior-ask__change" action="/ask" method="get">
          <label htmlFor="ask-q-edit">Change interpretation</label>
          <input id="ask-q-edit" name="q" defaultValue={result.rawQuery} />
          <button className="button button--primary" type="submit">
            Update question
          </button>
        </form>
      </section>

      {result.failClosed ? (
        <section className="senior-ask__closed" role="status">
          <h2>Ask cannot answer that as asked</h2>
          <p>{result.failClosed.reason}</p>
          {result.failClosed.alternatives.length ? (
            <ul>
              {result.failClosed.alternatives.map((alt) => (
                <li key={alt}>
                  <Link href={`/ask?q=${encodeURIComponent(alt)}`}>{alt}</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {result.definition ? (
        <section>
          <h2>{result.definition.title}</h2>
          <p>{result.definition.body}</p>
        </section>
      ) : null}

      {result.count ? (
        <section>
          <h2>Count</h2>
          <p className="senior-ask__count">{result.count.n.toLocaleString("en-US")}</p>
          <p>{result.count.grain}</p>
          {result.count.denominator ? <p>Denominator: {result.count.denominator}</p> : null}
        </section>
      ) : null}

      {result.buckets ? (
        <section>
          <h2>Distribution</h2>
          <p>Neutral counts by CMS overall-star bucket. This is not a red/green quality chart.</p>
          <table>
            <caption>CMS overall star buckets for the selected cohort</caption>
            <thead>
              <tr>
                <th scope="col">Bucket</th>
                <th scope="col">Facilities</th>
              </tr>
            </thead>
            <tbody>
              {result.buckets.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.n.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {result.comparison ? (
        <section>
          <h2>Comparison</h2>
          <p>Equivalent nursing-home identity counts. Address county is not service area.</p>
          <ul>
            {result.comparison.map((row) => (
              <li key={row.label}>
                {row.label}: {row.n.toLocaleString("en-US")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.entities.length ? (
        <ol className="senior-ask__results">
          {result.entities.map((entity) => (
            <li key={`${entity.providerClass}-${entity.ccn}-${entity.providerName}`}>
              <article className="senior-ask__card">
                <h3>
                  <Link href={entity.href}>{entity.providerName}</Link>
                </h3>
                <p>
                  {entity.providerClass === "nursing_home"
                    ? "Nursing Home"
                    : entity.providerClass === "home_health"
                      ? "Home Health Agency"
                      : "Hospice Provider"}{" "}
                  · CCN {entity.ccn}
                </p>
                <p>{entity.location}</p>
                <p>{entity.statusLabel}</p>
                <ul>
                  {entity.evidence.map((item) => (
                    <li key={item.label}>
                      {item.label}: {item.value}
                      {/stars/i.test(item.label) && /\d\/5/.test(item.value) ? (
                        <CmsStarRating value={Number(item.value[0])} />
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong>Why this matched.</strong> {entity.whyMatched}
                </p>
                <p>
                  <Link href={entity.href}>View research report</Link>
                </p>
              </article>
            </li>
          ))}
        </ol>
      ) : null}

      {result.pagination.hasMore || result.pagination.page > 1 ? (
        <nav className="senior-ask__pager" aria-label="Ask results pages">
          {result.pagination.page > 1 ? (
            <Link href={`${changeHref}&page=${result.pagination.page - 1}`}>Previous</Link>
          ) : null}
          {result.pagination.hasMore ? (
            <Link href={`${changeHref}&page=${result.pagination.page + 1}`}>Next</Link>
          ) : null}
        </nav>
      ) : null}

      <details className="senior-ask__trace">
        <summary>Trace this query</summary>
        <dl>
          <div>
            <dt>Provider class</dt>
            <dd>{result.provenance.providerClass}</dd>
          </div>
          <div>
            <dt>Source family</dt>
            <dd>{result.provenance.sourceFamily}</dd>
          </div>
          <div>
            <dt>Official as-of</dt>
            <dd>
              {result.provenance.officialAsOf ?? "See specialist snapshot on the linked report"}
            </dd>
          </div>
          <div>
            <dt>Geography meaning</dt>
            <dd>{result.provenance.geographyMeaning}</dd>
          </div>
          <div>
            <dt>Query grain</dt>
            <dd>{result.provenance.queryGrain}</dd>
          </div>
          <div>
            <dt>Metric</dt>
            <dd>{result.provenance.metric ?? "Directory identity"}</dd>
          </div>
          <div>
            <dt>Canonical identifier method</dt>
            <dd>{result.provenance.identifierMethod}</dd>
          </div>
          <div>
            <dt>Exclusions</dt>
            <dd>{result.provenance.exclusions.join(" ")}</dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>{result.contract}</dd>
          </div>
        </dl>
      </details>
      <ul className="senior-ask__limits">
        {result.limitations.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
