import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const run = process.env.CARE_DATABASE_URL ? describe : describe.skip;
const timings: Record<string, number> = {};

async function timed<T>(key: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const result = await work();
  timings[key] = Math.round((performance.now() - started) * 100) / 100;
  return result;
}

run("real Provider Information read model", () => {
  afterAll(async () => {
    const { closeCareDatabasePool } = await import("./db");
    await closeCareDatabasePool();
    console.info("read-model timings (ms)", JSON.stringify(timings));
  });

  it("reads numeric and alphanumeric CCNs through the approved shape", async () => {
    const { getProviderByCcn } = await import("./repository");
    const numeric = await timed("numeric_ccn", () => getProviderByCcn("015009"));
    const alpha = await timed("alphanumeric_ccn", () => getProviderByCcn("01A193"));
    const anotherState = await getProviderByCcn("105001");
    const fiveStar = await getProviderByCcn("015010");
    const oneStar = await getProviderByCcn("015019");
    expect(numeric?.ccn).toBe("015009");
    expect(alpha?.ccn).toBe("01A193");
    expect(anotherState?.location.state).toBe("FL");
    expect(fiveStar?.ratings.overall).toBe(5);
    expect(oneStar?.ratings.overall).toBe(1);
    expect(JSON.stringify([numeric, alpha, anotherState, fiveStar, oneStar])).not.toContain(
      "raw_record",
    );
  });

  it("selects current/history/source deterministically and preserves null ratings", async () => {
    const { getProviderByCcn, getProviderHistoryMetadata, getProviderSourceDisclosure } =
      await import("./repository");
    const missing = await timed("current_snapshot", () => getProviderByCcn("015463"));
    const history = await timed("history", () => getProviderHistoryMetadata("015463"));
    const source = await timed("source_disclosure", () => getProviderSourceDisclosure("015463"));
    expect(missing?.ratings.overall).toBeNull();
    expect(history).toHaveLength(1);
    expect(source?.cmsDatasetIdentifier).toBe("4pq5-n9py");
    expect(source?.sourceRecordLocator).toContain("ccn:015463");
  });

  it("supports bounded state, name, city, ZIP, and PostGIS reads", async () => {
    const {
      getProviderByCcn,
      getProvidersByState,
      providersWithinRadius,
      searchProvidersDevelopmentOnly,
    } = await import("./repository");
    const reference = await getProviderByCcn("015009");
    expect(reference).not.toBeNull();
    const state = await timed("state", () => getProvidersByState(reference!.location.state, 25));
    const name = await timed("name", () =>
      searchProvidersDevelopmentOnly({ query: reference!.providerName.slice(0, 8), limit: 25 }),
    );
    const city = await timed("city", () =>
      searchProvidersDevelopmentOnly({ city: reference!.location.city!, limit: 25 }),
    );
    const zip = await timed("zip", () =>
      searchProvidersDevelopmentOnly({ zip: reference!.location.zipCode!, limit: 25 }),
    );
    const radius = await timed("radius", () =>
      providersWithinRadius(reference!.location.latitude!, reference!.location.longitude!, 10, 25),
    );
    expect(state.length).toBeLessThanOrEqual(25);
    expect(name.some((provider) => provider.ccn === reference!.ccn)).toBe(true);
    expect(city.some((provider) => provider.ccn === reference!.ccn)).toBe(true);
    expect(zip.some((provider) => provider.ccn === reference!.ccn)).toBe(true);
    expect(radius.some((provider) => provider.ccn === reference!.ccn)).toBe(true);
  });
});
