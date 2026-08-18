import { PublicInformationPage } from "@/components/public-information-page";
import {
  isCareNeedsNavigatorEnabled,
  isSeniorCareCostPlannerEnabled,
} from "@/server/care/feature-flags";
export const metadata = { title: "Data methodology" };
export default function Page() {
  return (
    <PublicInformationPage
      eyebrow="Methodology"
      title="How SeniorTrustHub uses evidence"
      intro="Published source records remain distinct from transparent SeniorTrustHub calculations and provider-supplied context."
    >
      <h2>Official evidence</h2>
      <p>
        We preserve dataset, release, retrieval, record, and transformation provenance. We do not
        rewrite CMS records when they are disputed.
      </p>
      <h2>Transparent calculations</h2>
      <p>
        Derived values identify their source period and method. PBJ hours per resident day use
        eligible positive-census days and ratio-of-sums calculations.
      </p>
      <h2>Care Needs Navigator</h2>
      <p>
        The Navigator is a versioned, deterministic educational tool. It does not diagnose,
        determine medical necessity, or persist health answers. When skilled nursing or short-term
        rehabilitation may be worth investigating, it can continue into SeniorTrustHub&apos;s
        existing CMS-certified facility research.
        {isCareNeedsNavigatorEnabled() ? (
          <>
            {" "}
            <a href="/tools/care-needs-navigator">Open the Care Needs Navigator</a>.
          </>
        ) : null}
      </p>
      <h2>Senior Care Cost Planner</h2>
      <p>
        Cost estimates use versioned published benchmarks and user-entered amounts. They are not
        quotes or eligibility decisions.
        {isSeniorCareCostPlannerEnabled() ? (
          <>
            {" "}
            <a href="/tools/senior-care-cost-planner">Open the Senior Care Cost Planner</a>.
          </>
        ) : null}
      </p>
      <h2>Limits</h2>
      <p>
        Government records can be incomplete, delayed, corrected, or reported under specific program
        definitions. Missing information is not evidence of a positive or negative condition.
      </p>
    </PublicInformationPage>
  );
}
