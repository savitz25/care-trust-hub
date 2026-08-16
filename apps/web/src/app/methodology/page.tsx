import { PublicInformationPage } from "@/components/public-information-page";
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
      <h2>Limits</h2>
      <p>
        Government records can be incomplete, delayed, corrected, or reported under specific program
        definitions. Missing information is not evidence of a positive or negative condition.
      </p>
    </PublicInformationPage>
  );
}
