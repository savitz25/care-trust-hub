import Link from "next/link";
import type { CareChainIntelligence } from "@/server/care/types";
const metric = (chain: CareChainIntelligence, key: string) => chain.current.metrics[key];
export function ChainIntelligence({
  chain,
  facility,
}: {
  chain: CareChainIntelligence;
  facility?: boolean;
}) {
  const questions = [
    `CMS groups facilities in ${chain.current.stateCount} states or territories under this chain. Which operational policies are set at the chain level?`,
  ];
  const fines = metric(chain, "Total number of fines");
  if (fines !== null && fines > 0)
    questions.push(
      `CMS reports ${fines} fines across the chain in this dataset. What compliance functions are managed centrally?`,
    );
  return (
    <section className="profile-section" id="chain" aria-labelledby="chain-title">
      <div className="section-heading">
        <p className="eyebrow">Chain context</p>
        <h2 id="chain-title">
          {facility
            ? `CMS groups this facility with ${chain.current.chainName}`
            : chain.current.chainName}
        </h2>
        <p>
          Chain-level values describe this CMS-defined group, not any one facility. CMS Chain ID{" "}
          {chain.cmsChainId} is a grouping identifier, not a legal organization.
        </p>
      </div>
      <dl className="real-fact-grid">
        <div>
          <dt>Facilities</dt>
          <dd>{chain.current.facilityCount}</dd>
        </div>
        <div>
          <dt>States and territories</dt>
          <dd>{chain.current.stateCount}</dd>
        </div>
        <div>
          <dt>Average overall rating</dt>
          <dd>{metric(chain, "Average overall 5-star rating") ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Average staffing rating</dt>
          <dd>{metric(chain, "Average staffing rating") ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Average total nurse HPRD</dt>
          <dd>{metric(chain, "Average total nurse hours per resident day") ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Total fines</dt>
          <dd>{fines ?? "Not published"}</dd>
        </div>
      </dl>
      {facility && (
        <Link href={`/chain/${chain.cmsChainId}/review`}>Review CMS chain evidence</Link>
      )}
      {chain.history.length > 1 && (
        <div>
          <h3>CMS-published history</h3>
          <table>
            <caption>Monthly chain measures</caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>Facilities</th>
                <th>Overall rating</th>
                <th>Staffing rating</th>
              </tr>
            </thead>
            <tbody>
              {chain.history.map((s) => (
                <tr key={s.releaseMonth}>
                  <th>{s.releaseMonth.slice(0, 7)}</th>
                  <td>{s.facilityCount}</td>
                  <td>{s.metrics["Average overall 5-star rating"] ?? "—"}</td>
                  <td>{s.metrics["Average staffing rating"] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!facility && (
        <div>
          <h3>Facilities in this CMS chain</h3>
          <ul>
            {chain.facilities.map((p) => (
              <li key={p.ccn}>
                <Link href={`/facility/cms/${p.ccn}/review`}>{p.providerName}</Link> — {p.state} ·
                CMS overall {p.overallRating ?? "not reported"}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3>Questions to ask</h3>
        <ul>
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </div>
      <details className="source-disclosure">
        <summary>CMS chain source and methodology</summary>
        <p>
          Nursing Home Chain Performance Measures, fixed version {chain.source.versionIdentifier}.
          Membership comes separately from CMS Skilled Nursing Facility Enrollments.
        </p>
        <a href={chain.source.officialUrl}>View official CMS source</a>
      </details>
    </section>
  );
}
