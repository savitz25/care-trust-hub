import { brand } from "@/config/brand";

const foundationItems = [
  "Evidence with visible source provenance",
  "Historical snapshots instead of overwritten facts",
  "Clear separation of official and facility-submitted information",
] as const;

export default function DevelopmentHome() {
  return (
    <div className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Development environment · synthetic content only</p>
        <h1 id="page-title">{brand.publicName}</h1>
        <p className="lede">{brand.tagline}</p>
        <p>
          This foundation is preparing a calm, independent research experience for families making
          difficult care decisions. It contains no real facility records or claims.
        </p>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <p className="eyebrow">Foundation principles</p>
          <h2 id="foundation-title">Built to make evidence understandable</h2>
        </div>
        <ul>
          {foundationItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <aside className="notice" aria-labelledby="notice-title">
        <h2 id="notice-title">Not a provider directory—yet</h2>
        <p>
          Search, profiles, comparisons, and government data ingestion belong to later approved
          phases. No facility can pay for placement in this product.
        </p>
      </aside>
    </div>
  );
}
