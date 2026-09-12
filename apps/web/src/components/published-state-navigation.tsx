import Link from "next/link";
import { HeaderDisclosure } from "./header-disclosure";

// Approved, published intelligence pages. This is NOT CMS search's geographic coverage list.
export const PUBLISHED_STATE_NAVIGATION = [
  { href: "/florida", label: "Florida" },
  { href: "/new-jersey", label: "New Jersey" },
  { href: "/california", label: "California" },
  { href: "/texas", label: "Texas" },
  { href: "/washington", label: "Washington" },
  { href: "/arizona", label: "Arizona" },
  { href: "/colorado", label: "Colorado" },
  { href: "/virginia", label: "Virginia" },
  { href: "/new-york", label: "New York" },
] as const;

export function PublishedStateNavigation({
  items = PUBLISHED_STATE_NAVIGATION,
}: {
  items?: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <HeaderDisclosure label="By state">
      <nav aria-label="Published state research">
        <ul className="th-state-links">
          {items.map((item) => (
            <li key={item.href}>
              <Link prefetch={false} href={item.href} className="th-drawer-link">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </HeaderDisclosure>
  );
}
