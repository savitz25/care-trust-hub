export type NetworkLink = {
  id: string;
  name: string;
  href: string;
  blurb: string;
};

export function Header({
  productName,
  networkName,
  networkLinks = [],
  currentHubId = "senior",
}: {
  productName: string;
  networkName: string;
  networkLinks?: readonly NetworkLink[];
  currentHubId?: string;
}) {
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
        {networkLinks.length > 0 ? (
          <details className="switch-hub">
            <summary className="switch-hub__summary">Switch Hub</summary>
            <div className="switch-hub__panel" role="menu" aria-label="Ask Trust Hub Network">
              <p className="switch-hub__eyebrow">{networkName} Network</p>
              <ul>
                {networkLinks.map((hub) => {
                  const current = hub.id === currentHubId;
                  return (
                    <li key={hub.id}>
                      <a
                        href={current ? "/" : hub.href}
                        aria-current={current ? "page" : undefined}
                        rel={current ? undefined : "noopener noreferrer"}
                      >
                        <strong>
                          {hub.name}
                          {current ? <span className="switch-hub__current"> Current</span> : null}
                        </strong>
                        <span>{hub.blurb}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        ) : (
          <a className="network-label" href="https://www.asktrusthub.com/">
            {networkName}
          </a>
        )}
      </div>
    </header>
  );
}

export function Footer({
  philosophy,
  networkName,
  productName = "SeniorTrustHub",
  networkLinks = [],
  standardUrl = "https://www.asktrusthub.com/methodology",
  ownershipLine = "Common ownership · Separated research and listing order · No paid placements",
}: {
  philosophy: string;
  networkName: string;
  productName?: string;
  networkLinks?: readonly NetworkLink[];
  standardUrl?: string;
  ownershipLine?: string;
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
            <a href={standardUrl}>Ask Trust Hub Standard</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
          {networkLinks.length > 0 ? (
            <nav className="footer-nav" aria-label="Ask Trust Hub network">
              {networkLinks
                .filter((hub) => hub.id !== "senior")
                .map((hub) => (
                  <a key={hub.id} href={hub.href} rel="noopener noreferrer">
                    {hub.name}
                  </a>
                ))}
            </nav>
          ) : null}
          <p>{ownershipLine}</p>
        </div>
      </div>
    </footer>
  );
}
