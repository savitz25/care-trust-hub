export type CmsRatingMetric =
  | "nh_overall"
  | "nh_staffing"
  | "nh_inspection"
  | "nh_quality"
  | "hh_qpc"
  | "experience";

/** CMS QPC permits half stars; NH and experience stars use whole-star source values. */
export function sourceRating(value: unknown, metric: CmsRatingMetric): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1 || value > 5) return null;
  return Number.isInteger(metric === "hh_qpc" ? value * 2 : value) ? value : null;
}
