import "server-only";
import { assertNcIntelligence, NC_PUBLIC_SNAPSHOT, type NcPublicSnapshot } from "@care/domain";

export function getNcIntelligence(): NcPublicSnapshot {
  return assertNcIntelligence(NC_PUBLIC_SNAPSHOT);
}
