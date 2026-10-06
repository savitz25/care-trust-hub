import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "../../../../../data/nebraska/ne-sen-001/dhhs-roster-snapshot.json";

const fmt = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/nebraska");
  return {
    title: { absolute: "Nebraska Senior Care Facility Research | SeniorTrustHub" },
    description:
      "Nebraska DHHS assisted living, long-term care, and adult day roster totals, kept as separate license classes. Home health and hospice rosters were not on the roster index.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NebraskaSeniorPage() {
  const alf = snapshot.assistedLiving;
  const ltc = snapshot.nursing;
  const day = snapshot.adultDay;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ne-title">
        <p className="eyebrow">Nebraska senior care research</p>
        <h1 id="ne-title">Nebraska facility license evidence</h1>
        <p className="home-hero__lede">
          The Nebraska Department of Health and Human Services publishes separate facility rosters.
          Assisted living, long-term care, and adult day service are different license classes.
          No combined senior facility count is presented.
        </p>
      </section>
      <section aria-labelledby="ne-alf">
        <h2 id="ne-alf">Assisted living</h2>
        <p>
          The <a href={alf.source}>assisted living roster</a> prints {fmt(alf.totalLicensedFacilities)} licensed
          facilities and {fmt(alf.totalLicensedBeds)} licensed beds. Beds are not facilities. The roster says
          licenses expire {alf.licenseExpirationRule}. Roster updated {alf.rosterUpdated}. HTTP Last-Modified{" "}
          {alf.httpLastModified}.
        </p>
      </section>
      <section aria-labelledby="ne-ltc">
        <h2 id="ne-ltc">Long-term care</h2>
        <p>
          The <a href={ltc.source}>long-term care roster</a> prints {fmt(ltc.printedTotalFacilities)} facilities
          and {fmt(ltc.printedTotalBeds)} beds. That printed total is not added to the assisted living count.
          Licenses expire {ltc.licenseExpirationRule}. Roster updated {ltc.rosterUpdated}. HTTP Last-Modified{" "}
          {ltc.httpLastModified}. Medicare or Medicaid certification is not the state license.
        </p>
        <ul>
          {ltc.classes.map((row) => (
            <li key={row.label}>
              {row.label}: {fmt(row.facilities)} facilities, {fmt(row.beds)} beds
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="ne-day">
        <h2 id="ne-day">Adult day service</h2>
        <p>
          The <a href={day.source}>adult day roster</a> prints {fmt(day.totalLicensed)} total licensed. That
          count is not an assisted living or nursing facility count. Licenses expire {day.licenseExpirationRule}.
          Roster updated {day.rosterUpdated}. HTTP Last-Modified {day.httpLastModified}.
        </p>
      </section>
      <section aria-labelledby="ne-gaps">
        <h2 id="ne-gaps">Classes and events not on these rosters</h2>
        <p>
          The <a href={snapshot.rosterIndex}>DHHS roster index</a> retrieved {snapshot.rosterIndexRetrievedAt}{" "}
          (HTTP Last-Modified {snapshot.rosterIndexHttpLastModified}) lists the three rosters above. Home health
          and hospice are not on that index. Those classes are NOT_ACQUIRED. Missing is not zero.
        </p>
        <p>
          Inspections, complaints, deficiencies, and enforcement orders were NOT_ACQUIRED. A complaint is not a
          finding. No facility name was published from these rosters. Graph writes {snapshot.graphWrites}.
          Omaha and Lincoln are not routes on this page.
        </p>
      </section>
    </div>
  );
}
