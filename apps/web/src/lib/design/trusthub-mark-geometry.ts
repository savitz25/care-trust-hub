/**
 * TRUSTHUB_VISUAL_STANDARD_V1 — canonical bracket + four-point mark geometry.
 */

export const TH_MARK_VIEWBOX = 36;
export const TH_MARK_BRACKET_STROKE_RATIO = 2.4 / 36;
export const TH_MARK_OUTER_DOT_R_RATIO = 2.5 / 36;
export const TH_MARK_CENTER_DOT_R_RATIO = 2.1 / 36;
export const TH_MARK_DOT_SPACING_RATIO = 7.8 / 36;
export const TH_MARK_CROSS_STROKE_RATIO = 1.2 / 36;

export const TH_MARK_CANONICAL_RULE =
  "The bracket-and-four-point TrustHub mark is immutable network geometry. Hub identity changes through accent color and wordmark, not through bracket thickness, proportions, dot geometry or spacing.";

export type ThMarkGeometryStatus =
  | "canonical"
  | "match"
  | "near_match"
  | "too_heavy"
  | "mild_heavy"
  | "architecture_outlier";

export const TH_MARK_HUB_STATUS: Record<
  "ask" | "move" | "lender" | "insurance" | "contractor" | "senior" | "investor",
  { status: ThMarkGeometryStatus; correctionRequired: boolean; note: string }
> = {
  ask: {
    status: "canonical",
    correctionRequired: false,
    note: "AskNetworkMark SVG is the reference stroke geometry.",
  },
  move: {
    status: "match",
    correctionRequired: false,
    note: "VISUAL-006 header uses canonical Ask geometry with Move orange.",
  },
  lender: {
    status: "match",
    correctionRequired: false,
    note: "VISUAL-004 re-exported from Ask canonical geometry.",
  },
  insurance: {
    status: "match",
    correctionRequired: false,
    note: "VISUAL-005 header uses canonical brackets.",
  },
  contractor: {
    status: "match",
    correctionRequired: false,
    note: "CONTRACTOR-BRAND-001 / VISUAL-007 canonical thin gold brackets.",
  },
  senior: {
    status: "match",
    correctionRequired: false,
    note: "VISUAL-008 re-exported from Ask canonical geometry with Senior plum brackets.",
  },
  investor: {
    status: "match",
    correctionRequired: false,
    note: "VISUAL-003 re-exported from Ask canonical geometry.",
  },
};
