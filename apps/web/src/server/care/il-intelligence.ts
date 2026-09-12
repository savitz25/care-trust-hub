import "server-only";
import { assertIlIntelligence, IL_PUBLIC_SNAPSHOT, type IlPublicSnapshot } from "@care/domain";

export function getIlIntelligence(): IlPublicSnapshot {
  return assertIlIntelligence(IL_PUBLIC_SNAPSHOT);
}
