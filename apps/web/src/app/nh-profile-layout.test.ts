import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "globals.css"), "utf8");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "m"));
  expect(match, `missing CSS rule for ${selector}`).toBeTruthy();
  return match?.[1] ?? "";
}

describe("NH profile wrap rules", () => {
  it("lets directory-status flex items wrap instead of clipping", () => {
    const body = ruleBody(".real-investigation-page .facility-hero__meta > span");
    expect(body).toMatch(/min-width:\s*0/);
    expect(body).toMatch(/overflow-wrap:\s*anywhere/);
    expect(body).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(body).not.toMatch(/white-space:\s*nowrap/);
  });

  it("lets the intelligence kicker wrap on narrow viewports", () => {
    const body = ruleBody(".real-investigation-page .nh-intel-kicker");
    expect(body).toMatch(/min-width:\s*0/);
    expect(body).toMatch(/overflow-wrap:\s*anywhere/);
    expect(body).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(body).not.toMatch(/white-space:\s*nowrap/);
  });
});
