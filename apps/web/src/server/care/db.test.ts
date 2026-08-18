import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./database-config", () => ({
  getCareDatabasePoolConfig: () => ({
    connectionString: "postgresql://user:secret@example.test:5432/care",
    max: 1,
    ssl: false,
    inspection: { endpointKind: "other" },
  }),
  classifyDatabaseError: () => ({ code: "DB_OTHER", retryable: false }),
}));

describe("care database pool singleton", () => {
  beforeEach(async () => {
    const { closeCareDatabasePool } = await import("./db");
    await closeCareDatabasePool();
  });

  it("reuses one process-global pool instead of creating a pool per call", async () => {
    const { getCareDatabasePool } = await import("./db");
    const first = getCareDatabasePool();
    const second = getCareDatabasePool();
    expect(first).toBe(second);
    await first.end();
  });
});
