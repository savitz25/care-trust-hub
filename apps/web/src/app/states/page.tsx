import type { Metadata } from "next";
import Link from "next/link";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { PUBLISHED_STATE_COUNT, PUBLISHED_STATES } from "@/lib/published-states";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/states");
  return {
    title: { absolute: "Senior Care Research by State | SeniorTrustHub" },
    description: `Every published SeniorTrustHub state page: ${PUBLISHED_STATE_COUNT} states with source-native senior-care licensing and oversight research.`,
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function PublishedStatesPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <section className="home-hero" aria-labelledby="states-title">
        <p className="eyebrow">Senior care research by state</p>
        <h1 id="states-title">{PUBLISHED_STATE_COUNT} published state pages</h1>
        <p className="home-hero__lede">
          Each state page describes what that state&apos;s regulators publish, in the source&apos;s
          own facility classes. Coverage differs by state. These pages are not a ranking, and their
          counts are not added into one national total.
        </p>
      </section>
      <section aria-labelledby="states-list">
        <h2 id="states-list">All published states</h2>
        <nav aria-label="Published states">
          <ul className="th-state-links">
            {PUBLISHED_STATES.map((state) => (
              <li key={state.slug}>
                <Link prefetch={false} href={state.href}>
                  {state.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </div>
  );
}
