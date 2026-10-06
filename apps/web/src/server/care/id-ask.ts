import snapshot from "@/data/idaho-public-snapshot.json";

const CITY = /\b(boise|meridian|nampa|pocatello|idaho falls|twin falls|coeur d'alene)\b/i;

export function idahoIntent(q: string, stateCode?: string): boolean {
  const named = /\bidaho\b/i.test(q) || /\bin id\b/i.test(q);
  if (stateCode && stateCode !== "ID" && !named) return false;
  return named;
}

export function interpretIdahoAsk(q: string, stateCode?: string) {
  if (!idahoIntent(q, stateCode)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Idaho senior-care research at /idaho."],
    coverage,
  });
  const geography = CITY.test(q)
    ? " Boise and the other named Idaho cities are geography only. No city route is published."
    : "";
  const classes = snapshot.classes.map((row) => row.name.toLowerCase()).join(", ");
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  ) {
    return answer(
      "SeniorTrustHub does not rank Idaho facilities and does not publish a Trust Score.",
      "UNSUPPORTED",
    );
  }
  if (/\b(temporary|provisional)\b/i.test(q)) {
    return answer(
      `Temporary or provisional Idaho license counts were NOT_ACQUIRED. A temporary license is not a full license.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(beds?|capacity|slots?)\b/i.test(q)) {
    return answer(`Idaho licensed capacity was NOT_ACQUIRED.${geography}`, "NOT_ACQUIRED");
  }
  if (/\b(enforcement|sanction|penalt|revok)\b/i.test(q)) {
    return answer(
      `Idaho enforcement counts were NOT_ACQUIRED. Name-only adverse joins: ${snapshot.nameOnlyAdverseJoins}.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(surveys?|inspections?)\b/i.test(q)) {
    return answer(
      `Idaho survey and inspection counts were NOT_ACQUIRED. A survey is not a facility count and is not a finding. CMS certification was not downloaded.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\bcomplaints?\b/i.test(q)) {
    return answer(
      `Idaho complaint-investigation counts were NOT_ACQUIRED. A complaint investigation is not a violation.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(cms|medicaid|care compare)\b/i.test(q)) {
    return answer(
      `CMS certification and Medicaid participation for Idaho were NOT_ACQUIRED. CMS stays a federal overlay. No state-to-CMS bridge was made.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/certified family/i.test(q)) {
    return answer(
      `A Certified Family Home roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/adult day/i.test(q)) {
    return answer(
      `An Idaho adult-day roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/assisted living|\bralf\b/i.test(q)) {
    return answer(
      `A Residential Assisted Living Facility roster was NOT_ACQUIRED. The public list is a WebLink browser that was not downloaded. A browser is not a roster.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/home health/i.test(q)) {
    return answer(
      `An Idaho home-health roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/hospice/i.test(q)) {
    return answer(
      `An Idaho hospice roster was NOT_ACQUIRED. It is not part of a combined senior census.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/nursing/i.test(q)) {
    return answer(
      `An Idaho nursing-home roster was NOT_ACQUIRED. CMS certification was not downloaded and was not bridged to a state roster.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/\b(how many|total|census|combined)\b/i.test(q)) {
    return answer(
      `Idaho senior classes stay separate. State rosters were NOT_ACQUIRED for ${classes}. Those classes cannot be combined into one senior-facility census. A third-party magazine figure is not a state license count.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  return answer(
    `${snapshot.regulator} evidence is a facility-search limit, not a facility census. State rosters were NOT_ACQUIRED for ${classes}. The WebLink browser was not opened. Page chrome last updated ${snapshot.findFacilityPageChromeUpdated} is not a roster clock.${geography}`,
    "NOT_ACQUIRED",
  );
}
