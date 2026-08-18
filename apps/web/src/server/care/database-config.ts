import type { PoolConfig } from "pg";

export type DatabaseEnvironment = {
  CARE_DATABASE_URL?: string;
  CARE_DATABASE_POOLER_URL?: string;
  CARE_DATABASE_POOL_MODE?: string;
  CARE_DATABASE_POOL_MAX?: string;
  CARE_DATABASE_SSL?: string;
  CARE_DATABASE_SSL_CA?: string;
};

export type DatabaseEndpointKind =
  | "supabase_session_pooler"
  | "supabase_transaction_pooler"
  | "supabase_direct"
  | "other";

export type DatabasePoolMode = "auto" | "session" | "transaction";

export interface DatabaseConnectionInspection {
  endpointKind: DatabaseEndpointKind;
  requestedPort: number | null;
  effectivePort: number | null;
  rewrittenToTransaction: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

const SSL_QUERY_PARAMETERS = ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert"];
const DEFAULT_POOL_MAX = 1;
const MAX_ALLOWED_POOL_MAX = 2;
const DEFAULT_IDLE_TIMEOUT_MS = 5_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 4_000;

function connectionStringWithoutSslParameters(connectionString: string): string {
  const url = new URL(connectionString);
  for (const parameter of SSL_QUERY_PARAMETERS) url.searchParams.delete(parameter);
  return url.toString();
}

function parsePoolMode(value: string | undefined): DatabasePoolMode {
  if (value === "session" || value === "transaction" || value === "auto") return value;
  if (value) throw new Error("CARE_DATABASE_POOL_MODE must be auto, session, or transaction");
  return "auto";
}

function parsePoolMax(value: string | undefined): number {
  if (!value) return DEFAULT_POOL_MAX;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_ALLOWED_POOL_MAX) {
    throw new Error(`CARE_DATABASE_POOL_MAX must be an integer from 1 to ${MAX_ALLOWED_POOL_MAX}`);
  }
  return parsed;
}

export function inspectDatabaseEndpoint(connectionString: string): {
  kind: DatabaseEndpointKind;
  port: number | null;
} {
  const url = new URL(connectionString);
  const port = url.port ? Number(url.port) : 5432;
  const host = url.hostname.toLowerCase();
  if (host.includes("pooler.supabase.com") && port === 6543) {
    return { kind: "supabase_transaction_pooler", port };
  }
  if (host.includes("pooler.supabase.com")) {
    return { kind: "supabase_session_pooler", port };
  }
  if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
    return { kind: "supabase_direct", port };
  }
  return { kind: "other", port };
}

export function resolveWebDatabaseUrl(
  environment: Pick<
    DatabaseEnvironment,
    "CARE_DATABASE_URL" | "CARE_DATABASE_POOLER_URL" | "CARE_DATABASE_POOL_MODE"
  >,
): {
  connectionString: string;
  inspection: Omit<
    DatabaseConnectionInspection,
    "maxConnections" | "idleTimeoutMillis" | "connectionTimeoutMillis"
  >;
} {
  const preferred = environment.CARE_DATABASE_POOLER_URL || environment.CARE_DATABASE_URL;
  if (!preferred) throw new Error("CARE_DATABASE_URL is required for server database reads");
  const mode = parsePoolMode(environment.CARE_DATABASE_POOL_MODE);
  const incoming = inspectDatabaseEndpoint(preferred);
  const url = new URL(preferred);
  let rewrittenToTransaction = false;
  if (
    mode !== "session" &&
    incoming.kind === "supabase_session_pooler" &&
    !environment.CARE_DATABASE_POOLER_URL
  ) {
    url.port = "6543";
    rewrittenToTransaction = true;
  }
  const resolved = url.toString();
  const effective = inspectDatabaseEndpoint(resolved);
  return {
    connectionString: resolved,
    inspection: {
      endpointKind: effective.kind,
      requestedPort: incoming.port,
      effectivePort: effective.port,
      rewrittenToTransaction,
    },
  };
}

export function classifyDatabaseError(error: unknown): {
  code: "DB_POOL_EXHAUSTED" | "DB_CONNECT_TIMEOUT" | "DB_OTHER";
  retryable: boolean;
} {
  const text =
    error instanceof Error
      ? `${error.message} ${"code" in error ? String(error.code) : ""}`
      : String(error);
  if (/EMAXCONNSESSION|max clients reached/i.test(text)) {
    return { code: "DB_POOL_EXHAUSTED", retryable: true };
  }
  if (/timeout|ECONNRESET|Connection terminated|remaining connection slots/i.test(text)) {
    return {
      code: "DB_CONNECT_TIMEOUT",
      retryable: /timeout|remaining connection slots/i.test(text),
    };
  }
  return { code: "DB_OTHER", retryable: false };
}

export function getCareDatabasePoolConfig(environment: DatabaseEnvironment): PoolConfig & {
  inspection: DatabaseConnectionInspection;
} {
  const resolved = resolveWebDatabaseUrl(environment);
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

  const maxConnections = parsePoolMax(environment.CARE_DATABASE_POOL_MAX);
  return {
    connectionString: connectionStringWithoutSslParameters(resolved.connectionString),
    max: maxConnections,
    connectionTimeoutMillis: DEFAULT_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
    allowExitOnIdle: true,
    ssl,
    inspection: {
      ...resolved.inspection,
      maxConnections,
      idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DEFAULT_CONNECT_TIMEOUT_MS,
    },
  };
}
