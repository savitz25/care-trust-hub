import { getCareDatabasePool } from "@/server/care/db";
import { postgresAckStore } from "@/server/my-trusthub/ack-store";
import { productionParentGate } from "@/server/my-trusthub/parent-adapter";
import { seniorProfileReader } from "@/server/my-trusthub/publication-server";
import type { AssertionKey, NonceStore } from "@/server/my-trusthub/senior-assertion";
import { handleSeniorSource } from "@/server/my-trusthub/source-callback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-instance replay guard, as on Lender. Assertions live 30 seconds.
const seen = new Map<string, number>();
const nonces: NonceStore = {
  async claim(key, expiresAt) {
    const now = Date.now();
    for (const [id, exp] of seen) if (exp <= now) seen.delete(id);
    if (seen.has(key)) return false;
    seen.set(key, expiresAt);
    return true;
  },
};

function askVerifyKey(): AssertionKey | null {
  const kid = process.env.MY_TRUSTHUB_V23_ASK_KEY_ID?.trim() ?? "";
  const pem = process.env.MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid) || !pem.includes("PUBLIC KEY")) return null;
  return { kid, pem };
}

/** Signed source callback from My TrustHub. Unavailable (503) while the gate is
 * closed or Ask's verification key is not configured; it initiates nothing and
 * never calls Ask. */
export async function POST(request: Request) {
  const open = productionParentGate().enabled;
  return handleSeniorSource(request, {
    reader: seniorProfileReader,
    key: open ? askVerifyKey() : null,
    nonces,
    acks: open
      ? postgresAckStore(
          async (text, params) => (await getCareDatabasePool().query(text, params)).rows,
        )
      : null,
  });
}
