import { PublicInformationPage } from "@/components/public-information-page";
import { publicInformationMetadata } from "@/config/metadata";
import {
  ASSISTED_LIVING_COVERAGE_NOTE,
  ASSISTED_LIVING_INSPECTION_GAP,
  MDS_NOT_STAR_RATING,
  NURSING_HOME_REPEATED_LIMITATIONS,
} from "@care/domain";
import {
  isCareNeedsNavigatorEnabled,
  isSeniorCareCostPlannerEnabled,
} from "@/server/care/feature-flags";
export const metadata = publicInformationMetadata("Data methodology", "/methodology");
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
      <h2 id="pbj-hours">Transparent calculations</h2>
      <p>
        Derived values identify their source period and method. PBJ hours per resident day use
        eligible positive-census days and ratio-of-sums calculations.
      </p>
      <p>
        Hours-per-resident-day values are calculated by this platform from CMS-published daily PBJ
        hours and MDS census. For each displayed period, included hours are summed and divided by
        the summed census for days with a positive census. They are not CMS case-mix-adjusted
        staffing measures or a staffing rating.
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
      <h2 id="cms-research-method">How Trust Hub reads CMS nursing-home records</h2>
      <ul>
        <li>CMS is the source for national nursing-home evidence.</li>
        <li>Trust Hub does not create the CMS star ratings.</li>
        <li>Ownership evidence does not measure care quality.</li>
        <li>CMS CHOW records document reported ownership-change events.</li>
        <li>Missing evidence is not interpreted as zero.</li>
        <li>UNKNOWN ownership history is not interpreted as divestiture.</li>
      </ul>
      <ul>
        {NURSING_HOME_REPEATED_LIMITATIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 id="cms-ratings">How CMS star ratings are read</h2>
      <p>
        These are CMS star ratings, not Trust Hub ratings. Missing evidence is shown as not
        reported, not as zero.
      </p>
      <p>No proprietary TrustHub score. These ratings are published separately by CMS.</p>
      <p>{MDS_NOT_STAR_RATING}</p>
      <h2 id="cms-ownership">How CMS ownership disclosures are read</h2>
      <p>
        These are CMS-published ownership disclosures. Medicare enrollment ownership and
        managerial-control information is reported by enrolled providers through CMS forms; it is
        not an independent determination of beneficial ownership.
      </p>
      <p>
        Roles are shown as CMS publishes them. Different CMS sources can describe different
        enrollment, ownership, and control concepts, so TrustHub keeps each source-specific
        disclosure distinct.
      </p>
      <p>
        These identifiers come from CMS SNF enrollment records linked to this CCN. They are not a
        substitute for the CMS Certification Number.
      </p>
      <p>
        These relationships were observed in an older snapshot. UNKNOWN does not mean former owner,
        previous owner, or that ownership ended.
      </p>
      <p>
        Operator, licensee, owner, manager, and chain stay separate. A connected organization is not
        automatically the party that runs daily operations.
      </p>
      <h2 id="cms-quality-families">How CMS quality evidence families are reported</h2>
      <p>Staffing, inspections, and fire safety are separate CMS evidence families.</p>
      <p>
        MDS quality observations, PBJ staffing records, inspection evidence, and fire-safety
        evidence are each a CMS extract family. A facility page names a family when that family is
        not in the extract.
      </p>
      <h2 id="assisted-living-evidence">How assisted-living evidence is published</h2>
      <p>{ASSISTED_LIVING_COVERAGE_NOTE}</p>
      <p>{ASSISTED_LIVING_INSPECTION_GAP}</p>
    </PublicInformationPage>
  );
}
