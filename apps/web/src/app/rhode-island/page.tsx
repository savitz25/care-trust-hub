import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/rhode-island-senior-snapshot.json";

const n = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/rhode-island");
  return {
    title: { absolute: "Rhode Island Senior Care Licenses | SeniorTrustHub" },
    description:
      "Rhode Island Department of Health senior-care facility licenses by source-defined class. State license records, inspections, complaints, enforcement and federal certification remain separate.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default async function RhodeIslandPage({
  searchParams,
}: {
  searchParams: Promise<{ credential?: string }>;
}) {
  const params = await searchParams;
  const code =
    typeof params.credential === "string" && /^[A-Z0-9.-]{3,30}$/i.test(params.credential)
      ? params.credential.toUpperCase()
      : "";
  const match = code
    ? snapshot.rows.find((row) => row["License No"].toUpperCase() === code)
    : undefined;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ri-title">
        <p className="eyebrow">Rhode Island senior care research</p>
        <h1 id="ri-title">Rhode Island Senior Care Facility Licenses</h1>
        <p className="home-hero__lede">
          The Rhode Island Department of Health Center for Health Facilities Regulation licenses
          facility types under distinct state classes. These are active state license records from
          the RIDOH public roster, not CMS certifications, inspections, complaint outcomes, or one
          combined senior-facility census.
        </p>
      </section>
      <section aria-labelledby="ri-licenses-title">
        <h2 id="ri-licenses-title">Active RIDOH facility license records</h2>
        <p>
          The <a href={snapshot.sourcePage}>RIDOH Licensee List</a> publishes facility names,
          license numbers, exact license types, status, issue and expiration dates, location and
          selected capacity fields. Its page clock is {snapshot.sourceLastUpdated ?? "not supplied"}
          ; this roster was retrieved{" "}
          {new Date(snapshot.retrievedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC. Counts
          below are distinct active license numbers within each exact source class. Classes remain
          separate because one facility may hold more than one license.
        </p>
        <table>
          <caption>RIDOH active facility license numbers by source class</caption>
          <thead>
            <tr>
              <th scope="col">RIDOH license class</th>
              <th scope="col">Active license numbers</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.classes.map((item) => (
              <tr key={item.class}>
                <th scope="row">{item.class}</th>
                <td>{n(item.distinctActiveLicenseNumbers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action="/rhode-island">
          <label htmlFor="credential">Exact RIDOH license number</label>{" "}
          <input id="credential" name="credential" defaultValue={code} placeholder="LTC00849" />{" "}
          <button type="submit">Look up this roster snapshot</button>
        </form>
        {code && (
          <p aria-live="polite">
            {match
              ? `${match.Name} — ${match["License No"]}; ${match["License Type"]}; ${match.Status}; issued ${match["Issue Date"] || "not printed"}; expires ${match["Expiration Date"] || "not printed"}. This dated roster is not live verification.`
              : `No exact license-number match for ${code} in these selected active facility classes. This does not establish that a facility is unlicensed; use RIDOH live facility verification.`}
          </p>
        )}
        <p>
          <a href="https://healthri.mylicense.com/verification/Search.aspx?facility=Y">
            RIDOH live facility verification
          </a>{" "}
          should be used to confirm current status. Assisted Living Residence, Limited Health
          Service, and Special Care Unit licenses are separate source classes. Home Nursing Care and
          Hospice branches are also listed separately from their provider licenses. Nursing Facility
          rows exclude the nursing-home resident-attendant training program. Person-level
          administrator licenses are outside this facility roster.
        </p>
      </section>
      <section aria-labelledby="ri-boundaries-title">
        <h2 id="ri-boundaries-title">Licenses and oversight evidence are separate</h2>
        <p>
          The RIDOH active roster is not an inspection, complaint, or enforcement dataset.
          Provider-level complaint and inspection records and a statewide facility-order corpus were
          NOT_ACQUIRED for this snapshot; that does not mean none exist. Capacity fields are
          retained only where printed and are not used to infer bed totals. CMS certification and
          federal survey data remain separate, with no name-only crosswalk.
        </p>
        <p>
          Source page SHA-256: <code>{snapshot.sourcePageSha256}</code>. Per-class downloaded source
          hashes and row counts are recorded in the acquisition manifest.
        </p>
      </section>
    </div>
  );
}
