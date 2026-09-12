import { STATE_NAMES } from "@care/domain";
import { seniorRequestHref } from "@/server/care/senior-ask-request";
import Link from "next/link";
import type { SeniorAskResult } from "@/server/care/senior-ask-execute";
import { CmsStarRating } from "@/components/real-provider";

export function AskResultView({ result }: { result: SeniorAskResult }) {
  const overrides = result.query.inputOverrides ?? {};
  const changeHref = seniorRequestHref(result.rawQuery, overrides);
  const hasPrimaryOutput = Boolean(
    result.failClosed ||
      result.definition ||
      result.count ||
      result.buckets ||
      result.comparison ||
      result.entities.length,
  );
  return (
    <div className="senior-ask">
      <section className="senior-ask__interpretation" aria-labelledby="ask-interp-title">
        <h2 id="ask-interp-title">We interpreted your question as</h2>
        <dl>
          {result.interpretation.map((chip) => {
            const refined = /geography/i.test(chip.label)
              ? null
              : removeCriterion(result.rawQuery, chip.label);
            const remaining = { ...overrides };
            if (/stars/i.test(chip.label)) delete remaining.stars;
            if (/evidence/i.test(chip.label)) delete remaining.evidence;
            if (/provider class/i.test(chip.label)) delete remaining.class;
            return (
              <div key={chip.label}>
                <dt>{chip.label}</dt>
                <dd>{chip.value}</dd>
                {refined !== null && refined !== result.rawQuery ? (
                  <dd>
                    <Link
                      data-specialist-event="refine"
                      href={seniorRequestHref(refined, remaining)}
                      aria-label={`Remove ${chip.label} criterion`}
                    >
                      Remove criterion
                    </Link>
                  </dd>
                ) : null}
              </div>
            );
          })}
        </dl>
        <form className="senior-ask__change" action="/ask" method="get">
          <label htmlFor="ask-q-edit">Change interpretation</label>
          <input
            key={result.rawQuery}
            id="ask-q-edit"
            name="q"
            maxLength={180}
            defaultValue={result.rawQuery}
          />
          {Object.entries(overrides).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button className="button button--primary" type="submit">
            Update question
          </button>
        </form>
      </section>

      {result.query.locationRequirement ? (
        <section aria-label="Recorded location scope">
          <p>
            {result.query.locationRequirement.raw}:{" "}
            {result.query.locationRequirement.outcome === "APPLIED"
              ? "Applied to the recorded location."
              : result.query.locationRequirement.reason}
          </p>
          {result.query.geography?.type === "city" &&
          !result.query.geography.state &&
          result.query.locationRequirement.outcome === "NEEDS_CLARIFICATION" ? (
            <form action="/ask" method="get">
              <input type="hidden" name="q" value={result.rawQuery} />
              {Object.entries(overrides)
                .filter(([key]) => key !== "state")
                .map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
              <label>
                State for {result.query.geography.value}
                <select name="state" required defaultValue="">
                  <option value="" disabled>
                    Choose recorded state
                  </option>
                  {Object.entries(STATE_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" type="submit">
                Search this city and state
              </button>
            </form>
          ) : null}
          {result.query.geography?.state ? (
            <Link href={seniorRequestHref(result.rawQuery, overrides, { broaden: "state" })}>
              Search recorded locations across {STATE_NAMES[result.query.geography.state]} instead
            </Link>
          ) : null}
        </section>
      ) : null}

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

      {!hasPrimaryOutput ? (
        <section className="senior-ask__closed" role="status">
          <h2>No matching published provider record</h2>
          <p>
            {result.query.mode === "identifier"
              ? "We did not find this CMS CCN in the published research corpus. Confirm it with CMS; absence here is not proof that the identifier is unused."
              : "We did not find a matching published provider identity for these criteria. Missing source evidence is not zero or a clean history."}
          </p>
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
                <p>
                  <strong>Evidence available</strong>
                </p>
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
                  <Link data-specialist-event="profile_open" href={entity.href}>
                    Research this provider
                  </Link>
                </p>
                <details className="senior-ask__result-trace" data-specialist-event="trace_open">
                  <summary>Trace this result</summary>
                  <dl>
                    <div>
                      <dt>Provider class</dt>
                      <dd>
                        {entity.providerClass === "nursing_home"
                          ? "Nursing Home"
                          : entity.providerClass === "home_health"
                            ? "Home Health Agency"
                            : "Hospice Provider"}
                      </dd>
                    </div>
                    <div>
                      <dt>CMS CCN</dt>
                      <dd>{entity.ccn}</dd>
                    </div>
                    <div>
                      <dt>Why matched</dt>
                      <dd>{entity.whyMatched}</dd>
                    </div>
                    <div>
                      <dt>Source family</dt>
                      <dd>{result.provenance.sourceFamily}</dd>
                    </div>
                    <div>
                      <dt>Official as-of</dt>
                      <dd>
                        {entity.sourceAsOf ??
                          result.provenance.officialAsOf ??
                          "See source clock on the provider report"}
                      </dd>
                    </div>
                    <div>
                      <dt>Geography meaning</dt>
                      <dd>{result.provenance.geographyMeaning}</dd>
                    </div>
                    <div>
                      <dt>Limitations</dt>
                      <dd>{result.limitations.join(" ")}</dd>
                    </div>
                  </dl>
                </details>
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

      <details className="senior-ask__trace" data-specialist-event="trace_open">
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

function removeCriterion(query: string, label: string): string | null {
  if (/provider class/i.test(label))
    return query
      .replace(/\b(?:nursing homes?|home health agencies?|hospice providers?)\b/gi, "")
      .trim();
  if (/geography/i.test(label))
    return query
      .replace(
        /\b(?:in|near)\s+(?:palm beach county|broward county|miami-dade county|boca raton|miami|tampa|florida|new jersey|california|texas|washington|arizona|colorado|virginia|new york)\b/gi,
        "",
      )
      .trim();
  if (/stars|evidence/i.test(label))
    return query
      .replace(
        /\b(?:with\s+)?(?:[1-5]\s+(?:cms overall|staffing|health inspection) stars?|indexed deficiencies|civil monetary penalties|staffing hprd|chow evidence|hhcahps evidence|cahps evidence)\b/gi,
        "",
      )
      .trim();
  if (/ccn|provider/i.test(label)) return "";
  if (/status/i.test(label)) return query.replace(/\b(?:active|current)\b/gi, "").trim();
  if (/sort/i.test(label))
    return query.replace(/\b(?:highest|most|ordered by)\b[^,]*/gi, "").trim();
  return null;
}
