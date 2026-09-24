import "server-only";
import { assertMaIntelligence, MA_PUBLIC_SNAPSHOT, type MaPublicSnapshot } from "@care/domain";
import lists from "@/data/massachusetts-facility-lists.json";

export type MaFacilityLists = typeof lists;

export function getMaIntelligence(): MaPublicSnapshot {
  return assertMaIntelligence(MA_PUBLIC_SNAPSHOT);
}

/** Sanitized DPH and AGE rows for the statewide page. Server-only; not sent to search. */
export function getMaFacilityLists(): MaFacilityLists {
  if (lists.fingerprint !== MA_PUBLIC_SNAPSHOT.fingerprint) {
    throw new Error("Massachusetts facility lists drifted from the accepted snapshot");
  }
  return lists;
}
