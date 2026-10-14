import type { Metadata } from "next";
import Link from "next/link";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const DPHHS = "https://dphhs.mt.gov/oig/licensure/";
const BOUNDS = "https://mt-reports.com/portal/SearchFacility.aspx";
const CLASSES = "https://mt-reports.com/portal/LicenseList.aspx";
const LTC =
  "https://www.dphhs.mt.gov/oig/Licensure/HealthCareFacilityLicensure/CertificateofNeed/longtermcarefacilities";
const CMS = "https://data.cms.gov/provider-data/";

const canonical = canonicalUrl("/montana");

export const metadata: Metadata = {
  title: "Montana Senior Care Facility Licensing Evidence",
  description:
    "Montana DPHHS facility licensing sources, 61 long-term-care location observations, and separate NOT_ACQUIRED class populations.",
  ...(canonical ? { alternates: { canonical } } : {}),
  robots: publicRobots(true),
};

const sourceLink = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
    {label}
  </a>
);

export default function MontanaSeniorPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 text-slate-900 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-600">
        <Link href="/" className="underline">
          Home
        </Link>{" "}
        / Montana
      </nav>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-800">
        Montana · DPHHS Licensure Bureau
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">
        Montana senior-care facility licensing evidence
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-700">
        Montana’s Department of Public Health and Human Services (DPHHS), Licensure Bureau, provides
        the state facility-search pathways through BOUNDS. The state’s class-selectable search and
        location listings represent different source populations. This page preserves their
        distinctions and reports only the observations acquired in the G-B3 preflight.
      </p>

      <section
        className="mt-8 rounded-xl border border-slate-200 p-5"
        aria-labelledby="long-term-care"
      >
        <h2 id="long-term-care" className="text-2xl font-semibold">
          Long-term-care facility locations
        </h2>
        <p className="mt-3 text-3xl font-bold">61 location rows</p>
        <p className="mt-2 text-slate-700">
          The DPHHS long-term-care locations page displayed 61 facility-location rows and 61
          exact-distinct displayed names. The source provides facility name and address fields, but
          no source-as-of date, license identifier, explicit license status, or bed count. These are
          location-list observations, not a verified active-license count, a distinct legal-entity
          census, or an all-senior denominator.
        </p>
        <p className="mt-3">{sourceLink(LTC, "DPHHS long-term-care facility locations")}</p>
      </section>

      <section className="mt-10" aria-labelledby="facility-classes">
        <h2 id="facility-classes" className="text-2xl font-semibold">
          Other facility classes remain separate
        </h2>
        <p className="mt-2 text-slate-700">
          BOUNDS exposes facility-class search and current status selection. The preflight verified
          those pathways and class labels but did not acquire class-specific roster rows or
          status-filtered exports. These classes are NOT_ACQUIRED, not zero:
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Nursing-facility license roster</dt>
            <dd className="mt-1 text-sm text-slate-700">
              NOT_ACQUIRED. The separate source-listed long-term-care location observations above do
              not establish license status.
            </dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Assisted Living Facility</dt>
            <dd className="mt-1 text-sm text-slate-700">NOT_ACQUIRED.</dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Adult Foster Care Home</dt>
            <dd className="mt-1 text-sm text-slate-700">
              NOT_ACQUIRED. Kept source-defined and separate.
            </dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Home Health Agency</dt>
            <dd className="mt-1 text-sm text-slate-700">NOT_ACQUIRED.</dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Hospice</dt>
            <dd className="mt-1 text-sm text-slate-700">NOT_ACQUIRED.</dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">
              Intermediate Care Facility for Developmentally Disabled
            </dt>
            <dd className="mt-1 text-sm text-slate-700">NOT_ACQUIRED.</dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Adult Day Care</dt>
            <dd className="mt-1 text-sm text-slate-700">NOT_ACQUIRED.</dd>
          </div>
          <div className="rounded-lg border p-4">
            <dt className="font-semibold">Retirement Homes and other BOUNDS classes</dt>
            <dd className="mt-1 text-sm text-slate-700">NOT_ACQUIRED.</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="separate-evidence">
        <h2 id="separate-evidence" className="text-2xl font-semibold">
          Facility identity, surveys, and CMS are separate
        </h2>
        <p className="mt-3 text-slate-700">
          Facility/location identity is not a license or status observation. BOUNDS recent surveys
          are a separate observation stream; a survey is not enforcement. License status, capacity
          or beds, inspection history, complaints, and enforcement need their own source records and
          were not acquired as this facility roster. Federal CMS certification, provider
          identifiers, surveys, and enforcement remain a separate overlay and are not merged into
          the state location list.
        </p>
        <p className="mt-3">
          {sourceLink(DPHHS, "Montana DPHHS Licensure Bureau")} ·{" "}
          {sourceLink(BOUNDS, "Montana BOUNDS facility search")} ·{" "}
          {sourceLink(CLASSES, "BOUNDS facility license classes")} ·{" "}
          {sourceLink(CMS, "CMS Care Compare data")}
        </p>
      </section>

      <section className="mt-10 border-t border-slate-200 pt-6" aria-labelledby="source-clock">
        <h2 id="source-clock" className="text-xl font-semibold">
          Source clock and evidence limits
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          G-B3 preflight retrieval: October 14, 2026. The long-term-care location list has no
          printed source-as-of date. The 61 observations are retained only at their displayed
          location-row grain, with exact displayed-name distinctness as a text check. No facility
          license census, active-status total, bed total, or cross-class senior-care total is
          reported.
        </p>
        <p className="mt-3 text-sm">
          <Link className="underline" href="/ask?q=Montana%20senior%20care%20licensing%20evidence">
            Ask about Montana senior-care licensing
          </Link>
        </p>
      </section>
    </main>
  );
}
