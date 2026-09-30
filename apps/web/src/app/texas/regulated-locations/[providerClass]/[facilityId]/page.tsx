import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadTxHhscLocations,
  txHhscSource,
  TX_HHSC_CLASSES,
  type TxHhscClass,
} from "@/server/care/tx-hhsc-locations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Texas HHSC regulated location | SeniorTrustHub",
  robots: { index: false, follow: false },
};

export default async function TexasLocationProfile({
  params,
}: {
  params: Promise<{ providerClass: string; facilityId: string }>;
}) {
  const { providerClass, facilityId } = await params;
  if (!(providerClass in TX_HHSC_CLASSES) || !/^\d+$/.test(facilityId)) notFound();
  const all = await loadTxHhscLocations();
  const row = all.find((item) => item.namespaced_key === `TX|HHSC|${providerClass}|${facilityId}`);
  if (!row) notFound();
  const source = txHhscSource(row);
  return (
    <main className="page-shell">
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Texas HHSC regulated location/provider</p>
        <h1>{row.official_name}</h1>
        <p className="lede">
          {TX_HHSC_CLASSES[providerClass as TxHhscClass]}. This record identifies a regulated
          provider/location at the source grain.
        </p>
      </header>
      <dl>
        <dt>Regulator</dt>
        <dd>{source.regulator}</dd>
        <dt>Provider class</dt>
        <dd>{TX_HHSC_CLASSES[providerClass as TxHhscClass]}</dd>
        <dt>Texas HHSC Facility ID</dt>
        <dd>{row.facility_id}</dd>
        <dt>TrustHub location identity</dt>
        <dd>
          <code>{row.namespaced_key}</code>
        </dd>
        <dt>Recorded location</dt>
        <dd>
          {[row.physical_address, row.city, row.state, row.zip].filter(Boolean).join(", ") ||
            "Not reported"}
          {row.county ? ` · ${row.county} County` : ""}
        </dd>
        <dt>Facility Licensed, as reported</dt>
        <dd>{row.facility_licensed_raw}</dd>
        <dt>Facility Certified, as reported</dt>
        <dd>{row.facility_certified_raw}</dd>
        <dt>License number</dt>
        <dd>{row.license_number || "Not reported"}</dd>
        {row.license_effective_date ? (
          <>
            <dt>License effective date</dt>
            <dd>{row.license_effective_date}</dd>
          </>
        ) : null}
        {row.license_expiration_date ? (
          <>
            <dt>License expiration date</dt>
            <dd>{row.license_expiration_date}</dd>
          </>
        ) : null}
        <dt>Organization linkage</dt>
        <dd>Not established</dd>
        <dt>Source update date</dt>
        <dd>{source.asOf}</dd>
        <dt>Official source</dt>
        <dd>
          <a href={source.url}>Texas HHSC provider directory</a>
        </dd>
      </dl>
      <p>
        Source status and license facts are reported separately. A license number is not a corporate
        identity or a CMS CCN.
      </p>
      <Link href="/texas/regulated-locations">Back to Texas regulated-location lookup</Link>
    </main>
  );
}
