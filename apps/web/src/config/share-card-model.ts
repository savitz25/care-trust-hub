export type SeniorShareCardKind = "fallback" | "entity";

export type SeniorShareCardModel = {
  kind: SeniorShareCardKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  fact?: string;
};

export function truncateShareText(value: string, maxChars: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function seniorEntityShareModel(input: {
  name: string;
  city?: string | null;
  state?: string | null;
  careType?: string | null;
}): SeniorShareCardModel {
  const location = [input.city, input.state].filter(Boolean).join(", ");
  return {
    kind: "entity",
    eyebrow: truncateShareText((input.careType || "SENIOR CARE RESEARCH").toUpperCase(), 40),
    title: truncateShareText(input.name || "", 48) || "Senior care facility",
    subtitle: location ? truncateShareText(location, 52) : undefined,
    fact: "CMS · staffing · inspections · ownership research",
  };
}
