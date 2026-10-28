import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/deployment", () => ({
  isPublicLaunchEnabled: () => true,
  productionOrigin: new URL("https://www.seniortrusthub.com"),
}));

import robots from "./robots";

describe("robots trust correction paths", () => {
  it("blocks the singular form but allows the plural corrections route", () => {
    const rules = robots().rules;
    const disallow = Array.isArray(rules) ? rules[0].disallow : rules.disallow;
    const paths = Array.isArray(disallow) ? disallow : [disallow];
    const blocked = (path: string) =>
      paths.some((rule) =>
        rule?.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule ?? ""),
      );

    expect(paths).toContain("/trust/correction$");
    expect(blocked("/trust/correction")).toBe(true);
    expect(blocked("/trust/corrections")).toBe(false);
  });
});
