import type { CareNhEvidence } from "@/server/care/types";
import {
  ENROLLMENT_NPI_LABEL,
  MDS_NOT_STAR_RATING,
  abuseIconConsumerExplanation,
  directoryStatusConsumerExplanation,
  sffConsumerExplanation,
  type AbuseIconStatus,
  type DirectoryStatus,
  type SffStatus,
} from "@care/domain";

function formatDate(value: string | null): string {
  if (!value) return "Not reported";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );
}

export function NursingHomeEvidencePanel({ evidence }: { evidence: CareNhEvidence }) {
  const sff = evidence.designations.find((item) => item.kind === "special_focus");
  const abuse = evidence.designations.find((item) => item.kind === "abuse_icon");
  return (
    <>
      <section className="profile-section" id="cms-designations" aria-labelledby="cms-des-title">
        <div className="section-heading">
          <p className="eyebrow">CMS designations</p>
          <h2 id="cms-des-title">Special Focus and abuse-icon status</h2>
          <p>{directoryStatusConsumerExplanation(evidence.directoryStatus as DirectoryStatus)}</p>
        </div>
        {sff ? (
          <div>
            <h3>
              {sff.officialStatus === "SFF"
                ? "Special Focus Facility"
                : sff.officialStatus === "SFF_CANDIDATE"
                  ? "Special Focus Facility candidate"
                  : "Not currently SFF or candidate"}
            </h3>
            <p>{sffConsumerExplanation(sff.officialStatus as SffStatus)}</p>
            <p>
              CMS field value: {sff.rawOfficialValue || "(blank)"}. Observed{" "}
              {formatDate(sff.observedAt)}.
            </p>
          </div>
        ) : null}
        {abuse ? (
          <div>
            <h3>CMS abuse-icon designation</h3>
            <p>{abuseIconConsumerExplanation(abuse.officialStatus as AbuseIconStatus)}</p>
            <p>
              CMS field value: {abuse.rawOfficialValue || "(blank)"}. Observed{" "}
              {formatDate(abuse.observedAt)}.
            </p>
          </div>
        ) : null}
      </section>

      {evidence.enrollmentNpis.length > 0 ? (
        <section className="profile-section" id="enrollment-npi" aria-labelledby="npi-title">
          <div className="section-heading">
            <p className="eyebrow">Enrollment identity</p>
            <h2 id="npi-title">{ENROLLMENT_NPI_LABEL}</h2>
            <p>
              These identifiers come from CMS SNF enrollment records linked to this CCN. They are
              not a substitute for the CMS Certification Number.
            </p>
          </div>
          <ul>
            {evidence.enrollmentNpis.map((item) => (
              <li key={`${item.npi}-${item.enrollmentId ?? "none"}`}>
                NPI {item.npi}
                {item.enrollmentId ? ` · enrollment ${item.enrollmentId}` : ""}
                {item.multipleNpiFlag
                  ? " · CMS reports a multiple-NPI flag on this enrollment"
                  : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {evidence.mdsMeasures.length > 0 ? (
        <section className="profile-section" id="mds-measures" aria-labelledby="mds-title">
          <div className="section-heading">
            <p className="eyebrow">MDS quality measures</p>
            <h2 id="mds-title">Individual CMS quality measures</h2>
            <p>{MDS_NOT_STAR_RATING}</p>
            {evidence.freshness.mdsRelease ? (
              <p>MDS source release {evidence.freshness.mdsRelease}.</p>
            ) : null}
          </div>
          <details>
            <summary>View individual MDS measures</summary>
            <ul>
              {evidence.mdsMeasures.map((item) => (
                <li key={item.measureCode}>
                  <strong>{item.officialName}</strong>
                  {item.stayType ? ` (${item.stayType})` : ""}
                  {": "}
                  {item.suppressed
                    ? item.footnote || "Not available in this CMS extract"
                    : item.fourQuarterAverage}
                  {item.usedInFiveStarRating
                    ? " · CMS uses this measure in the quality-measure star rating"
                    : ""}
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}

      {evidence.fireCitations.length > 0 ? (
        <section className="profile-section" id="fire-safety" aria-labelledby="fire-title">
          <div className="section-heading">
            <p className="eyebrow">Fire-safety citations</p>
            <h2 id="fire-title">CMS fire-safety citations</h2>
            <p>
              These are fire-safety citations, not health deficiencies and not a count of fires.
            </p>
          </div>
          <ul>
            {evidence.fireCitations.map((item) => (
              <li key={`${item.surveyDate}-${item.tag}`}>
                {item.surveyDate} · tag {item.tag} · scope/severity {item.scopeSeverityCode}
                {item.complaintDeficiency ? " · CMS complaint-flagged citation" : ""}
                {item.description ? ` — ${item.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
