import type { CSSProperties } from "react";
import type { CareStaffingIntelligence, CareStaffingQuarterSummary } from "@/server/care/types";

const hprd = (value: number | null) =>
  value === null ? "Not calculated" : value.toLocaleString("en-US", { maximumFractionDigits: 3 });

const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

function SourceDisclosure({ summary }: { summary: CareStaffingQuarterSummary }) {
  return (
    <details className="source-disclosure staffing-source">
      <summary>Staffing source and calculation details</summary>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{summary.source.sourceOrganization}</dd>
        </div>
        <div>
          <dt>Dataset</dt>
          <dd>{summary.source.datasetName}</dd>
        </div>
        <div>
          <dt>CMS dataset ID</dt>
          <dd>{summary.source.cmsDatasetIdentifier}</dd>
        </div>
        <div>
          <dt>Quarter</dt>
          <dd>{summary.quarter}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>
            {date(summary.coverageStart)}â€“{date(summary.coverageEnd)}
          </dd>
        </div>
        <div>
          <dt>Days represented</dt>
          <dd>
            {summary.daysRepresented} ({summary.positiveCensusDays} with positive MDS census)
          </dd>
        </div>
        <div>
          <dt>CMS source updated</dt>
          <dd>
            {summary.source.sourceModifiedAt
              ? date(summary.source.sourceModifiedAt.slice(0, 10))
              : "Not reported"}
          </dd>
        </div>
        <div>
          <dt>Calculation version</dt>
          <dd>{summary.formulaVersion}</dd>
        </div>
      </dl>
      <p>
        Hours-per-resident-day values are calculated by this platform from CMS-published daily PBJ
        hours and MDS census. For each displayed period, included hours are summed and divided by
        the summed census for days with a positive census. They are not CMS case-mix-adjusted
        staffing measures or a staffing rating.
      </p>
      <a href={summary.source.officialSourceUrl} rel="noreferrer">
        View official CMS PBJ source
      </a>
    </details>
  );
}

function Trend({ history }: { history: CareStaffingQuarterSummary[] }) {
  if (history.length < 2) return null;
  const chronological = [...history].reverse();
  const maximum = Math.max(
    1,
    ...chronological.flatMap((quarter) => [quarter.totalNurseHprd ?? 0, quarter.rnHprd ?? 0]),
  );
  return (
    <div className="staffing-trend">
      <h3>Quarter-over-quarter reported staffing</h3>
      <div className="staffing-trend__visual" aria-hidden="true">
        {chronological.map((quarter) => (
          <div key={quarter.quarter}>
            <span>{quarter.quarter}</span>
            <i
              className="staffing-bar staffing-bar--total"
              style={
                {
                  "--staffing-width": `${((quarter.totalNurseHprd ?? 0) / maximum) * 100}%`,
                } as CSSProperties
              }
            />
            <i
              className="staffing-bar staffing-bar--rn"
              style={
                {
                  "--staffing-width": `${((quarter.rnHprd ?? 0) / maximum) * 100}%`,
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
      <p className="staffing-trend__legend">Solid: total nursing Â· outlined: RN categories</p>
      <div className="table-scroll" tabIndex={0} aria-label="Quarterly staffing trend table">
        <table>
          <caption>Calculated reported hours per resident day by PBJ quarter</caption>
          <thead>
            <tr>
              <th scope="col">Quarter</th>
              <th scope="col">Total nursing</th>
              <th scope="col">RN categories</th>
              <th scope="col">Days</th>
            </tr>
          </thead>
          <tbody>
            {chronological.map((quarter) => (
              <tr key={quarter.quarter}>
                <th scope="row">{quarter.quarter}</th>
                <td>{hprd(quarter.totalNurseHprd)}</td>
                <td>{hprd(quarter.rnHprd)}</td>
                <td>{quarter.daysRepresented}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffingIntelligence({
  intelligence,
  cmsStaffingRating,
}: {
  intelligence: CareStaffingIntelligence;
  cmsStaffingRating: number | null;
}) {
  const latest = intelligence.latest;
  if (!latest) {
    return (
      <section
        className="profile-section staffing-section"
        id="staffing"
        aria-labelledby="staffing-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Staffing</p>
          <h2 id="staffing-title">Payroll-Based Journal staffing</h2>
        </div>
        <p>No matched PBJ Daily Nurse Staffing quarter is currently loaded for this provider.</p>
      </section>
    );
  }
  const weekendRnLower =
    latest.weekdayRnHprd !== null &&
    latest.weekendRnHprd !== null &&
    latest.weekendRnHprd < latest.weekdayRnHprd;
  const questions = [
    ...(weekendRnLower
      ? [
          "PBJ records show lower calculated RN-category hours per resident day on weekends this quarter. How does the facility plan RN coverage on Saturdays and Sundays?",
        ]
      : []),
    ...(latest.contractNurseShare !== null && latest.contractNurseShare > 0
      ? [
          "PBJ records show that some reported nursing hours were contract hours. How does the facility orient and integrate contract staff?",
        ]
      : []),
  ];
  return (
    <section
      className="profile-section staffing-section"
      id="staffing"
      aria-labelledby="staffing-title"
    >
      <div className="section-heading">
        <p className="eyebrow">Staffing</p>
        <h2 id="staffing-title">Reported nursing staffing at a glance</h2>
        <p>
          CMS staffing rating:{" "}
          {cmsStaffingRating === null ? "not reported" : `${cmsStaffingRating} of 5 stars`}. CMS
          calculates that rating separately using its published methodology. The values below are
          calculations from daily PBJ records for {latest.quarter}.
        </p>
      </div>
      <dl
        className="staffing-metrics"
        aria-label={`${latest.quarter} calculated staffing measures`}
      >
        {[
          ["Total nursing", latest.totalNurseHprd],
          ["RN categories", latest.rnHprd],
          ["LPN/LVN categories", latest.lpnHprd],
          ["CNA", latest.cnaHprd],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt>{label}</dt>
            <dd>{hprd(value as number | null)}</dd>
            <small>reported hours per resident day</small>
          </div>
        ))}
      </dl>
      <div className="staffing-comparison">
        <h3>Weekday and weekend calculations</h3>
        <div className="table-scroll" tabIndex={0}>
          <table>
            <caption>{latest.quarter} reported hours per resident day</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Mondayâ€“Friday</th>
                <th scope="col">Saturdayâ€“Sunday</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Total nursing</th>
                <td>{hprd(latest.weekdayTotalNurseHprd)}</td>
                <td>{hprd(latest.weekendTotalNurseHprd)}</td>
              </tr>
              <tr>
                <th scope="row">RN categories</th>
                <td>{hprd(latest.weekdayRnHprd)}</td>
                <td>{hprd(latest.weekendRnHprd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {latest.contractNurseShare !== null && (
        <p className="staffing-fact">
          Contract staff accounted for {Math.round(latest.contractNurseShare * 1000) / 10}% of
          reported nursing hours included in this quarter calculation.
        </p>
      )}
      {latest.zeroReportedRnDays > 0 && (
        <p className="staffing-fact">
          PBJ reports zero combined RN-category hours on {latest.zeroReportedRnDays} day
          {latest.zeroReportedRnDays === 1 ? "" : "s"} with a positive MDS census in this quarter.
        </p>
      )}
      <Trend history={intelligence.history} />
      {questions.length > 0 && (
        <div className="staffing-questions">
          <h3>Questions to ask</h3>
          <ul>
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}
      <SourceDisclosure summary={latest} />
    </section>
  );
}
