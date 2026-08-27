"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { SwitchHubMenu } from "@/components/switch-hub-menu";

const PRIMARY_NAV = [
  { href: "/search", label: "Find care" },
  { href: "/florida", label: "Florida" },
  { href: "/compare", label: "Compare" },
] as const;

const DRAWER_NAV = [
  { href: "/search", label: "Find care" },
  { href: "/florida", label: "Florida" },
  { href: "/compare", label: "Compare" },
  { href: "/assisted-living", label: "Assisted living" },
  { href: "/research", label: "Research" },
  { href: "/tools/care-needs-navigator", label: "Care Needs Navigator" },
  { href: "/tools/senior-care-cost-planner", label: "Cost planner" },
  { href: "/tools/facility-tour-interview-builder", label: "Tour interview builder" },
  { href: "/methodology", label: "Methodology" },
  { href: "/independence", label: "Independence" },
] as const;

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="th-menu-glyph" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
      </svg>
    );
  }
  return (
    <svg className="th-menu-glyph" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M2 5.75A.75.75 0 012.75 5h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 5.75zm0 4.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm.75 3.5a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function navActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [pathForMenu, setPathForMenu] = useState(pathname);
  const drawerId = useId();
  const menuRef = useRef<HTMLButtonElement>(null);

  if (pathname !== pathForMenu) {
    setPathForMenu(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header data-hub="senior" className="th-header">
        <div className="th-header-inner th-shell">
          <BrandLogo />
          <nav aria-label="Primary" className="th-header-nav">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                prefetch={false}
                href={item.href}
                className={`th-nav-link${navActive(item.href, pathname) ? " is-active" : ""}`}
                aria-current={navActive(item.href, pathname) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="th-header-actions">
            <Link href="/shortlist" prefetch={false} className="th-btn-primary">
              Shortlist
            </Link>
            <SwitchHubMenu />
          </div>
          <div className="th-header-mobile-actions">
            <button
              ref={menuRef}
              type="button"
              className="th-btn-icon"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={drawerId}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <>
          <button
            type="button"
            className="th-drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            id={drawerId}
            className="th-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="SeniorTrustHub menu"
          >
            <nav aria-label="Mobile" className="th-drawer-nav">
              <Link
                href="/shortlist"
                className="th-btn-primary th-drawer-cta"
                onClick={() => setOpen(false)}
              >
                Shortlist
              </Link>
              {DRAWER_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="th-drawer-link"
                  aria-current={navActive(item.href, pathname) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="th-drawer-network">
                <SwitchHubMenu variant="embedded" />
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
