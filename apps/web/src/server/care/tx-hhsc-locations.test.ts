import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const previewEnv = { NODE_ENV: "development", CARE_TX_HHSC_SIMULATE_BATCH: "true" };

describe("certified Texas HHSC regulated-location publication gate", () => {
  it("fails closed and limits local simulation to development", async () => {
    const m = await import("./tx-hhsc-locations");
    expect(m.txHhscGate({})).toBe("off");
    expect(m.txHhscGate({ NODE_ENV: "production", CARE_TX_HHSC_SIMULATE_BATCH: "true" })).toBe(
      "off",
    );
    expect(m.txHhscGate(previewEnv)).toBe("local-preview");
    expect(
      m.txHhscGate({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_TX_HHSC_LOCATION_BATCH: m.TX_HHSC_BATCH,
      }),
    ).toBe("live");
    expect(await m.loadTxHhscLocations({})).toEqual([]);
  });

  it("simulates exactly 1840 unique locations and 1786 license observations without organizations", async () => {
    const m = await import("./tx-hhsc-locations");
    const rows = await m.loadTxHhscLocations(previewEnv);
    expect(rows).toHaveLength(1840);
    expect(rows.filter((r) => r.provider_class === "TX_ICF_IID")).toHaveLength(708);
    expect(rows.filter((r) => r.provider_class === "TX_DAHS")).toHaveLength(389);
    expect(rows.filter((r) => r.provider_class === "TX_DAHS_ISS_ONLY")).toHaveLength(743);
    expect(rows.filter((r) => r.license_number)).toHaveLength(1786);
    expect(new Set(rows.map((r) => r.namespaced_key)).size).toBe(1840);
    expect(rows.find((r) => r.facility_id === "112184")).toBeUndefined();
    expect(rows.every((r) => !m.txHhscHref(r).startsWith("/facility/"))).toBe(true);
  });

  it("keeps numeric IDs scoped to Texas class and never resolves a bare CMS identifier", async () => {
    const m = await import("./tx-hhsc-locations");
    const rows = await m.loadTxHhscLocations(previewEnv);
    const id = rows[0].facility_id;
    const found = m.searchTxHhscLocations(rows, { q: id });
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0].namespaced_key).toBe(`TX|HHSC|${rows[0].provider_class}|${id}`);
    expect(m.searchTxHhscLocations(rows, { q: `CMS:${id}` }).count).toBe(0);
    expect(m.validateTxHhscBatch([...rows, rows[0]])).toBe(false);
  });

  it("preserves class, geography, status, and absent license facts in search and Ask", async () => {
    const m = await import("./tx-hhsc-locations");
    const rows = await m.loadTxHhscLocations(previewEnv);
    const noLicense = rows.find((r) => !r.license_number)!;
    expect(
      m.searchTxHhscLocations(rows, {
        q: noLicense.facility_id,
        providerClass: noLicense.provider_class,
      }).rows[0].license_number,
    ).toBeNull();
    expect(m.searchTxHhscLocations(rows, { providerClass: "TX_DAHS" }).count).toBe(389);
    expect(m.searchTxHhscLocations(rows, { providerClass: "TX_DAHS_ISS_ONLY" }).count).toBe(743);
    expect(
      m
        .searchTxHhscLocations(rows, { city: rows[0].city! })
        .rows.every((r) => r.city?.toLowerCase() === rows[0].city?.toLowerCase()),
    ).toBe(true);
    expect(m.isTxHhscAskQuery("Texas ICF/IID regulated providers")).toBe(true);
    expect(m.isTxHhscAskQuery("CMS CCN 105502")).toBe(false);
    expect(m.txHhscAskSearch("Texas ICF/IID Facility ID 003868")).toEqual({
      providerClass: "TX_ICF_IID",
      q: "003868",
    });
  });
});
