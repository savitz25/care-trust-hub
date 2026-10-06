import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/utah-public-snapshot.json";

const SOURCE = "https://gis.utah.gov/products/sgid/health/licensed-health-care-facilities/";
const FACILITY_SEARCH = "https://dlbc.utah.gov/home/office-of-licensing/health-facilities/health-facilities-information/";
const CLASSES = [
  "Assisted Living Facility - Type I",
  "Assisted Living Facility - Type II",
  "Nursing Care Facility",
  "Home Health Agency",
  "Hospice",
  "Personal Care Agency",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/utah");
  return {
    title: { absolute: "Utah Licensed Senior Care Facilities | SeniorTrustHub" },
    description: "Utah DHHS licensed-facility GIS observations by facility class. Source last edited March 2026; current license status and inspections require separate verification.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function UtahSeniorPage() {
  return <div className="page-shell home-page class-research-page">
    <RealDataNotice compact />
    <section className="home-hero" aria-labelledby="ut-title">
      <p className="eyebrow">Utah senior care research</p>
      <h1 id="ut-title">Utah licensed health care facilities</h1>
      <p className="home-hero__lede">Utah DHHS licenses health care facilities. Its statewide GIS layer has {snapshot.rawRows.toLocaleString("en-US")} location records across many health care classes. The table below shows only senior-relevant classes, separately. These are observations from a historical layer, not a live count of currently valid licenses or a quality rating.</p>
    </section>
    <section aria-labelledby="ut-classes">
      <h2 id="ut-classes">Source-defined facility classes</h2>
      <p>Each row has a distinct source ID_NUMBER within its class. Type I and Type II assisted living are different licenses. Home health, hospice, and personal care agencies are service providers, not residential beds. Do not add these columns into a senior facility total.</p>
      <div style={{ overflowX: "auto" }}><table><caption>Utah DHHS GIS license-type observations, source last edited 7 March 2026</caption><thead><tr><th scope="col">License type</th><th scope="col">GIS rows</th><th scope="col">Distinct source IDs</th></tr></thead><tbody>{CLASSES.map((kind) => <tr key={kind}><th scope="row">{kind}</th><td>{snapshot.classes[kind].toLocaleString("en-US")}</td><td>{snapshot.idNumberUniqueByClass[kind].toLocaleString("en-US")}</td></tr>)}</tbody></table></div>
      <p>The same layer also has {snapshot.classes["Small Health Care Facility"]} small health care facilities. Their type alone does not establish senior care, so they are excluded from the table. Hospitals, mammography sites, dialysis, surgery, birthing centers, and abortion clinics are also excluded.</p>
    </section>
    <section aria-labelledby="ut-verification">
      <h2 id="ut-verification">Verify before choosing care</h2>
      <p>View the <a href={SOURCE}>Utah Geospatial Resource Center dataset</a> and the <a href={FACILITY_SEARCH}>DHHS health facility information</a>. The GIS fields include ID_NUMBER, license type, capacity, license expiration, and sometimes a CMS certificate number. An expiration date in a March 2026 snapshot cannot establish October 2026 status. Capacity is a source field, not a live opening count. A CMS number is federal certification context, not a Utah license.</p>
      <p>Provider-level inspection findings, complaints, sanctions, and current license-status changes were NOT_ACQUIRED. A complaint is not a finding. No adverse record was joined by name. For a particular facility, confirm its current license and any public reports directly with DHHS.</p>
    </section>
    <section aria-labelledby="ut-provenance">
      <h2 id="ut-provenance">Source clocks and reconciliation</h2>
      <p>The <a href={snapshot.source}>ArcGIS feature service</a> returned {snapshot.rawRows} rows when retrieved {snapshot.retrievedAt}. Its data-last-edit metadata is 7 March 2026, while the UGRC landing page labels the dataset February 2026. The immutable response SHA-256 is <code>{snapshot.rawSha256}</code>. These are source and retrieval clocks, not facility license effective dates.</p>
      <p>Existing canonical matches: NOT_ACQUIRED. Net-new canonical entities: 0. Evidence attachments and graph writes: 0. The source rows are published as research observations without creating new facility profiles. Search results must not imply a current license from this snapshot alone.</p>
      <p><Link href="/">SeniorTrustHub home</Link></p>
    </section>
  </div>;
}

