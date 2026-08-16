import { notFound } from "next/navigation";
import Link from "next/link";
import { TrustRequestForm } from "@/components/trust-request-form";
import { isTrustParticipationEnabled } from "@/server/care/feature-flags";
import { RealDataNotice } from "@/components/evidence";
export const metadata = { title: "Trust request", robots: { index: false, follow: false } };
const kinds = ["claim", "correction", "source-concern", "context"] as const;
export const dynamic = "force-dynamic";
export default async function TrustRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ ccn?: string }>;
}) {
  if (!isTrustParticipationEnabled()) notFound();
  const kind = (await params).kind;
  if (!kinds.includes(kind as (typeof kinds)[number])) notFound();
  const ccn = (await searchParams).ccn?.toUpperCase() ?? "";
  return (
    <div className="page-shell narrow-shell">
      <RealDataNotice />
      <p className="source-inline">
        Requests are manually reviewed and do not alter government evidence.
      </p>
      <TrustRequestForm
        kind={kind as (typeof kinds)[number]}
        ccn={/^[A-Z0-9]{6}$/.test(ccn) ? ccn : ""}
      />
      <p>
        <Link href="/trust/corrections">Read how corrections and provider context work</Link>
      </p>
    </div>
  );
}
