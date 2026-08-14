export function Header({ productName, networkName }: { productName: string; networkName: string }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand-mark" href="/" aria-label={`${productName} home`}>
          <span className="brand-mark__symbol" aria-hidden="true">
            C
          </span>
          <span>
            <strong>{productName}</strong>
            <small>Independent care research</small>
          </span>
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

export function Footer({ philosophy, networkName }: { philosophy: string; networkName: string }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <strong className="site-footer__motto">{philosophy}</strong>
          <p>Independent research within the {networkName} network.</p>
        </div>
        <div>
          <strong>Our promise</strong>
          <p>No paid placements. No facility lead fees. Sources and dates shown.</p>
        </div>
      </div>
    </footer>
  );
}
