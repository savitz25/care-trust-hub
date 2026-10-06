import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "../../../../../data/iowa/ia-sen-001/assisted-living-snapshot.json";

const fmt = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/iowa");
  return {
    title: { absolute: "Iowa Senior Care Facility Research | SeniorTrustHub" },
    description: "Iowa DIAL assisted living certifications and separate nursing, residential care, home health, hospice and adult day regulatory paths.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function IowaSeniorPage() {
  return <div className="page-shell home-page class-research-page">
    <RealDataNotice compact />
    <section className="home-hero" aria-labelledby="ia-title">
      <p className="eyebrow">Iowa senior care research</p>
      <h1 id="ia-title">Iowa facility and program evidence</h1>
      <p className="home-hero__lede">The Iowa Department of Inspections, Appeals, and Licensing oversees distinct care classes. Assisted living program certifications, nursing facility licenses and residential care facility licenses are different records. No combined senior facility count is presented.</p>
    </section>
    <section aria-labelledby="ia-alp">
      <h2 id="ia-alp">Assisted living program certifications</h2>
      <p>The <a href={snapshot.catalog}>DIAL assisted living dataset</a> contains {fmt(snapshot.rawRows)} rows and {fmt(snapshot.distinctCertificationNumbers)} distinct program certification numbers. {snapshot.dementiaSpecific.map(row => `${fmt(row.programs)} source rows are marked dementia-specific “${row.sourceValue}”`).join("; ")}. This certification number identifies a program, not necessarily a unique campus or an individual resident service.</p>
      <p>The catalog last updated this release on {snapshot.catalogLastUpdated}; the CSV was retrieved {snapshot.retrievedAt.slice(0, 10)} UTC. A later retrieval does not make a stale catalog release current. Recheck the named program in the <a href="https://dia-hfd.iowa.gov/">DIAL Health Facility Database</a> before relying on status.</p>
    </section>
    <section aria-labelledby="ia-classes">
      <h2 id="ia-classes">Other care classes remain distinct</h2>
      <p><a href="https://dial.iowa.gov/licenses/health/health-facilities">DIAL defines nursing and skilled nursing facilities, residential care facilities, adult day services and assisted living programs separately.</a> Nursing and residential care state license rows, adult day certifications and current DIAL database entity counts are NOT_ACQUIRED on this page. Hospital swing beds and intermediate care have their own source definitions and cannot be treated as nursing or assisted living duplicates.</p>
      <p>DIAL&apos;s database explains that home health agencies and hospices are not state licensed or subject to state health facility fines; they have federal certification and survey oversight. Their observations cannot be presented as Iowa state licenses. A CMS nursing home overlay is federal evidence, separate from DIAL licensing.</p>
    </section>
    <section aria-labelledby="ia-records">
      <h2 id="ia-records">Inspections, people and enforcement</h2>
      <p>The <a href="https://dia-hfd.iowa.gov/">DIAL Health Facility Database</a> is the named-facility research path for surveys and fines. Facility licenses, inspections, complaints, deficiencies and sanctions are separate events. A complaint is not a finding. Nursing home administrator licenses belong to people, not facilities, and were not linked by name.</p>
      <ul>
        <li>Retained CSV SHA-256: {snapshot.sha256}; grain: assisted living program certification number.</li>
        <li>Existing canonical matches: NOT_ACQUIRED. New canonical facilities and record-level evidence attachments from this page: 0.</li>
        <li>No city or county care pages are published by this Iowa sprint.</li>
      </ul>
    </section>
  </div>;
}
