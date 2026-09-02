import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import inventoryPayload from "@/data/nj-facility-inventory.json";
import { NjFacilityInventory } from "./nj-facility-inventory";

const payload = inventoryPayload as {
  rows: Array<{ source: string; typeKey: string; type: string }>;
};

describe("New Jersey facility inventory", () => {
  it("exposes state-only rows without combining universes or inventing CMS links", () => {
    render(<NjFacilityInventory />);
    expect(payload.rows).toHaveLength(2323);
    expect(payload.rows.filter((row) => row.source === "all_ltc")).toHaveLength(893);
    expect(payload.rows.filter((row) => row.source === "all_acute")).toHaveLength(1430);
    expect(
      new Set(payload.rows.filter((row) => row.source === "all_ltc").map((row) => row.type)).size,
    ).toBe(19);
    expect(
      new Set(payload.rows.filter((row) => row.source === "all_acute").map((row) => row.type)).size,
    ).toBe(26);
    expect(payload.rows.filter((row) => row.typeKey === "NJ_HHA")).toHaveLength(39);
    expect(payload.rows.filter((row) => row.typeKey === "NJ_HOSPICE_PROGRAM")).toHaveLength(68);
    expect(payload.rows.filter((row) => row.typeKey === "NJ_HOSPICE_BRANCH")).toHaveLength(27);
    expect(payload.rows.filter((row) => row.typeKey === "NJ_HOSPICE_INPATIENT")).toHaveLength(9);
    expect(
      screen.getByRole("table", { name: /state-only rows have no CMS profile link/i }),
    ).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/State-only/);
    expect(document.body.textContent).not.toMatch(/Trust Score/);
  });
});
