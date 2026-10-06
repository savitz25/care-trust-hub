import snapshot from "../../../../../data/nebraska/ne-sen-001/dhhs-roster-snapshot.json";

const fmt = (value: number) => value.toLocaleString("en-US");

export function interpretNebraskaAsk(q: string, stateCode?: string) {
  const explicit = /\bnebraska\b/i.test(q) || /\bin ne\b/i.test(q);
  if (/\bnevada\b/i.test(q) && !explicit) return null;
  if (stateCode && stateCode !== "NE" && !explicit) return null;
  if (!explicit && stateCode !== "NE") return null;
  const stripped = q.replace(/\bnebraska\b|\bin ne\b/gi, " ");
  if (/\b(iowa|kansas|utah|arkansas|oklahoma|missouri|nevada)\b/i.test(stripped)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Nebraska senior-care research at /nebraska."],
    coverage,
  });
  const geography = /\b(omaha|lincoln)\b/i.test(q)
    ? " Omaha and Lincoln are geography only. No city route is published."
    : "";
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue)\b|#1\b/i.test(
      q,
    )
  ) {
    return answer(
      "SeniorTrustHub does not rank Nebraska facilities and does not publish a Trust Score.",
      "UNSUPPORTED",
    );
  }
  if (/\b(inspections?|surveys?|deficienc|complaints?|enforcement|sanctions?|orders?)\b/i.test(q)) {
    return answer(
      `Nebraska inspection, complaint, deficiency, and enforcement records were NOT_ACQUIRED. A complaint is not a finding.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/home health|hospice/i.test(q)) {
    return answer(
      `Nebraska home health and hospice rosters were NOT_ACQUIRED. They are not on the DHHS facility roster index retrieved ${snapshot.rosterIndexRetrievedAt}.${geography}`,
      "NOT_ACQUIRED",
    );
  }
  if (/adult day/i.test(q)) {
    return answer(
      `The DHHS adult day roster updated ${snapshot.adultDay.rosterUpdated} prints ${fmt(snapshot.adultDay.totalLicensed)} total licensed. That count is not assisted living or long-term care. Licenses expire ${snapshot.adultDay.licenseExpirationRule}.${geography}`,
      "KNOWN",
    );
  }
  if (/assisted living|\balf\b/i.test(q)) {
    return answer(
      `The DHHS assisted living roster updated ${snapshot.assistedLiving.rosterUpdated} prints ${fmt(snapshot.assistedLiving.totalLicensedFacilities)} licensed facilities and ${fmt(snapshot.assistedLiving.totalLicensedBeds)} licensed beds. Beds are not facilities. This count is not added to long-term care.${geography}`,
      "KNOWN",
    );
  }
  if (/nursing|long[- ]term care|\bltc\b|skilled nursing/i.test(q)) {
    const rows = snapshot.nursing.classes
      .map((row) => `${row.label} ${fmt(row.facilities)} facilities / ${fmt(row.beds)} beds`)
      .join("; ");
    return answer(
      `The DHHS long-term care roster updated ${snapshot.nursing.rosterUpdated} prints ${fmt(snapshot.nursing.printedTotalFacilities)} facilities and ${fmt(snapshot.nursing.printedTotalBeds)} beds. Class rows: ${rows}. The printed total is not added to assisted living. Medicare or Medicaid status is not the state license.${geography}`,
      "KNOWN",
    );
  }
  if (/\b(how many|total|combined|all)\b/i.test(q)) {
    return answer(
      `Assisted living (${fmt(snapshot.assistedLiving.totalLicensedFacilities)}), long-term care (${fmt(snapshot.nursing.printedTotalFacilities)}), and adult day (${fmt(snapshot.adultDay.totalLicensed)}) cannot be combined into one Nebraska senior census. Home health and hospice remain NOT_ACQUIRED.${geography}`,
      "UNSUPPORTED",
    );
  }
  return answer(
    `DHHS rosters updated ${snapshot.assistedLiving.rosterUpdated} print assisted living ${fmt(snapshot.assistedLiving.totalLicensedFacilities)} facilities, long-term care ${fmt(snapshot.nursing.printedTotalFacilities)} facilities, and adult day ${fmt(snapshot.adultDay.totalLicensed)}. Those classes are not added. Home health and hospice were NOT_ACQUIRED.${geography}`,
    "PARTIAL",
  );
}
