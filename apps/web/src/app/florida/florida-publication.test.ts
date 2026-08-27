import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "page.tsx"), "utf8");

describe("Florida page publication", () => {
  it("stays noindex until an index gate", () => {
    expect(source).toMatch(/index:\s*false/);
    expect(source).toMatch(/follow:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).not.toMatch(/publicRobots\(true\)/);
  });
});
