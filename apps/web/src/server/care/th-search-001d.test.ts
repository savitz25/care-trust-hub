import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SENIOR_SEARCH_CAPABILITIES } from "@/lib/specialist-search/capabilities";
import {
  SPECIALIST_SEARCH_ANALYTICS_EVENTS,
  SPECIALIST_SEARCH_VERSION,
} from "@/lib/specialist-search/contract";
import { interpretSeniorAskQuery } from "./senior-ask-parse";
import { SENIOR_SEARCH_GOLDEN_QUESTIONS, type GoldenOutcome } from "./senior-search-golden";

function outcome(query: string): GoldenOutcome {
  const parsed = interpretSeniorAskQuery(query);
  if (parsed.coverageState === "PARTIAL") return "PARTIAL";
  return parsed.mode === "fail_closed" ? "UNSUPPORTED_SAFE" : "PASS";
}

describe("TH-SEARCH-001D Senior Specialist Search V1", () => {
  it("freezes the portable contract and Senior capability states", () => {
    expect(SPECIALIST_SEARCH_VERSION).toBe("trusthub-specialist-search-v1");
    const states = new Set(SENIOR_SEARCH_CAPABILITIES.map((row) => row.supportState));
    for (const state of ["KNOWN", "PARTIAL", "NOT_ACQUIRED", "UNSUPPORTED"] as const)
      expect(states.has(state)).toBe(true);
    expect(SPECIALIST_SEARCH_ANALYTICS_EVENTS).toHaveLength(7);
  });

  it("classifies the 80+ golden questions deterministically with zero failures", () => {
    expect(SENIOR_SEARCH_GOLDEN_QUESTIONS.length).toBeGreaterThanOrEqual(80);
    const mismatches = SENIOR_SEARCH_GOLDEN_QUESTIONS.filter(
      (row) => outcome(row.query) !== row.expected,
    );
    expect(mismatches).toEqual([]);
    expect(SENIOR_SEARCH_GOLDEN_QUESTIONS.filter((row) => row.expected === "FAIL")).toEqual([]);
  });

  it("preserves identity and evidence boundaries", () => {
    expect(interpretSeniorAskQuery("CMS CCN 105502").identifier?.value).toBe("105502");
    expect(interpretSeniorAskQuery("105502").mode).toBe("fail_closed");
    expect(interpretSeniorAskQuery("5 star hospice in Florida").mode).toBe("fail_closed");
    expect(interpretSeniorAskQuery("how many senior care providers are there").mode).toBe(
      "fail_closed",
    );
    expect(interpretSeniorAskQuery("nursing homes serving my ZIP code").failReason).toMatch(
      /service territory/i,
    );
  });

  it("ships the shared shell, result trace, privacy-safe analytics, and noindex route", () => {
    const root = resolve(process.cwd(), "src");
    const page = readFileSync(resolve(root, "app/ask/page.tsx"), "utf8");
    const shell = readFileSync(
      resolve(root, "components/specialist-search/senior-specialist-search-shell.tsx"),
      "utf8",
    );
    const result = readFileSync(resolve(root, "app/ask/ask-result-view.tsx"), "utf8");
    const analytics = readFileSync(
      resolve(root, "components/specialist-search/search-analytics.tsx"),
      "utf8",
    );
    const executor = readFileSync(resolve(root, "server/care/senior-ask-execute.ts"), "utf8");
    expect(page).toContain("index: false, follow: true");
    expect(shell).toContain("Advanced filters");
    expect(shell).toContain("maxLength={180}");
    expect(result).toContain("Trace this result");
    expect(result).toContain("Why this matched");
    expect(analytics).not.toMatch(/rawQuery|ccn|providerName|email|address/);
    expect(executor).toContain("could not reach the published research corpus");
    expect(executor).toContain('coverageState: "UNKNOWN"');
  });
});
