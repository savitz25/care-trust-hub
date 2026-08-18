import { describe, expect, it } from "vitest";
import {
  classifyDatabaseError,
  getCareDatabasePoolConfig,
  inspectDatabaseEndpoint,
  resolveWebDatabaseUrl,
} from "./database-config";

const secret =
  "postgresql://postgres.abc:super-secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require";
const transaction =
  "postgresql://postgres.abc:super-secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const direct = "postgresql://postgres:super-secret@db.abc.supabase.co:5432/postgres";

describe("care database connection configuration", () => {
  it("classifies Supabase session, transaction, and direct endpoints without exposing secrets", () => {
    expect(inspectDatabaseEndpoint(secret).kind).toBe("supabase_session_pooler");
    expect(inspectDatabaseEndpoint(transaction).kind).toBe("supabase_transaction_pooler");
    expect(inspectDatabaseEndpoint(direct).kind).toBe("supabase_direct");
    const resolved = resolveWebDatabaseUrl({ CARE_DATABASE_URL: secret });
    expect(resolved.inspection.rewrittenToTransaction).toBe(true);
    expect(resolved.inspection.endpointKind).toBe("supabase_transaction_pooler");
    expect(resolved.inspection.effectivePort).toBe(6543);
    expect(JSON.stringify(resolved.inspection)).not.toMatch(/super-secret|postgres\.abc/i);
  });

  it("uses an explicit pooler URL and does not rewrite when mode is session", () => {
    expect(
      resolveWebDatabaseUrl({
        CARE_DATABASE_URL: secret,
        CARE_DATABASE_POOLER_URL: transaction,
      }).inspection.rewrittenToTransaction,
    ).toBe(false);
    expect(
      resolveWebDatabaseUrl({
        CARE_DATABASE_URL: secret,
        CARE_DATABASE_POOL_MODE: "session",
      }).inspection.effectivePort,
    ).toBe(5432);
  });

  it("defaults to one reusable connection and rejects oversized pools", () => {
    const config = getCareDatabasePoolConfig({
      CARE_DATABASE_URL: secret,
      CARE_DATABASE_SSL: "require",
    });
    expect(config.max).toBe(1);
    expect(config.idleTimeoutMillis).toBe(5_000);
    expect(config.connectionTimeoutMillis).toBe(4_000);
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.connectionString).toContain(":6543/");
    expect(() =>
      getCareDatabasePoolConfig({ CARE_DATABASE_URL: secret, CARE_DATABASE_POOL_MAX: "8" }),
    ).toThrow(/1 to 2/);
  });

  it("requires TLS without CA verification for PostgreSQL require mode", () => {
    const config = getCareDatabasePoolConfig({
      CARE_DATABASE_URL: "postgresql://user:secret@example.test:5432/care?sslmode=verify-full",
      CARE_DATABASE_SSL: "require",
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("keeps verify-full certificate verification and supports secure CA input", () => {
    const config = getCareDatabasePoolConfig({
      CARE_DATABASE_URL: "postgresql://user:secret@example.test:5432/care",
      CARE_DATABASE_SSL: "verify-full",
      CARE_DATABASE_SSL_CA: "test-ca-material",
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: "test-ca-material" });
  });

  it("fails closed for an invalid SSL mode", () => {
    expect(() =>
      getCareDatabasePoolConfig({
        CARE_DATABASE_URL: "postgresql://user:secret@example.test:5432/care",
        CARE_DATABASE_SSL: "prefer",
      }),
    ).toThrow(/verify-full, require, or disable/);
  });

  it("classifies pool exhaustion as a bounded retryable error", () => {
    expect(classifyDatabaseError(new Error("EMAXCONNSESSION max clients reached"))).toEqual({
      code: "DB_POOL_EXHAUSTED",
      retryable: true,
    });
    expect(classifyDatabaseError(new Error("timeout expired"))).toMatchObject({
      code: "DB_CONNECT_TIMEOUT",
    });
  });
});
