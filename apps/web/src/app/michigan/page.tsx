import type { Metadata } from "next";
import { RealDataNotice, TrustStrip } from "@/components/evidence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import snapshot from "@/data/michigan-public-snapshot.json";

const classes = [
  ["AF", "Adult Foster Care — Family Home"],
  ["AS", "Adult Foster Care — Small Group"],
  ["AM", "Adult Foster Care — Medium Group"],
  ["AL", "Adult Foster Care — Large Group"],
  ["AG", "Adult Foster Care — Congregate"],
  ["AI", "Adult Foster Care — County Infirmary"],
  ["AH", "Home for the Aged"],
  ["XH", "Exempt HFA code (separate; not a licensed AH)"],
] as const;
const n = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/michigan");
  return {
    title: { absolute: "Michigan Senior Care License Research | SeniorTrustHub" },
    description:
      "Michigan LARA/BCHS AFC, Home for the Aged, nursing home and hospice license snapshots, inspection availability and exact-license discipline evidence. Separate classes; no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function MichiganPage() {
  const pageUrl = new URL("/michigan", productionOrigin).href;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "@id": `${pageUrl}#webpage`,
              name: "Michigan Senior Care License Research",
              url: pageUrl,
              isPartOf: { "@id": `${productionOrigin.href}#website` },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                { "@type": "ListItem", position: 2, name: "Michigan", item: pageUrl },
              ],
            },
            {
              "@type": "Dataset",
              name: "Michigan LARA senior-care facility source snapshot",
              description:
                "Class-specific LARA/BCHS state-license rows and disciplinary actions. Not a CMS certification census or provider rating.",
              creator: { "@id": `${productionOrigin.href}#organization` },
              isAccessibleForFree: true,
            },
          ],
        }}
      />
      <section className="home-hero" aria-labelledby="michigan-title">
        <p className="eyebrow">Michigan senior care research</p>
        <h1 id="michigan-title">Michigan Senior Care Research</h1>
        <p className="home-hero__lede">
          Michigan LARA&apos;s Bureau of Community and Health Systems (BCHS) licenses distinct Adult
          Foster Care (AFC), Home for the Aged (HFA), nursing home and hospice settings. Michigan
          does not license a generic “assisted living” category. State licenses are not CMS
          certifications; capacity is not occupancy. These are source snapshots, not rankings or one
          combined facility total.
        </p>
      </section>
      <section aria-labelledby="mi-afc-title">
        <h2 id="mi-afc-title">Daily statewide AFC / HFA open-file snapshot</h2>
        <p>
          Source:{" "}
          <a href="https://www.michigan.gov/lara/bureau-list/bchs/adult/online-lookups/statewide-text-file-of-adult-foster-care-homes-for-the-aged-facilities">
            LARA statewide file and record key
          </a>
          . Retrieved {snapshot.afcRetrievedAt}. {snapshot.afcSourceClock} Rows are open-file
          records; status and license labels are preserved in the acquired source data.
        </p>
        <table>
          <caption>Distinct LARA file codes; licensed capacity, not residents</caption>
          <thead>
            <tr>
              <th scope="col">Code and class</th>
              <th scope="col">Rows</th>
              <th scope="col">Capacity</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(([code, label]) => (
              <tr key={code}>
                <th scope="row">
                  {code} — {label}
                </th>
                <td>{n(snapshot.afcClassCounts[code])}</td>
                <td>{n(snapshot.afcClassCapacity[code])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          “XH” appears in the current file but is not defined in the published AFC class key. It is
          shown separately as exempt, not counted as licensed AH. No personal licensee addresses or
          contact fields are published here.
        </p>
      </section>
      <section aria-labelledby="mi-health-title">
        <h2 id="mi-health-title">Active health-facility license exports</h2>
        <p>
          Source:{" "}
          <a href="https://www.michigan.gov/lara/bureau-list/bchs/directory">
            LARA Verify a License directory
          </a>
          , active class-filtered downloads, retrieved {snapshot.healthRetrievedAt}. These exports
          and the daily AFC/HFA file have different clocks; their HFA row counts need not match.
        </p>
        <table>
          <caption>State license/export rows by provider class</caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Rows</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(snapshot.healthClassCounts).map(([label, count]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{n(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Exact LARA-to-LARA legacy-license matches: {n(snapshot.exactHfaLegacyBridges.licensed)}{" "}
          licensed HFA and {n(snapshot.exactHfaLegacyBridges.exempt)} exempt HFA. No CMS CCN was
          printed in these exports, so exact state-to-CMS bridges: {snapshot.exactCmsBridges}.
          Existing CMS data remains separate. A state Home Health Agency export was not acquired
          (NOT_ACQUIRED).
        </p>
      </section>
      <section aria-labelledby="mi-inspections-title">
        <h2 id="mi-inspections-title">Inspections and disciplinary actions</h2>
        <p>
          LARA&apos;s{" "}
          <a href="https://www.michigan.gov/lara/bureau-list/bchs/verify-lic">Verify a License</a>{" "}
          provides recent annual and complaint-related reports on facility records. A bounded index
          example is{" "}
          <a href={snapshot.inspectionSample.source}>
            Nursing Home license {snapshot.inspectionSample.stateLicense}
          </a>
          : {snapshot.inspectionSample.reportType}, dated{" "}
          {snapshot.inspectionSample.reportDateAsPrinted}, exact facility ID{" "}
          {snapshot.inspectionSample.facilityId}. This is one exact-license report attachment, not a
          statewide inspection census; report outcomes and complaint totals were not acquired.
        </p>
        <p>
          The{" "}
          <a href="https://www.michigan.gov/lara/bureau-list/bchs/adult/online-lookups/adult-foster-care-and-homes-for-the-aged-facilities-closed-or-suspended-due-to-disciplinary-action">
            LARA AFC/HFA disciplinary closure list
          </a>{" "}
          has {n(snapshot.disciplineRows)} published rows in this snapshot (retrieved{" "}
          {snapshot.disciplineRetrievedAt}; page last updated 2026-03-18). Source action labels:{" "}
          {Object.entries(snapshot.disciplineActionCounts)
            .map(([label, count]) => `${label}: ${count}`)
            .join("; ")}
          . No action row matches a currently open AFC/HFA license exactly, which is expected for a
          closure list. Exact current-open attachments: {snapshot.disciplineCurrentOpenAttachments};
          name-only attachments: 0. A refusal to renew is not automatically a finding of abuse, and
          this list is not a complaint census.
        </p>
      </section>
      <section aria-labelledby="mi-boundaries-title">
        <h2 id="mi-boundaries-title">What this evidence does not say</h2>
        <p>
          No combined Michigan senior-facility total; no provider score or winner. CMS
          certification, state licenses, inspection reports and disciplinary actions remain separate
          records. No name-only CMS or adverse-evidence joins. Net-new canonical facilities, graph
          writes and claim-eligibility changes: 0. Verify current status and reports with LARA
          before making a decision.
        </p>
      </section>
      <TrustStrip />
    </div>
  );
}
