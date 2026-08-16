import type { ReactNode } from "react";

export function PublicInformationPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="page-shell investigation-page">
      <article className="profile-section legal-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="home-hero__lede">{intro}</p>
        {children}
      </article>
    </div>
  );
}
