import { assertNyIntelligence, NY_PUBLIC_SNAPSHOT, type NyPublicSnapshot } from "@care/domain";

export function getNyIntelligence(): NyPublicSnapshot {
  return assertNyIntelligence(NY_PUBLIC_SNAPSHOT);
}
