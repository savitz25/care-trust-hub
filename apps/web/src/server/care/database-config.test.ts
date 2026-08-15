import { describe, expect, it } from "vitest";
import { getCareDatabasePoolConfig } from "./database-config";

const url = "postgresql://user:secret@example.test:5432/care?sslmode=verify-full";

describe("care database SSL configuration", () => {
  it("requires TLS without CA verification for PostgreSQL require mode", () => {
    const config = getCareDatabasePoolConfig({
      CARE_DATABASE_URL: url,
      CARE_DATABASE_SSL: "require",
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config.connectionString).not.toContain("sslmode");
  });

  it("keeps verify-full certificate verification and supports secure CA input", () => {
    const config = getCareDatabasePoolConfig({
      CARE_DATABASE_URL: url,
      CARE_DATABASE_SSL: "verify-full",
      CARE_DATABASE_SSL_CA: "test-ca-material",
    });
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: "test-ca-material" });
  });

  it("fails closed for an invalid SSL mode", () => {
    expect(() =>
      getCareDatabasePoolConfig({ CARE_DATABASE_URL: url, CARE_DATABASE_SSL: "prefer" }),
    ).toThrow(/verify-full, require, or disable/);
  });

  it("retains the verifying default when CARE_DATABASE_SSL is unset", () => {
    expect(getCareDatabasePoolConfig({ CARE_DATABASE_URL: url }).ssl).toEqual({
      rejectUnauthorized: true,
    });
  });
});
