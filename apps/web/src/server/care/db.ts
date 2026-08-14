import "server-only";
import { Pool } from "pg";

declare global {
  var careDatabasePool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.CARE_DATABASE_URL;
  if (!connectionString) throw new Error("CARE_DATABASE_URL is required for server database reads");
  const sslMode = process.env.CARE_DATABASE_SSL ?? "verify-full";
  if (!new Set(["verify-full", "require", "disable"]).has(sslMode)) {
    throw new Error("CARE_DATABASE_SSL must be verify-full, require, or disable");
  }
  return new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ssl: sslMode === "disable" ? false : { rejectUnauthorized: sslMode === "verify-full" },
  });
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
