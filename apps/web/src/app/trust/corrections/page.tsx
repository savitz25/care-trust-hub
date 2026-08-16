import Link from "next/link";

export const metadata = { title: "How corrections work" };

export default function CorrectionsPage() {
  return (
    <div className="page-shell narrow-shell trust-methodology">
      <header className="page-intro">
        <p className="eyebrow">SeniorTrustHub methodology</p>
        <h1>How corrections and provider context work</h1>
        <p className="lede">
          Public evidence stays public evidence. Our mappings can be corrected, and provider
          statements remain separately labeled.
        </p>
      </header>
      <section>
        <h2>Three separate evidence layers</h2>
        <h3>Official source evidence</h3>
        <p>
          CMS and other government records remain unchanged. SeniorTrustHub cites the published
          record and cannot rewrite it because someone disputes it.
        </p>
        <h3>SeniorTrustHub normalization and mapping</h3>
        <p>
          If we connected a source record to the wrong provider or organization, we can correct that
          mapping after documented review. Material corrections may carry a disclosure while the
          source record remains intact.
        </p>
        <h3>Provider-supplied context</h3>
        <p>
          Providers may submit factual context for moderation. Approved context is labeled as
          provider-supplied and never merged into CMS evidence, search ranking, What to Review, or
          source cards.
        </p>
      </section>
      <section>
        <h2>Participation is free</h2>
        <p>
          Profile claims, correction requests, source-data concerns, and factual context submissions
          are free. Payment cannot influence review timing, search inclusion, prominence, evidence,
          comparison, or ranking.
        </p>
        <p>
          A profile claim verifies response authority; it does not independently verify beneficial
          ownership or quality.
        </p>
      </section>
      <section>
        <h2>Disputes do not suppress evidence</h2>
        <p>
          Official evidence remains visible while a request is under review. A concern about a
          publishing agency’s data must ultimately be corrected with that agency, though separately
          labeled provider context may also be submitted here.
        </p>
      </section>
      <nav className="facility-card__actions" aria-label="Trust participation options">
        <Link className="button button--secondary" href="/trust/correction">
          Suggest a correction
        </Link>
        <Link className="button button--secondary" href="/trust/source-concern">
          Report a source-data concern
        </Link>
        <Link className="button button--secondary" href="/trust/claim">
          Submit a profile claim
        </Link>
      </nav>
    </div>
  );
}
