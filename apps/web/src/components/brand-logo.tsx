import Link from "next/link";
import { SeniorNetworkMark } from "@/components/senior-network-mark";
import { brand } from "@/config/brand";

export function BrandLogo({ href = "/", inverted = false }: { href?: string; inverted?: boolean }) {
  const inner = (
    <>
      <SeniorNetworkMark className="th-logo-mark" />
      <span className="th-logo-wordmark">
        <span className="th-logo-name">SENIOR</span>
        <span className="th-logo-hub">TRUST HUB</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <div className={`th-logo-lockup${inverted ? " th-logo-lockup-on-dark" : ""}`}>{inner}</div>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={`th-logo-lockup${inverted ? " th-logo-lockup-on-dark" : ""}`}
      aria-label={`${brand.publicName} home`}
    >
      {inner}
    </Link>
  );
}
