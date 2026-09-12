import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  provider: vi.fn(),
  agency: vi.fn(),
  ownership: vi.fn(),
  regulatory: vi.fn(),
  clock: vi.fn(),
}));
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query: mocks.db }) }));
vi.mock("./repository", () => ({ getProviderByCcn: mocks.provider }));
vi.mock("./agency-search", () => ({
  searchCurrentAgencies: mocks.agency,
  getCurrentAgencySourceClock: mocks.clock,
  countCurrentAgencies: vi.fn(),
}));
vi.mock("./ownership-repository", () => ({ getProviderOwnershipIntelligence: mocks.ownership }));
vi.mock("./regulatory-repository", () => ({ getProviderRegulatoryIntelligence: mocks.regulatory }));
vi.mock("./feature-flags", () => ({
  isOwnershipIntelligenceEnabled: () => true,
  isInspectionIntelligenceEnabled: () => true,
}));
import { interpretSeniorAskQuery } from "./senior-ask-parse";
import {
  executeSeniorResearchQuery,
  executeSeniorRequest,
  executeSeniorResearchPlan,
} from "./senior-ask-execute";
import { AskResultView } from "@/app/ask/ask-result-view";
describe("R1-011 baseline reproductions", () => {
  it("unspecified ownership requires an identity before retrieval", () => {
    const q = interpretSeniorAskQuery("Who owns this nursing home?");
    expect(q.mode).toBe("fail_closed");
    expect(q.terminalState).toBe("NEEDS_CLARIFICATION");
  });
  for (const q of ["Has this nursing home been fined?", "Did this facility change owners?"])
    it(q, async () => {
      const r = await executeSeniorResearchQuery(q);
      expect(r.entities).toEqual([]);
      expect(r.failClosed).toBeDefined();
    });
  it("CCN miss has a usable official action", async () => {
    const r = await executeSeniorResearchQuery("CMS CCN 000000");
    const html = renderToStaticMarkup(createElement(AskResultView, { result: r }));
    expect(html).toContain("https://www.medicare.gov/care-compare/");
    expect(r.entities).toEqual([]);
  });
  it("Virginia assisted living navigates to state research", async () => {
    const r = await executeSeniorResearchQuery("assisted living in Virginia");
    const html = renderToStaticMarkup(createElement(AskResultView, { result: r }));
    expect(html).toContain('href="/virginia"');
    expect(html).not.toContain("q=Open%20Virginia");
  });
});

const fixtures = [
  { ccn: "T00001", providerName: "Harbor Nursing Center", city: "Austin", state: "TX" },
  { ccn: "T00002", providerName: "Sunrise Nursing Home", city: "Austin", state: "TX" },
  { ccn: "T00003", providerName: "Sunrise Nursing Home East", city: "Austin", state: "TX" },
  { ccn: "T00004", providerName: "Sunrise Nursing Home", city: "Tampa", state: "FL" },
];
const source = {
  sourceOrganization: "CMS",
  datasetName: "Fixture source",
  releaseIdentifier: "fixture-release",
  sourceModifiedAt: "2025-01-01",
  retrievedAt: "2025-02-01",
  providerIdentifier: "T00001",
};
const detail = (f: (typeof fixtures)[number]) => ({
  ...f,
  ownershipType: "For profit - Corporation",
  location: { city: f.city, state: f.state, zipCode: "00000" },
  ratings: { overall: 4, staffing: 3, healthInspection: 2, qualityMeasure: 4 },
  source: { freshness: { sourceModifiedAt: "2025-01-01", retrievedAt: "2025-02-01" } },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.provider.mockImplementation(async (ccn: string) => {
    const f = fixtures.find((x) => x.ccn === ccn);
    return f ? detail(f) : null;
  });
  mocks.agency.mockResolvedValue([]);
  mocks.clock.mockResolvedValue({
    sourceFamily: "CMS fixture directory",
    officialAsOf: "2025-01-01",
  });
  mocks.ownership.mockResolvedValue({ parties: [], changes: [], totalPartyCount: 0 });
  mocks.regulatory.mockResolvedValue({ penalties: [], inspections: [], deficiencies: [] });
  mocks.db.mockImplementation(async (sql: string, values: unknown[] = []) => {
    if (sql.includes("FROM current_snapshots")) {
      const text = values.find((v) => typeof v === "string" && v.startsWith("%")) as
        | string
        | undefined;
      let rows = fixtures.filter(
        (f) =>
          !text ||
          f.providerName
            .toUpperCase()
            .includes(text.slice(1, -1).replaceAll("\\", "").toUpperCase()),
      );
      if (sql.includes("state_code =")) {
        const state = values.find((v) => typeof v === "string" && /^[A-Z]{2}$/.test(v));
        if (state) rows = rows.filter((f) => f.state === state);
      }
      return {
        rows: rows.map((f) => ({
          ccn: f.ccn,
          provider_name: f.providerName,
          city: f.city,
          state_code: f.state,
          zip_code: "00000",
          county_name: "TRAVIS",
          overall_rating: 4,
          staffing_rating: 3,
          health_inspection_rating: 2,
          ownership_type: "For profit - Corporation",
          source_modified_at: new Date("2025-01-01"),
          release_key: "fixture-release",
        })),
      };
    }
    return {
      rows: [
        {
          dataset_key: "fixture",
          display_name: "Fixture CMS source",
          source_organization: "CMS",
          release_key: "fixture-release",
          content_sha256: "fixture",
          source_modified_at: new Date("2025-01-01"),
          retrieved_at: new Date("2025-02-01"),
        },
      ],
    };
  });
});
import { planSeniorRequest, seniorRequestParams } from "./senior-ask-request";
import { SENIOR_OFFICIAL_RECOVERY, validSeniorOfficialRecovery } from "./senior-recovery";
import { GET } from "@/app/api/ask/route";
describe("R1-011 identity/evidence behavioral contract", () => {
  for (const q of [
    "Who owns that facility?",
    "Who operates this provider?",
    "Has that facility been fined?",
    "Did this nursing home change owners?",
    "Inspections for this facility",
    "Deficiencies for this nursing home",
  ])
    it(q, async () => {
      const r = await executeSeniorResearchQuery(q);
      expect(r.query.terminalState).toBe("NEEDS_CLARIFICATION");
      expect(r.entities).toEqual([]);
      expect(mocks.db).not.toHaveBeenCalled();
      expect(mocks.ownership).not.toHaveBeenCalled();
      expect(mocks.regulatory).not.toHaveBeenCalled();
    });
  it("unique exact source name attaches only that CCN", async () => {
    const r = await executeSeniorResearchQuery("Who owns Harbor Nursing Center?");
    expect(r.entities.map((x) => x.ccn)).toEqual(["T00001"]);
    expect(mocks.ownership).toHaveBeenCalledWith("T00001");
    expect(r.facilityAnswer?.rows[0]?.label).toBe("CMS ownership category");
    expect(r.facilityAnswer?.rows[0]?.value).toBe("For profit - Corporation");
  });
  it("ambiguous name has bounded selection and no evidence assignment", async () => {
    const r = await executeSeniorResearchQuery("Who owns Sunrise?");
    expect(r.candidateSelection).toBe(true);
    expect(r.entities).toHaveLength(3);
    expect(r.entities.every((e) => e.evidence.length === 0 && e.selectionHref)).toBe(true);
    expect(mocks.ownership).not.toHaveBeenCalled();
  });
  it("selection resumes original ownership task with revalidated candidate", async () => {
    const first = await executeSeniorResearchQuery("Who owns Sunrise?");
    const href = first.entities[1]!.selectionHref!;
    const params = seniorRequestParams(new URL(href, "https://test.invalid").searchParams);
    const r = await executeSeniorRequest(params);
    expect(r.rawQuery).toBe("Who owns Sunrise?");
    expect(r.entities).toHaveLength(1);
    expect(mocks.ownership).toHaveBeenCalledWith(first.entities[1]!.ccn);
  });
  it("tampered selection cannot attach unrelated evidence", async () => {
    const r = await executeSeniorRequest({
      q: "Who owns Sunrise?",
      selected: "T00001",
      class: "nursing_home",
    });
    expect(r.entities).toEqual([]);
    expect(r.failClosed).toBeDefined();
    expect(mocks.ownership).not.toHaveBeenCalled();
  });
  it("provider entry cannot replace explicitly named subject", () => {
    expect(
      planSeniorRequest({ q: "Who owns Harbor Nursing Center?", provider: "Sunrise" }).query.mode,
    ).toBe("fail_closed");
  });
  it("identity-required form retains question and resolves exact CCN", async () => {
    const r = await executeSeniorRequest({ q: "Who owns this nursing home?", ccn: "T00001" });
    expect(r.rawQuery).toBe("Who owns this nursing home?");
    expect(r.entities[0]?.ccn).toBe("T00001");
    expect(mocks.ownership).toHaveBeenCalledWith("T00001");
  });
  it("source-backed relationships retain role and source without category-as-owner", async () => {
    mocks.ownership.mockResolvedValue({
      parties: [
        {
          kind: "organization",
          displayName: "Fixture Owner Co",
          roleText: "Indirect ownership",
          associationDate: "2020-01-01",
          source,
        },
        {
          kind: "individual",
          displayName: "Synthetic Person",
          roleText: "Manager",
          associationDate: null,
          source,
        },
      ],
      changes: [],
    });
    const r = await executeSeniorResearchQuery("Who owns CMS CCN T00001?");
    expect(r.facilityAnswer?.rows.map((x) => x.label)).toEqual([
      "CMS ownership category",
      "organization: Indirect ownership",
      "individual: Manager",
    ]);
    expect(r.facilityAnswer?.rows[1]?.sourceAsOf).toBe("2025-01-01");
  });
  it("empty CHOW is corpus absence, not never changed owners", async () => {
    const r = await executeSeniorResearchQuery("Did CMS CCN T00001 change owners?");
    expect(r.facilityAnswer?.summary).toMatch(/^No indexed CHOW event/);
    expect(r.facilityAnswer?.summary).not.toMatch(/never/);
  });
  it("CHOW keeps event timing separate from source clocks", async () => {
    mocks.ownership.mockResolvedValue({
      parties: [],
      changes: [
        {
          changeTypeText: "Ownership change",
          sellerName: "Synthetic Seller",
          buyerName: "Synthetic Buyer",
          effectiveDate: "2020-06-01",
          source,
        },
      ],
    });
    const r = await executeSeniorResearchQuery("Did CMS CCN T00001 change owners?");
    expect(r.facilityAnswer?.rows[0]?.date).toBe("2020-06-01");
    expect(r.facilityAnswer?.rows[0]?.sourceAsOf).toBe("2025-01-01");
  });
  it("empty penalties is corpus absence, not never fined", async () => {
    const r = await executeSeniorResearchQuery("Has CMS CCN T00001 been fined?");
    expect(r.facilityAnswer?.summary).toMatch(/^No indexed penalty record/);
    expect(mocks.regulatory).toHaveBeenCalledWith("T00001");
  });
  it("penalty source identity mismatch is unavailable, not evidence", async () => {
    mocks.regulatory.mockResolvedValue({
      penalties: [
        {
          penaltyType: "Fine",
          fineAmount: "100",
          penaltyDate: "2020-01-01",
          source: { ...source, providerIdentifier: "T00004" },
        },
      ],
    });
    const r = await executeSeniorResearchQuery("Has CMS CCN T00001 been fined?");
    expect(r.query.terminalState).toBe("SOURCE_UNAVAILABLE");
    expect(r.entities).toEqual([]);
  });
  it("labeled positive remains exact; bare token remains safe", async () => {
    expect((await executeSeniorResearchQuery("CMS CCN T00001")).entities.map((e) => e.ccn)).toEqual(
      ["T00001"],
    );
    expect(interpretSeniorAskQuery("T00001").mode).toBe("fail_closed");
  });
  it("exact miss never performs name retrieval", async () => {
    const r = await executeSeniorResearchQuery("CCN Z99999");
    expect(r.entities).toEqual([]);
    expect(mocks.db.mock.calls.some(([sql]) => String(sql).includes("ILIKE"))).toBe(false);
  });
  it("absent source is unavailable, not a valid exact miss", async () => {
    mocks.db.mockResolvedValue({ rows: [] });
    const r = await executeSeniorResearchQuery("CCN Z99999");
    expect(r.query.terminalState).toBe("SOURCE_UNAVAILABLE");
  });
  for (const cls of ["home_health", "hospice"])
    it(`${cls} does not inherit NH CHOW`, async () => {
      mocks.agency.mockResolvedValue([
        {
          ccn: "H00001",
          providerClass: cls,
          providerName: "Synthetic Agency",
          city: "Houston",
          state: "TX",
          href: "/home-health/fixture",
        },
      ]);
      const r = await executeSeniorRequest({ q: "Did CMS CCN H00001 change owners?", class: cls });
      expect(r.facilityAnswer?.status).toBe("UNSUPPORTED");
      expect(mocks.ownership).not.toHaveBeenCalled();
    });
  it("class choice retains Austin TX", () => {
    const q = planSeniorRequest({ q: "care in Austin Texas", class: "nursing_home" }).query;
    expect(q.mode).toBe("entity");
    expect(q.geography).toMatchObject({ type: "city", value: "AUSTIN", state: "TX" });
  });
  it("memory care cannot become NH via filter", () => {
    const q = planSeniorRequest({ q: "memory care in Florida", class: "nursing_home" }).query;
    expect(q.mode).toBe("fail_closed");
  });
  for (const [q, url] of [
    ["assisted living in New York", "/new-york"],
    ["assisted living in Arizona", "/arizona"],
    ["memory care in Florida", "/florida"],
  ])
    it(q, async () => {
      const r = await executeSeniorResearchQuery(q!);
      const html = renderToStaticMarkup(createElement(AskResultView, { result: r }));
      expect(html).toContain(`href="${url}"`);
      expect(r.entities).toEqual([]);
      expect(mocks.db).not.toHaveBeenCalled();
    });
  it("official destination is exact HTTPS CMS allowlist, no guessed CCN parameter", () => {
    expect(new URL(SENIOR_OFFICIAL_RECOVERY.url).hostname).toBe("www.medicare.gov");
    expect(validSeniorOfficialRecovery("https://evil.invalid/")).toBe(false);
    expect(validSeniorOfficialRecovery(SENIOR_OFFICIAL_RECOVERY.url + "?ccn=T00001")).toBe(false);
  });
  it("API and common boundary agree on requested CCN evidence", async () => {
    const q = "Has CMS CCN T00001 been fined?";
    const a = await executeSeniorResearchQuery(q);
    const response = await GET(
      new Request("https://test.invalid/api/ask?" + new URLSearchParams({ q })),
    );
    const b = await response.json();
    expect(b.query).toEqual(a.query);
    expect(b.facilityAnswer).toEqual(a.facilityAnswer);
  });
  it("structured missing identity cannot bypass guard", async () => {
    const r = await executeSeniorResearchPlan({
      mode: "evidence",
      facilityEvidence: "ownership",
      providerClass: "nursing_home",
      page: 1,
    });
    expect(r.query.terminalState).toBe("NEEDS_CLARIFICATION");
    expect(mocks.db).not.toHaveBeenCalled();
  });
});

describe("R1-011 additional boundary regressions", () => {
  it("a state word inside a provider name is not a location predicate", () => {
    const q = interpretSeniorAskQuery("Who owns Texas Nursing Center?");
    expect(q.identityQuery).toBe("Texas Nursing Center");
    expect(q.geography).toBeUndefined();
  });
  it("same exact name in different states requires selection", async () => {
    const r = await executeSeniorResearchQuery("Who owns Sunrise Nursing Home?");
    expect(r.candidateSelection).toBe(true);
    expect(mocks.ownership).not.toHaveBeenCalled();
  });
  it("evidence source failure is not absence", async () => {
    mocks.ownership.mockRejectedValueOnce(new Error("fixture source failure"));
    const r = await executeSeniorResearchQuery("Who owns CMS CCN T00001?");
    expect(r.query.terminalState).toBe("SOURCE_UNAVAILABLE");
    expect(r.facilityAnswer).toBeUndefined();
  });
  it("unlinked source deficiency remains evidence", async () => {
    mocks.regulatory.mockResolvedValueOnce({
      penalties: [],
      inspections: [],
      deficiencies: [{ tag: "F999", officialDescription: "Synthetic finding", source }],
    });
    const r = await executeSeniorResearchQuery("Deficiencies for CMS CCN T00001");
    expect(r.facilityAnswer?.rows[0]?.value).toBe("Synthetic finding");
  });
  it("evidence override cannot silently replace the question", () => {
    const q = planSeniorRequest({
      q: "Who owns CMS CCN T00001?",
      class: "nursing_home",
      evidence: "penalties",
    }).query;
    expect(q.mode).toBe("fail_closed");
  });
  it("profile-style exact context cannot be replaced with a selected candidate", async () => {
    const r = await executeSeniorRequest({ q: "Who owns CMS CCN T00001?", selected: "T00004" });
    expect(r.entities).toEqual([]);
    expect(mocks.ownership).not.toHaveBeenCalled();
  });
});

it("generic care waits for class then executes locality without a fake provider name", async () => {
  const before = await executeSeniorResearchQuery("care in Austin Texas");
  expect(before.query.clarification).toBe("provider_class");
  expect(before.entities).toEqual([]);
  expect(mocks.db).not.toHaveBeenCalled();
  const after = planSeniorRequest({ q: "care in Austin Texas", class: "nursing_home" }).query;
  expect(after.identityQuery).toBeUndefined();
  expect(after.mode).toBe("entity");
  expect(after.geography).toMatchObject({ type: "city", value: "AUSTIN", state: "TX" });
});

it("multiple CCNs cannot select the first provider for ownership", async () => {
  const r = await executeSeniorResearchQuery("Who owns CCN T00001 and CCN T00004?");
  expect(r.query.terminalState).toBe("NEEDS_CLARIFICATION");
  expect(mocks.db).not.toHaveBeenCalled();
});
it("explicit mixed provider classes cannot acquire NH evidence", async () => {
  const r = await executeSeniorResearchQuery("Ownership for nursing home and hospice CCN T00001");
  expect(r.query.terminalState).toBe("NEEDS_CLARIFICATION");
  expect(mocks.ownership).not.toHaveBeenCalled();
});

it("an exact evidence answer cannot silently ignore a rating cohort filter", async () => {
  const r = await executeSeniorRequest({
    q: "Who owns CMS CCN T00001?",
    class: "nursing_home",
    stars: "5_overall",
  });
  expect(r.query.terminalState).toBe("NEEDS_CLARIFICATION");
  expect(mocks.ownership).not.toHaveBeenCalled();
});

for (const [state, path] of [
  ["Illinois", "/illinois"],
  ["New Jersey", "/new-jersey"],
  ["California", "/california"],
  ["Texas", "/texas"],
  ["Washington", "/washington"],
  ["Colorado", "/colorado"],
])
  it(`published ${state} recovery keeps its own jurisdiction`, async () => {
    const r = await executeSeniorResearchQuery(`assisted living in ${state}`);
    expect(r.entities).toEqual([]);
    expect(renderToStaticMarkup(createElement(AskResultView, { result: r }))).toContain(
      `href="${path}"`,
    );
    expect(mocks.db).not.toHaveBeenCalled();
  });
