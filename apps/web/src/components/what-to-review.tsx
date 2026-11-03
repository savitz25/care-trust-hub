import type { ReactNode } from "react";
import type {
  CareChainIntelligence,
  CareOwnershipIntelligence,
  CareProviderDetail,
  CareRegulatoryIntelligence,
  CareStaffingIntelligence,
} from "@/server/care/types";

export function WhatToReview({
  provider,
  staffing,
  regulatory,
  ownership,
  chain,
}: {
  provider: CareProviderDetail;
  staffing?: CareStaffingIntelligence;
  regulatory?: CareRegulatoryIntelligence;
  ownership?: CareOwnershipIntelligence;
  chain?: CareChainIntelligence;
}) {
  const standard = regulatory?.inspections.find(
    (item) => /standard|health/i.test(item.surveyType) && !/complaint|fire/i.test(item.surveyType),
  );
  const change = ownership?.changes[0];
  const penalty = regulatory?.penalties[0];
  const cards = [
    staffing?.latest && {
      key: "staffing",
      title: "Staffing",
      href: "#staffing",
      body: (
        <>
          <p>
            CMS publishes a{" "}
            {provider.ratings.staffing === null
              ? "staffing rating that is not reported"
              : `${provider.ratings.staffing}-star staffing rating`}{" "}
            for this facility.
          </p>
          {staffing.latest.rnHprd != null ? (
            <p>
              RN staffing was {staffing.latest.rnHprd.toFixed(2)} hours per resident day in{" "}
              {staffing.latest.quarter}, calculated from CMS PBJ records.
            </p>
          ) : null}
        </>
      ),
    },
    standard && {
      key: "inspections",
      title: "Inspections",
      href: "#inspections",
      body: (
        <p>
          The latest standard inspection on{" "}
          {new Date(`${standard.surveyDate}T00:00:00Z`).toLocaleDateString("en-US", {
            dateStyle: "medium",
            timeZone: "UTC",
          })}{" "}
          cited {standard.findings.length} deficiencies.
        </p>
      ),
    },
    ownership && {
      key: "ownership",
      title: "Ownership",
      href: "#ownership",
      body: (
        <>
          <p>
            CMS-published records list {ownership.totalPartyCount} ownership or control parties.
          </p>
          {change && (
            <p>
              CMS records show an ownership change effective{" "}
              {new Date(`${change.effectiveDate}T00:00:00Z`).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
              .
            </p>
          )}
        </>
      ),
    },
    chain && {
      key: "chain",
      title: "Chain context",
      href: "#chain",
      body: (
        <p>
          CMS groups this facility with a chain
          {chain.current.facilityCount > 0 || chain.current.stateCount > 0
            ? ` covering ${[
                chain.current.facilityCount > 0
                  ? `${chain.current.facilityCount} facilities`
                  : null,
                chain.current.stateCount > 0
                  ? `${chain.current.stateCount} states or territories`
                  : null,
              ]
                .filter(Boolean)
                .join(" across ")}`
            : ""}
          .
        </p>
      ),
    },
  ].filter(Boolean) as Array<{ key: string; title: string; href: string; body: ReactNode }>;
  const showPenalty = Boolean(
    penalty &&
      ((penalty.penaltyType === "Fine" && penalty.fineAmount) || penalty.paymentDenialDays),
  );
  if (cards.length === 0 && !showPenalty) return null;
  return (
    <section className="what-to-review" aria-labelledby="what-to-review-title">
      <div className="section-heading">
        <p className="eyebrow">Decision guide</p>
        <h2 id="what-to-review-title">What to review</h2>
        <p>
          Factual evidence to examine before you decide. These summaries are not a score or
          recommendation.
        </p>
      </div>
      <div className="what-to-review__grid">
        {cards.map((card) => (
          <article key={card.key}>
            <h3>{card.title}</h3>
            {card.body}
            <a href={card.href}>
              View{" "}
              {card.key === "chain"
                ? "chain"
                : card.key === "inspections"
                  ? "inspection"
                  : card.key}{" "}
              evidence <span aria-hidden="true">→</span>
            </a>
          </article>
        ))}
      </div>
      {showPenalty && penalty ? (
        <div className="what-to-review__enforcement">
          <strong>Enforcement record</strong>
          <p>
            {penalty.penaltyType === "Fine" && penalty.fineAmount
              ? `CMS records show a $${Number(penalty.fineAmount).toLocaleString("en-US")} fine in the loaded enforcement dataset.`
              : `CMS records show a ${penalty.paymentDenialDays}-day payment denial in the loaded enforcement dataset.`}
          </p>
          <a href="#penalties">View enforcement evidence →</a>
        </div>
      ) : null}
    </section>
  );
}
