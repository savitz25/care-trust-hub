import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice, TrustStrip } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/connecticut-public-snapshot.json";
import orders from "@/data/connecticut-orders.json";

const classes = [
  ["Chronic & Convalescent Nursing Home", "Nursing home (CCNH)"],
  ["Residential Care Facility", "Residential Care Facility (RCH)"],
  ["Assisted Living Service Agency", "Assisted Living Service Agency (ALSA)"],
  ["Home Health Care", "Home Health Care (HHC)"],
  ["Homemaker-Home Health Aide", "Homemaker-Home Health Aide (HHHA)"],
  ["Hospice", "Hospice (HSPC)"],
] as const;
const n = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/connecticut");
  return {
    title: { absolute: "Connecticut Senior Care Licenses & Orders | SeniorTrustHub" },
    description:
      "Connecticut DPH facility-license classes, exact credential status and selected facility orders. State licensure, CMS certification and inspections remain separate.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default async function ConnecticutPage({
  searchParams,
}: {
  searchParams: Promise<{ credential?: string }>;
}) {
  const params = await searchParams;
  const code =
    typeof params.credential === "string" && /^[A-Z0-9.]{3,30}$/i.test(params.credential)
      ? params.credential.toUpperCase()
      : "";
  const match = code ? snapshot.rows.find((row) => row.license.toUpperCase() === code) : undefined;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="connecticut-title">
        <p className="eyebrow">Connecticut senior care research</p>
        <h1 id="connecticut-title">Connecticut Senior Care License Research</h1>
        <p className="home-hero__lede">
          The Connecticut Department of Public Health (DPH), through its Facility Licensing and
          Investigations Section (FLIS), licenses distinct nursing-home, residential-care, assisted
          living services, home-health and hospice settings. These are state credential rows, not
          CMS certifications, quality ratings, or one combined senior-facility total.
        </p>
      </section>
      <section aria-labelledby="ct-licenses-title">
        <h2 id="ct-licenses-title">Statewide DPH facility credentials</h2>
        <p>
          The{" "}
          <a href="https://data.ct.gov/Business/State-Licenses-and-Credentials/ngch-56tr/data">
            official Connecticut credential dataset
          </a>{" "}
          is the downloadable mirror of the{" "}
          <a href="https://portal.ct.gov/dph/informatics/mailing-list-request">
            DPH eLicense roster service
          </a>
          . The snapshot keeps only rows whose exact source status is ACTIVE or ACTIVE IN RENEWAL;
          it does not turn renewals into a new category. Each row has a distinct full state
          credential code. Counts below are by exact source class, not deduplicated across classes.
        </p>
        <table>
          <caption>DPH active and active-in-renewal state credential rows by class</caption>
          <thead>
            <tr>
              <th scope="col">Connecticut source class</th>
              <th scope="col">License rows</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{n(snapshot.classCounts[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Source status labels: ACTIVE {n(snapshot.statusCounts.ACTIVE)}; ACTIVE IN RENEWAL{" "}
          {n(snapshot.statusCounts["ACTIVE IN RENEWAL"])}. Current status must be rechecked in{" "}
          <a href="https://portal.ct.gov/dph/practitioner-licensing--investigations/plis/verify-a-license">
            eLicense
          </a>
          . Connecticut also defines a managed residential community separately from the licensed
          Assisted Living Service Agency that provides or arranges care; 126 ALSA licenses are not
          126 generic assisted-living buildings. Facility capacity was not supplied in this export.
          CCRH and Rest Home with Nursing Supervision current rosters were not acquired as clean
          positive classes from this mirror (NOT_ACQUIRED), not asserted to be zero statewide.
        </p>
        <form action="/connecticut">
          <label htmlFor="credential">Exact full Connecticut credential code</label>{" "}
          <input id="credential" name="credential" defaultValue={code} placeholder="CCNH.0002431" />{" "}
          <button type="submit">Look up in this snapshot</button>
        </form>
        {code && (
          <p aria-live="polite">
            {match
              ? `${match.name} — ${match.credential}; ${match.license}; ${match.status}; effective ${match.effectiveDate ?? "not printed"}; expires ${match.expirationDate ?? "not printed"}. This is a dated roster record, not live verification.`
              : `No match for ${code} in these selected active-status classes. This does not establish that a facility is unlicensed; use DPH eLicense.`}
          </p>
        )}
      </section>
      <section aria-labelledby="ct-cms-title">
        <h2 id="ct-cms-title">State licenses and CMS certification are separate</h2>
        <p>
          The DPH credential export does not print CMS CCNs. Exact state-license-to-CMS bridges:{" "}
          {snapshot.cmsExactBridges}. This is not a finding of zero federal overlap. The existing{" "}
          <Link href="/">SeniorTrustHub CMS nursing-home spine</Link> remains separate; no duplicate CMS
          population or name-only bridge was created. A managed residential community, ALSA, and
          federally certified nursing home are not interchangeable identities.
        </p>
      </section>
      <section aria-labelledby="ct-inspections-title">
        <h2 id="ct-inspections-title">Inspections and complaints</h2>
        <p>
          DPH describes nursing-home annual and complaint inspections and provides a public{" "}
          <a href="https://www.elicense.ct.gov/Lookup/OnlineReportExecute.aspx?queryIdnt=25331">
            CCNH inspection-document search
          </a>
          . The report search requires a date window; a statewide report index was not acquired in
          this blitz. Standalone inspection rows and exact inspection attachments are NOT_ACQUIRED,
          not zero inspections. The order documents below may describe earlier inspections, but
          those descriptions are not a separate inspection corpus.
        </p>
        <p>
          <a href="https://portal.ct.gov/dph/facility-licensing--investigations/facility-licensing--investigations-section-flis/flis-complaint-submission">
            FLIS accepts facility complaints
          </a>
          . Intake is KNOWN; provider-level complaint rows are NOT_ACQUIRED and outcomes
          REQUEST_ONLY. A complaint allegation is not a final regulatory finding.
        </p>
      </section>
      <section aria-labelledby="ct-orders-title">
        <h2 id="ct-orders-title">Selected DPH facility orders</h2>
        <p>
          The <a href={orders.sourceIndex}>DPH public facility-order index</a> lists{" "}
          {orders.rows.length} linked actions in this snapshot, dated 2023–2024 within the 2022–2026
          review window. This is the published index, not a complete statewide enforcement census.
          Four text-readable documents print exact CCNH state-license IDs; two match current
          active-status roster rows and two are historical/not in this current roster. The two
          scanned documents are held without a license attachment. Name-only adverse attachments: 0.
        </p>
        <table>
          <caption>
            DPH facility-order index rows; exact license only where printed in the document
          </caption>
          <thead>
            <tr>
              <th scope="col">Date and respondent</th>
              <th scope="col">Action</th>
              <th scope="col">Printed state license</th>
            </tr>
          </thead>
          <tbody>
            {orders.rows.map((row) => (
              <tr key={`${row.date}-${row.respondent}`}>
                <th scope="row">
                  <a href={row.source}>
                    {row.date} — {row.respondent}
                  </a>
                </th>
                <td>{row.actionType}</td>
                <td>{row.stateLicense ?? "NOT_ACQUIRED from scanned document"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Consent orders are identified as such; allegations in an order are not all presented as
          independently adjudicated findings.
        </p>
      </section>
      <section aria-labelledby="ct-boundaries-title">
        <h2 id="ct-boundaries-title">Source clocks and boundaries</h2>
        <p>
          DPH credential dataset Last-Modified: {snapshot.sourceLastModified}; retrieved{" "}
          {snapshot.retrievedAt}; generated {snapshot.generatedAt}. Individual status effective,
          expiration and record-refresh dates remain on each credential. Order dates appear above;
          order index retrieved {orders.retrievedAt}. No universal Connecticut as-of date. Facility
          capacity, a statewide inspection-report corpus, provider complaint outcomes, and exact CMS
          bridges remain NOT_ACQUIRED. Net-new canonical facilities{" "}
          {snapshot.newCanonicalFacilities}; graph writes {snapshot.graphWrites}; claim eligibility
          unchanged. No provider score, ranking, or winner.
        </p>
      </section>
      <TrustStrip />
    </div>
  );
}
