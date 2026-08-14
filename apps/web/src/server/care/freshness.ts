import { brand } from "@/config/brand";
import type { CareFreshness } from "./types";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function formatEvidenceDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "Not documented by CMS";
}

export function formatFreshnessLabels(freshness: CareFreshness) {
  return {
    sourceUpdated: `CMS source updated ${formatEvidenceDate(freshness.sourceModifiedAt)}`,
    retrieved: `Retrieved by ${brand.networkName} ${formatEvidenceDate(freshness.retrievedAt)}`,
  };
}

export function formatMissingCmsValue(value: string | number | null): string {
  return value === null ? "Not available in this CMS release" : String(value);
}
