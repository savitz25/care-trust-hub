import "server-only";
import { Pool } from "pg";
import { getCareDatabasePoolConfig } from "./database-config";

declare global {
  var careDatabasePool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool(
    getCareDatabasePoolConfig({
      CARE_DATABASE_URL: process.env.CARE_DATABASE_URL,
      CARE_DATABASE_SSL: process.env.CARE_DATABASE_SSL,
      CARE_DATABASE_SSL_CA: process.env.CARE_DATABASE_SSL_CA,
    }),
  );
}

export function getCareDatabasePool(): Pool {
  if (!globalThis.careDatabasePool) globalThis.careDatabasePool = createPool();
  return globalThis.careDatabasePool;
}

export async function closeCareDatabasePool(): Promise<void> {
  if (globalThis.careDatabasePool) {
    await globalThis.careDatabasePool.end();
    globalThis.careDatabasePool = undefined;
  }
}
