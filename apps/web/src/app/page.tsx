import type { Metadata } from "next";
import { TrustStrip, RealDataNotice, SyntheticDataNotice } from "@/components/evidence";
import { JourneyNextStep } from "@/components/journey-next-step";
import { brand } from "@/config/brand";
import { productionOrigin } from "@/config/deployment";
import {
  parseNetworkJourney,
  resolveSeniorJourneyModule,
} from "@/lib/journey-handoff";

export const metadata: Metadata = {
  alternates: { canonical: productionOrigin.origin },
};

const paths = [
  {
    number: "01",
    title: "I already have a list",
    text: "I was given facility names and need to research them.",
    href: "/shortlist",
    action: "Research my list",
  },
  {
    number: "02",
    title: "Research a facility by name",
    text: "I already know the facility I’m considering.",
    href: "/search",
    action: "Look up a facility",
  },
  {
    number: "03",
    title: "Search nursing homes near me",
    text: "Show me facilities near a location.",
    href: "/search",
    action: "Explore nearby care",
  },
  {
    number: "04",
    title: "Help me understand my options",
    text: "I’m not sure what type of care we need.",
    href: "#planning",
    action: "Understand care types",
  },
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const navigatorEnabled = process.env.CARE_ENABLE_CARE_NEEDS_NAVIGATOR === "true";
  const plannerEnabled = process.env.CARE_ENABLE_SENIOR_CARE_COST_PLANNER === "true";
  const interviewBuilderEnabled = process.env.CARE_ENABLE_FACILITY_INTERVIEW_BUILDER === "true";
  const workspaceEnabled = process.env.CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE === "true";
  const sp = searchParams ? await searchParams : {};
  const journeyModule = resolveSeniorJourneyModule(parseNetworkJourney(sp), "home");
  const entries = paths.map((path) =>
    path.number === "04" && navigatorEnabled
      ? {
          ...path,
          href: "/tools/care-needs-navigator",
          action: "Use the Care Needs Navigator",
        }
      : path,
  );
  return (
    <>
      <div className="page-shell home-page">
        {process.env.CARE_ENABLE_REAL_PROVIDER_UI === "true" ? (
          <RealDataNotice compact />
        ) : (
          <SyntheticDataNotice compact />
        )}
        <section className="home-hero" aria-labelledby="home-title">
          <p className="eyebrow">Independent care research</p>
          <h1 id="home-title">{brand.tagline}</h1>
          <p className="home-hero__lede">
            Understand the facility. See who owns it. Review its history. Compare the evidence.
          </p>
          <div className="home-hero__proof">
            <span className="proof-mark" aria-hidden="true">
              Not for sale
            </span>
            <p>
              We don’t accept paid placement or sell your information to facilities.{" "}
              <strong>{brand.philosophy}</strong>
            </p>
          </div>
        </section>
        <section className="entry-section" aria-labelledby="start-title">
          <div className="section-heading">
            <p className="eyebrow">Start where you are</p>
            <h2 id="start-title">What would help right now?</h2>
          </div>
          <div className="entry-grid">
            {entries.map((path) => (
              <a className="entry-card" href={path.href} key={path.number}>
                <span className="entry-card__number">{path.number}</span>
                <h3>{path.title}</h3>
                <p>{path.text}</p>
                <span className="text-link">
                  {path.action} <span aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </div>
        </section>
        {navigatorEnabled ? (
          <section className="entry-section" aria-labelledby="navigator-home-title">
            <div className="section-heading">
              <p className="eyebrow">Not sure what kind of care you need?</p>
              <h2 id="navigator-home-title">Start with the care landscape, not a facility list</h2>
            </div>
            <p>
              The Care Needs Navigator explains which settings may be worth investigating based on
              daily needs, safety, and support — without a score or a sales pitch.
            </p>
            <a className="button button--secondary" href="/tools/care-needs-navigator">
              Use the Care Needs Navigator →
            </a>
          </section>
        ) : null}
        {plannerEnabled ? (
          <section className="entry-section" aria-labelledby="planner-home-title">
            <div className="section-heading">
              <p className="eyebrow">Understand the cost of care</p>
              <h2 id="planner-home-title">Compare published benchmarks and your own quotes</h2>
            </div>
            <p>
              The Senior Care Cost Planner estimates home care, assisted living, memory care, and
              skilled nursing using transparent assumptions. It is not a quote or eligibility
              decision.
            </p>
            <a className="button button--secondary" href="/tools/senior-care-cost-planner">
              Compare senior care costs →
            </a>
          </section>
        ) : null}
        {interviewBuilderEnabled ? (
          <section className="entry-section" aria-labelledby="interview-home-title">
            <div className="section-heading">
              <p className="eyebrow">Prepare for a facility tour</p>
              <h2 id="interview-home-title">Take better questions to the visit or call</h2>
            </div>
            <p>
              Build a short interview checklist for skilled nursing, rehabilitation, assisted
              living, memory care, or a home-care agency. CMS facility pages can add published
              evidence to the list.
            </p>
            <a className="button button--secondary" href="/tools/facility-tour-interview-builder">
              Build your interview checklist →
            </a>
          </section>
        ) : null}
        {workspaceEnabled ? (
          <section className="entry-section" aria-labelledby="workspace-home-title">
            <div className="section-heading">
              <p className="eyebrow">Compare the facilities you&apos;re considering</p>
              <h2 id="workspace-home-title">Keep a private shortlist in this browser</h2>
            </div>
            <p>
              The Family Comparison Workspace puts published staffing, inspections, ownership, and
              your own notes in one place. It does not pick a winner.
            </p>
            <a className="button button--secondary" href="/workspace">
              Open Family Workspace →
            </a>
          </section>
        ) : null}
        <section className="mode-grid" id="planning" aria-labelledby="mode-title">
          <h2 id="mode-title" className="visually-hidden">
            Choose your research pace
          </h2>
          <article className="mode-card mode-card--urgent">
            <p className="eyebrow">I need help now</p>
            <h3>Make sense of a hospital shortlist</h3>
            <p>
              When discharge is close and several names are on a sheet of paper, start with the
              public record and the questions it raises.
            </p>
            <ul>
              <li>Enter several facility names at once</li>
              <li>Spot differences quickly</li>
              <li>Take questions into your next call</li>
            </ul>
            <a className="button button--primary" href="/shortlist">
              Start a crisis shortlist
            </a>
          </article>
          <article className="mode-card">
            <p className="eyebrow">I’m planning ahead</p>
            <h3>Learn before a decision is urgent</h3>
            <p>
              Understand care types, ownership, staffing, inspections, and costs at your own pace.
            </p>
            <ul>
              <li>Explore what different care types provide</li>
              <li>Build a research vocabulary</li>
              <li>Share evidence with family</li>
            </ul>
            <a className="button button--secondary" href="/search">
              Explore the research prototype
            </a>
          </article>
        </section>
      </div>
      <div className="page-shell" style={{ paddingBlock: "0 3rem" }}>
        <JourneyNextStep module={journeyModule} />
      </div>
      <TrustStrip />
    </>
  );
}
