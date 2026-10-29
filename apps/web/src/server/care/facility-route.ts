import "server-only";
import { getProviderByCcnForPage } from "./cached-repository";

/**
 * Resolve a public facility route only after checking the CMS identifier's
 * path syntax. Repository and database errors intentionally propagate.
 */
export async function getFacilityRouteProvider(ccn: string) {
  const normalized = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized)) return null;
  return getProviderByCcnForPage(normalized);
}
