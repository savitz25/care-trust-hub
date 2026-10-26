import { describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({
  getCareDatabasePool: () => ({ query }),
}));

import { getFacilitySitemapPage } from "./launch-repository";

describe("facility sitemap timestamps", () => {
  it("selects source-backed timestamps and does not substitute retrieval or build dates", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await getFacilitySitemapPage(0);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain(
      "COALESCE(fs.observed_at, sr.source_modified_at, sr.source_published_at)",
    );
    expect(sql).toContain("JOIN source_release sr ON sr.id=fs.source_release_id");
    expect(sql).not.toMatch(/retrieved_at|created_at/);
  });
});
