import "server-only";
import {
  getNjCountySnapshot,
  isNjCountySlug,
  type NjCountyPublicSnapshot,
  type NjCountySlug,
} from "@care/domain";

export { isNjCountySlug, type NjCountySlug };

export function loadNjCountyIntelligence(slug: string): NjCountyPublicSnapshot | null {
  if (!isNjCountySlug(slug)) return null;
  return getNjCountySnapshot(slug);
}
