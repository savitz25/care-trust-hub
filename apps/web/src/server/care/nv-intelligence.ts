import "server-only";
import { assertNvIntelligence, NV_PUBLIC_SNAPSHOT, type NvPublicSnapshot } from "@care/domain";
import lists from "@/data/nevada-facility-lists.json";

export type NvFacilityLists = typeof lists;

export function getNvIntelligence(): NvPublicSnapshot {
  return assertNvIntelligence(NV_PUBLIC_SNAPSHOT);
}

/** HCQC active-license rows (no contact names, phones, or street addresses) for the statewide page. Server-only. */
export function getNvFacilityLists(): NvFacilityLists {
  if (lists.fingerprint !== NV_PUBLIC_SNAPSHOT.fingerprint) {
    throw new Error("Nevada facility lists drifted from the accepted snapshot");
  }
  return lists;
}
