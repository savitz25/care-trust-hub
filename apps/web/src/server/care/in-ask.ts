import snapshot from "@/data/indiana-public-snapshot.json";

const CARE =
  /nursing home|nursing facilit|assisted living|residential care|comprehensive care|long[- ]term care|hospice|home health|senior|inspection|survey|enforcement|complaint/i;
const CITY = /\b(indianapolis|fort wayne|evansville|south bend)\b/i;
const OTHER =
  /\b(wisconsin|maryland|connecticut|michigan|minnesota|nevada|tennessee|massachusetts|ohio|illinois)\b/i;

const source = (cls: string) => snapshot.sources.find((s) => s.class === cls)!;
const n = (value: number) => value.toLocaleString("en-US");

export function indianaIntent(q: string, stateCode?: string): boolean {
  if (stateCode && stateCode !== "IN" && !/\bindiana\b/i.test(q)) return false;
  return (
    /\bindiana\b|\bidoh\b/i.test(q) ||
    stateCode === "IN" ||
    (CITY.test(q) && CARE.test(q) && !OTHER.test(q))
  );
}

export function interpretIndianaAsk(q: string, stateCode?: string) {
  if (!indianaIntent(q, stateCode)) return null;
  // CCN -> Senior CMS lookup keeps precedence; bare six digits stay untyped.
  if (/\b(?:CMS\s*)?CCN\s*[:#]?\s*[A-Z0-9]{6}\b/i.test(q) || /^\s*\d{6}\s*$/.test(q)) return null;
  const answer = (
    message: string,
    coverage: "KNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "UNSUPPORTED",
  ) => ({
    message,
    alternatives: ["Open Indiana senior-care research at /indiana."],
    coverage,
  });
  if (
    /\b(best|safest|recommend(?:ed)?|most trustworthy|most trusted|top[- ]rated|highest[- ]rated|number one|trust score|aggregaterating|ratingvalue|paid ranking|sponsored ranking|report cards?)\b|#1\b/i.test(
      q,
    )
  )
    return answer(
      "SeniorTrustHub does not rank or recommend Indiana facilities. No provider winner is selected. Open /indiana.",
      "UNSUPPORTED",
    );
  if (/\b(enforcement|sanction|disciplin|suspend|revok|penalt|closure)\b/i.test(q))
    return answer(
      "Indiana Department of Health licenses and surveys these facilities, but a clean 2022–2026 provider-level state enforcement index was NOT_ACQUIRED. No adverse action was joined by name. Open /indiana.",
      "NOT_ACQUIRED",
    );
  if (/\b(inspections?|surveys?|deficienc|reports?)\b/i.test(q))
    return answer(
      "IDOH surveys comprehensive and residential care facilities and issues survey reports, but no clean statewide state-survey index was acquired (NOT_ACQUIRED). CMS certification surveys remain in the separate CMS profiles. Open /indiana.",
      "NOT_ACQUIRED",
    );
  if (/\bcomplaints?\b/i.test(q))
    return answer(
      "IDOH's Healthcare Facility Complaint Program accepts complaints about nursing homes, residential care, home health and hospice. Provider-level complaint rows were NOT_ACQUIRED; a complaint is not a violation. Open /indiana.",
      "NOT_ACQUIRED",
    );
  if (/assisted living/i.test(q))
    return answer(
      `Indiana licenses Residential Care facilities (${n(source("residential-care").rows)} in the IDOH Residential Care directory posted ${source("residential-care").postedToWeb}); "assisted living" is not the state license class name. Comprehensive Care facilities are listed separately. No combined count or facility winner is given. Open /indiana.`,
      "KNOWN",
    );
  const cls = /home health/i.test(q)
    ? "home-health-agency"
    : /hospice/i.test(q)
      ? "hospice"
      : /residential care/i.test(q)
        ? "residential-care"
        : /nursing|comprehensive care|long[- ]term care/i.test(q)
          ? "comprehensive-care"
          : null;
  if (!cls)
    return answer(
      "Indiana Department of Health publishes separate statewide directories for Comprehensive Care, Residential Care, Home Health Agency and Hospice licenses. Choose one class; there is no combined Indiana senior total. Open /indiana.",
      "KNOWN",
    );
  const s = source(cls);
  const beds =
    cls === "comprehensive-care"
      ? ` It lists ${n((s as { bedCapacity?: number }).bedCapacity ?? 0)} licensed beds.`
      : "";
  return answer(
    `The IDOH ${s.label} (posted ${s.postedToWeb}) has ${n(s.rows)} rows and ${n(s.distinctLicenses)} distinct license numbers.${beds} No CCN is printed, so these are not bridged to CMS profiles. Verify current status with IDOH. Open /indiana.`,
    "KNOWN",
  );
}
