export function Header({ productName, networkName }: { productName: string; networkName: string }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand-mark" href="/" aria-label={`${productName} home`}>
          <img
            className="brand-mark__logo"
            src="/brand/senior-trust-hub-logo.svg"
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
        <a className="network-label" href="https://www.asktrusthub.com/">
          {networkName}
        </a>
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
            src="/brand/senior-trust-hub-footer.svg"
            alt={productName}
          />
          <strong className="site-footer__motto">{philosophy}</strong>
          <p>Research senior care without being sold senior care.</p>
          <p>
            {productName} is part of the {networkName} network.
          </p>
        </div>
        <div>
          <strong>Our promise</strong>
          <p>No paid placements. Facilities cannot pay to rank higher.</p>
          <nav className="footer-nav" aria-label="About SeniorTrustHub">
            <a href="/about">About</a>
            <a href="/methodology">Methodology</a>
            <a href="/sources">Sources</a>
            <a href="/independence">Independence</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
