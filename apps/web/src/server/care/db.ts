import "server-only";
import { Pool } from "pg";
import { classifyDatabaseError, getCareDatabasePoolConfig } from "./database-config";

declare global {
  var careDatabasePool: Pool | undefined;
}

function installTransientRetry(pool: Pool): Pool {
  const originalQuery = pool.query.bind(pool) as Pool["query"];
  const wrapped = ((...args: unknown[]) => {
    const attempt = () => (originalQuery as (...inner: unknown[]) => Promise<unknown>)(...args);
    return attempt().catch((error: unknown) => {
      const classified = classifyDatabaseError(error);
      if (!classified.retryable) throw error;
      console.warn(JSON.stringify({ event: classified.code, retry: true }));
      return attempt();
    });
  }) as Pool["query"];
  pool.query = wrapped;
  return pool;
}

function createPool(): Pool {
  const { inspection, ...config } = getCareDatabasePoolConfig({
    CARE_DATABASE_URL: process.env.CARE_DATABASE_URL,
    CARE_DATABASE_POOLER_URL: process.env.CARE_DATABASE_POOLER_URL,
    CARE_DATABASE_POOL_MODE: process.env.CARE_DATABASE_POOL_MODE,
    CARE_DATABASE_POOL_MAX: process.env.CARE_DATABASE_POOL_MAX,
    CARE_DATABASE_SSL: process.env.CARE_DATABASE_SSL,
    CARE_DATABASE_SSL_CA: process.env.CARE_DATABASE_SSL_CA,
  });
  void inspection;
  return installTransientRetry(new Pool(config));
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

export function resetCareDatabasePoolForTests(): void {
  globalThis.careDatabasePool = undefined;
}
