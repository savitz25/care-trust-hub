import snapshot from "@/data/west-virginia-public-snapshot.json";

const CITY = /\b(charleston|morgantown|huntington)\b/i;

export function westVirginiaIntent(q: string, stateCode?: string): boolean {
  const named = /\bwest virginia\b/i.test(q) || /\bin wv\b/i.test(q);
  if (stateCode && stateCode !== "WV" && !named) return false;
  return named;
}

export function interpretWestVirginiaAsk(q: string, stateCode?: string) {
  if (!westVirginiaIntent(q, stateCode)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open West Virginia senior-care research at /west-virginia."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Charleston, Morgantown, and Huntington are geography only. No city route is published."
    : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  ) {
    return answer(
      "SeniorTrustHub does not rank West Virginia facilities and does not publish a Trust Score.",
      "UNSUPPORTED",
    );
  }
  if (/\b(how many|number of|count of|total|census)\b/i.test(q) && /\b(senior|facilities|all classes|combined)\b/i.test(q)) {
    return answer(
      `West Virginia senior classes cannot be combined. Nursing homes, assisted living, home health, hospice, adult day, ICF/IID, residential board and care, and residential care communities were each NOT_ACQUIRED. Missing is not zero.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(surveys?|deficien)\b/i.test(q)) {
    return answer(
      `West Virginia survey and deficiency counts were NOT_ACQUIRED. A survey is not enforcement. A survey with no deficiencies would still be a survey observation.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\bcomplaints?\b/i.test(q)) {
    return answer(
      `West Virginia complaint-investigation counts were NOT_ACQUIRED. A complaint investigation is not a violation.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(enforcement|sanction|penalt|revok)\b/i.test(q)) {
    return answer(
      `West Virginia enforcement counts were NOT_ACQUIRED. Name-only adverse joins: ${snapshot.nameOnlyAdverseJoins}.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(cms|medicaid|medicare)\b/i.test(q)) {
    return answer(
      `CMS certification for West Virginia was NOT_ACQUIRED. CMS stays a federal overlay. No state-to-CMS bridge was made.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\badministrator\b/i.test(q)) {
    return answer(
      `An administrator roster was NOT_ACQUIRED. An administrator is not a facility.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/adult day/i.test(q)) {
    return answer(
      `A West Virginia medical adult day care roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/assisted living/i.test(q)) {
    return answer(
      `A West Virginia assisted living residence roster was NOT_ACQUIRED. It is not a nursing home and not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/home health/i.test(q)) {
    return answer(
      `A West Virginia home health agency roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/hospice/i.test(q)) {
    return answer(
      `A West Virginia hospice roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/icf|intellectually disabled|iid/i.test(q)) {
    return answer(
      `A West Virginia ICF/IID roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/residential care|board and care/i.test(q)) {
    return answer(
      `Residential board and care and residential care community rosters were NOT_ACQUIRED. They are not assisted living and not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/nursing/i.test(q)) {
    return answer(
      `A West Virginia nursing-home roster was NOT_ACQUIRED. CMS certification was not downloaded and was not bridged to a state roster.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  return answer(
    `The OHFLAC facility lookup is a server-side search, not a downloaded roster. Each senior class was NOT_ACQUIRED. The classes cannot be combined. Missing is not zero.${geography}`,
    "NOT_ACQUIRED",
  );
}
