import { productionOrigin } from "@/config/deployment";
import { getCareDatabasePool } from "@/server/care/db";
import { postgresAckStore } from "@/server/my-trusthub/ack-store";
import { productionHandoffDeps, productionParentGate } from "@/server/my-trusthub/parent-adapter";
import { handleSeniorProfileSave } from "@/server/my-trusthub/profile-save-http";
import { seniorProfileReader } from "@/server/my-trusthub/publication-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Senior Save hand-off endpoint. The gate is read from the deployment
 * environment and is closed today, so this answers 503 and reads, builds,
 * signs and sends nothing. The signer, the transport to My TrustHub and the
 * acknowledgement store are only constructed when the gate is open. */
export function POST(request: Request) {
  const gate = productionParentGate();
  const signer = gate.enabled ? productionHandoffDeps() : { key: null, parent: null };
  return handleSeniorProfileSave(
    request,
    {
      gate,
      reader: seniorProfileReader,
      key: signer.key,
      parent: signer.parent,
      acks: gate.enabled
        ? postgresAckStore(
            async (text, params) => (await getCareDatabasePool().query(text, params)).rows,
          )
        : null,
      now: Date.now,
    },
    process.env.VERCEL_ENV === "production" ? productionOrigin.origin : new URL(request.url).origin,
  );
}
