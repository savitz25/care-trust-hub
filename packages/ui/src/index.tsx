export function Header({ productName, networkName }: { productName: string; networkName: string }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand-mark" href="/" aria-label={`${productName} home`}>
          <img
            className="brand-mark__logo"
            src="/brand/seniortrusthub-compact.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="visually-hidden">{productName}</span>
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="/shortlist">Shortlist</a>
          <a href="/search">Find care</a>
          <a href="/compare">Compare</a>
        </nav>
        <span className="network-label">{networkName}</span>
      </div>
    </header>
  );
}

export function Footer({
  philosophy,
  networkName,
  productName = "SeniorTrustHub",
}: {
  philosophy: string;
  networkName: string;
  productName?: string;
}) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <img
            className="site-footer__logo"
            src="/brand/seniortrusthub-footer.svg"
            alt={productName}
          />
          <strong className="site-footer__motto">{philosophy}</strong>
          <p>
            {productName} is part of the {networkName} network.
          </p>
        </div>
        <div>
          <strong>Our promise</strong>
          <p>No paid placements. No facility lead fees. Sources and dates shown.</p>
        </div>
      </div>
    </footer>
  );
}
