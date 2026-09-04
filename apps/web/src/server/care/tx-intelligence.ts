import "server-only";
import { assertTxIntelligence, TX_PUBLIC_SNAPSHOT, type TxPublicSnapshot } from "@care/domain";

export function getTxIntelligence(): TxPublicSnapshot {
  return assertTxIntelligence(TX_PUBLIC_SNAPSHOT);
}
