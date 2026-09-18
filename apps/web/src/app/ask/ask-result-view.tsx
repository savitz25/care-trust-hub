import { SENIOR_OFFICIAL_RECOVERY, stateCareRecovery } from "@/server/care/senior-recovery";
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
          {Object.entries(overrides)
            .filter(([key]) => !["provider", "selected", "ccn"].includes(key))
            .map(([key, value]) => (
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

      {result.query.clarification === "provider_identity" ? (
        <section className="senior-ask__closed" role="status">
          <h2>Which facility do you mean?</h2>
          <p>
            No facility-specific evidence has been attached. Search its provider name or enter an
            exact CMS CCN.
          </p>
          <form action="/ask" method="get">
            <input type="hidden" name="q" value={result.rawQuery} />
            {Object.entries(overrides)
              .filter(([k]) => !["provider", "selected", "ccn"].includes(k))
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <label htmlFor="facility-name">Provider name</label>
            <input id="facility-name" name="provider" maxLength={120} required />
            <button type="submit" className="button">
              Search provider
            </button>
          </form>
          <form action="/ask" method="get">
            <input type="hidden" name="q" value={result.rawQuery} />
            {Object.entries(overrides)
              .filter(([k]) => !["provider", "selected", "ccn"].includes(k))
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <label htmlFor="facility-ccn">CMS CCN (six characters)</label>
            <input
              id="facility-ccn"
              name="ccn"
              minLength={6}
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              required
            />
            <button type="submit" className="button">
              Research this CMS CCN
            </button>
          </form>
        </section>
      ) : null}
      {result.query.clarification === "provider_class" ? (
        <section className="senior-ask__closed">
          <h2>Which care setting?</h2>
          <p>{result.query.failReason}</p>
          <ul>
            {(
              [
                ["nursing_home", "Nursing homes"],
                ["home_health", "Home Health agencies"],
                ["hospice", "Hospice providers"],
              ] as const
            ).map(([value, label]) => (
              <li key={value}>
                <Link
                  prefetch={false}
                  href={seniorRequestHref(result.rawQuery, overrides, { class: value, page: "1" })}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <p>
            <Link href={stateCareRecovery(result.query)?.href ?? "/assisted-living"}>
              State-specific assisted-living research
            </Link>
          </p>
          <details>
            <summary>Not sure about the setting?</summary>
            <p>
              Nursing homes, Home Health agencies and Hospice providers are separate CMS
              directories. Assisted living uses state licensing sources. These choices describe
              research sources, not a recommendation about appropriate care.
            </p>
          </details>
          {/* TH-DISCOVERY-PARITY-001B-REVIEW: a genuinely-unsupported class (terminalState
              "UNSUPPORTED" -- retirement community, adult day care, in-home caregiver, etc, see
              unsupportedSeniorClassLabel() in senior-ask-parse.ts) gets an explicit "broader, not
              the requested class" heading and disclaimer. A genuine CMS-trio ambiguity ("senior care
              Florida", terminalState "NEEDS_CLARIFICATION") is not relabeled -- there, Nursing
              Home/Home Health/Hospice previews ARE literally the requested options, not a fallback.
              TH-DISCOVERY-FINAL-REPAIR-B: when the place itself never resolved (classPreviewsScoped
              === false), classPreviewNote() swaps in an honest "not <place>-specific, nationwide
              sample" disclosure instead of implying these rows match the unresolved place. */}
          <ClassPreviews
            result={result}
            overrides={overrides}
            heading={
              result.query.terminalState === "UNSUPPORTED"
                ? "Broader senior care options"
                : undefined
            }
            note={
              result.query.terminalState === "UNSUPPORTED"
                ? classPreviewNote(result, "matches for the requested care setting")
                : undefined
            }
          />
        </section>
      ) : null}
      {result.query.clarification === "state_care" ? (
        <section className="senior-ask__closed">
          <h2>Use state-specific care research</h2>
          <p>{result.query.failReason}</p>
          {stateCareRecovery(result.query) ? (
            <Link href={stateCareRecovery(result.query)!.href}>
              {stateCareRecovery(result.query)!.label}
            </Link>
          ) : (
            <p>
              No corresponding state research destination is published for this request. Edit the
              setting or jurisdiction; no CMS class was substituted.
            </p>
          )}
          <p>
            This state intelligence action is not a city-filtered provider list or proof that a
            facility offers memory care.
          </p>
          {/* TH-DISCOVERY-PARITY-001B-REVIEW: assisted living / memory care previously stopped here
              with only the state-specific link and never a provider card, even with a real, safely
              resolved city/county/state (e.g. "memory care facility around Tacoma"). classPreviews()
              itself refuses to run a geography-SCOPED query against an ambiguous/unresolved location
              (see isCallerSafeGeography in senior-ask-execute.ts), so a scoped preview here can only
              ever be for a location already proven safe.
              TH-DISCOVERY-FINAL-REPAIR-B: when the city/county genuinely never resolved (e.g. bare
              "Tacoma" with no state), this now shows a clearly-labeled NATIONWIDE sample instead of
              nothing -- classPreviewNote() discloses that honestly instead of implying a local
              match. The state refinement control above still asks for the state explicitly; nothing
              here guesses one. */}
          <ClassPreviews
            result={result}
            overrides={overrides}
            heading="Broader senior care options"
            note={classPreviewNote(result, "assisted-living or memory-care facilities")}
          />
        </section>
      ) : null}
      {result.failClosed && !result.query.clarification ? (
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

      {result.candidateSelection ? (
        <section>
          <h2>Choose the provider</h2>
          <p>
            These are name candidates, not ownership or penalty findings. Confirm the name, class,
            CCN and recorded location.
          </p>
        </section>
      ) : null}
      {result.facilityAnswer ? (
        <section className="senior-ask__closed" aria-label="Facility evidence answer">
          <h2>{result.facilityAnswer.title}</h2>
          <p>{result.facilityAnswer.summary}</p>
          <dl>
            {result.facilityAnswer.rows.map((r, i) => (
              <div key={i}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
                {r.date ? <dd>Event/association date: {r.date}</dd> : null}
                <dd>
                  Source: {r.source}; source as-of: {r.sourceAsOf ?? "Not reported"}
                  {r.retrievedAt ? `; retrieved: ${r.retrievedAt}` : ""}
                </dd>
              </div>
            ))}
          </dl>
          {result.facilityAnswer.limitations.map((x) => (
            <p key={x}>{x}</p>
          ))}
          <details>
            <summary>Trace facility evidence</summary>
            {result.facilityAnswer.sources.map((s) => (
              <p key={s.name}>
                {s.name}; release {s.release}; official as-of {s.asOf ?? "Not reported"}; retrieved{" "}
                {s.retrievedAt ?? "Not reported"}
              </p>
            ))}
          </details>
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
          {result.query.identifier ? (
            <p>
              Exact submitted CMS CCN: <strong>{result.query.identifier.value}</strong>.{" "}
              <a href={SENIOR_OFFICIAL_RECOVERY.url}>Open official CMS Care Compare</a>. Choose the
              relevant provider class and use the CCN to confirm the identity. Official destination
              checked {SENIOR_OFFICIAL_RECOVERY.checkedAt}; this is not a live provider check.
            </p>
          ) : result.query.identityQuery ? (
            <p>
              CMS directories index each facility individually under its own registered name, not a
              parent brand or company. Enter one facility&apos;s exact published name, a labeled CMS
              CCN, or{" "}
              <Link href="/ask?q=Show+nursing+homes+in+Florida.">
                search by care setting and location instead
              </Link>
              . No unrelated provider was substituted.
            </p>
          ) : (
            <p>
              Edit the provider name or enter a labeled CMS CCN. No unrelated provider was
              substituted.
            </p>
          )}
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
                {entity.selectionHref ? (
                  <p>
                    <Link prefetch={false} href={entity.selectionHref}>
                      Select this provider for the original evidence question
                    </Link>
                  </p>
                ) : null}
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
                {entity.evidence.length > 0 ? (
                  <p>
                    <strong>Evidence available</strong>
                  </p>
                ) : null}
                <ul>
                  {entity.evidence.map((item) => (
                    <li key={item.label}>
                      {item.label}:{" "}
                      {item.rating ? (
                        <CmsStarRating value={item.rating.value} metric={item.rating.metric} />
                      ) : (
                        item.value
                      )}
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
            <dt>Executed recorded location</dt>
            <dd>
              {result.query.geography
                ? [result.query.geography.value, result.query.geography.state]
                    .filter(Boolean)
                    .join(", ")
                : "No location filter"}
            </dd>
          </div>
          {result.provenance.sourceRelease ? (
            <div>
              <dt>Source release</dt>
              <dd>{result.provenance.sourceRelease}</dd>
            </div>
          ) : null}
          {result.provenance.retrievedAt ? (
            <div>
              <dt>Source retrieved</dt>
              <dd>{result.provenance.retrievedAt} (separate from official as-of)</dd>
            </div>
          ) : null}
          {result.provenance.sourceFingerprint ? (
            <div>
              <dt>Source fingerprint</dt>
              <dd className="senior-ask__fingerprint">{result.provenance.sourceFingerprint}</dd>
            </div>
          ) : null}
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

// TH-DISCOVERY-FINAL-REPAIR-B: the place text used in the unscoped-preview disclosure below. Mirrors
// the place-describing logic already used server-side in senior-ask-parse.ts's fail-closed messages,
// but only needs a short label here (the full failReason sentence is already shown separately).
function describeUnresolvedPlace(result: SeniorAskResult): string {
  const geo = result.query.geography;
  if (!geo) return "the requested location";
  return geo.type === "county" ? `${geo.value} County` : geo.value;
}

// TH-DISCOVERY-FINAL-REPAIR-B: "memory care facility around Tacoma" (and any other unsupported-class
// request over a city/county that never resolved to one state) now gets a real, non-empty
// classPreviews instead of a dead end -- but ONLY as a genuinely nationwide/unscoped sample
// (classPreviewsScoped === false; see classPreviews()/runClassPreviewGroups() in
// senior-ask-execute.ts). That must never be presented as if it matched the unresolved place, so this
// swaps in an explicit "not <place>-specific" disclosure instead of the ordinary "same recorded
// location" note used once geography is safely resolved.
function classPreviewNote(result: SeniorAskResult, requestedLabel: string): string {
  if (result.classPreviewsScoped === false) {
    const place = describeUnresolvedPlace(result);
    return `Not ${place}-specific: ${place} did not resolve to one state, so these are broader CMS-covered nursing home, home health, and hospice providers from across the country -- not confirmed ${requestedLabel}, and not scoped to ${place}.`;
  }
  return `These are broader CMS-covered nursing home, home health, and hospice providers in the same recorded location -- not confirmed ${requestedLabel}.`;
}

// TH-DISCOVERY-PARITY-001B: shared by both the CMS-trio class-choice screen and the unsupported
// (state-regulated) class screen so a requested class that Ask cannot serve never has to be a dead
// end when real, geography-scoped CMS Nursing Home/Home Health/Hospice data exists instead.
function ClassPreviews({
  result,
  overrides,
  heading,
  note,
}: {
  result: SeniorAskResult;
  overrides: Record<string, string>;
  heading?: string;
  note?: string;
}) {
  if (!result.classPreviews?.some((group) => group.entities.length > 0)) return null;
  return (
    <div className="senior-ask__class-previews">
      {heading ? <h3>{heading}</h3> : null}
      {note ? <p className="senior-ask__class-previews-note">{note}</p> : null}
      {result.classPreviews.map((group) =>
        group.entities.length > 0 ? (
          <section key={group.providerClass} aria-label={`${group.label} preview`}>
            <h3>{group.label}</h3>
            <ul>
              {group.entities.map((entity) => (
                <li key={`${entity.providerClass}-${entity.ccn}`}>
                  <Link href={entity.href} data-specialist-event="profile_open">
                    {entity.providerName}
                  </Link>
                  <p>{entity.location}</p>
                  <p>{entity.whyMatched}</p>
                </li>
              ))}
            </ul>
            <p>
              <Link
                prefetch={false}
                href={seniorRequestHref(result.rawQuery, overrides, {
                  class: group.providerClass,
                  page: "1",
                })}
              >
                See all {group.label.toLowerCase()}
              </Link>
            </p>
          </section>
        ) : null,
      )}
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
