import "server-only";
import { assertTnIntelligence, TN_PUBLIC_SNAPSHOT, type TnPublicSnapshot } from "@care/domain";
import lists from "@/data/tennessee-facility-lists.json";

export type TnFacilityLists = typeof lists;

export function getTnIntelligence(): TnPublicSnapshot {
  return assertTnIntelligence(TN_PUBLIC_SNAPSHOT);
}

/** HFC report rows, county-list agencies, and facility actions for the statewide page. Server-only. */
export function getTnFacilityLists(): TnFacilityLists {
  if (lists.fingerprint !== TN_PUBLIC_SNAPSHOT.fingerprint) {
    throw new Error("Tennessee facility lists drifted from the accepted snapshot");
  }
  return lists;
}
