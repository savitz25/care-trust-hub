import "server-only";
import { assertMnIntelligence, MN_PUBLIC_SNAPSHOT, type MnPublicSnapshot } from "@care/domain";
import lists from "@/data/minnesota-facility-lists.json";

export type MnFacilityLists = typeof lists;

export function getMnIntelligence(): MnPublicSnapshot {
  return assertMnIntelligence(MN_PUBLIC_SNAPSHOT);
}

/** MDH directory rows (no administrator names, phones, emails, or street addresses) for the statewide page. Server-only. */
export function getMnFacilityLists(): MnFacilityLists {
  if (lists.fingerprint !== MN_PUBLIC_SNAPSHOT.fingerprint) {
    throw new Error("Minnesota facility lists drifted from the accepted snapshot");
  }
  return lists;
}
