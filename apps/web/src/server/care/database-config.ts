import type { PoolConfig } from "pg";

type DatabaseEnvironment = {
  CARE_DATABASE_URL?: string;
  CARE_DATABASE_SSL?: string;
  CARE_DATABASE_SSL_CA?: string;
};

const SSL_QUERY_PARAMETERS = ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"];

function connectionStringWithoutSslParameters(connectionString: string): string {
  const url = new URL(connectionString);
  for (const parameter of SSL_QUERY_PARAMETERS) url.searchParams.delete(parameter);
  return url.toString();
}

export function getCareDatabasePoolConfig(environment: DatabaseEnvironment): PoolConfig {
  const connectionString = environment.CARE_DATABASE_URL;
  if (!connectionString) throw new Error("CARE_DATABASE_URL is required for server database reads");

  const sslMode = environment.CARE_DATABASE_SSL ?? "verify-full";
  if (!new Set(["verify-full", "require", "disable"]).has(sslMode)) {
    throw new Error("CARE_DATABASE_SSL must be verify-full, require, or disable");
  }

  const ssl =
    sslMode === "disable"
      ? false
      : sslMode === "require"
        ? { rejectUnauthorized: false }
        : {
            rejectUnauthorized: true,
            ...(environment.CARE_DATABASE_SSL_CA ? { ca: environment.CARE_DATABASE_SSL_CA } : {}),
          };

  return {
    connectionString: connectionStringWithoutSslParameters(connectionString),
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ssl,
  };
}
