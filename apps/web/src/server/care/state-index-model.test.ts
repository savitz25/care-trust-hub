import { describe, expect, it } from "vitest";
import {
  buildStateIndexFacts,
  cityIndexHref,
  facilityIndexHref,
  negationTokensPer100Words,
  stateIndexAbout,
  stateIndexItemList,
  type StateIndexFacility,
} from "./state-index-model";

function home(index: number): StateIndexFacility {
  const ccn = String(100000 + index);
  const name = `Example Home ${index}`;
  return {
    ccn,
    name,
    city: index % 2 === 0 ? "Miami" : "Tampa",
    href: facilityIndexHref(ccn, name),
    overall: 4,
    healthInspection: 3,
    staffing: 2,
    deficiencyCount: index,
    fineAmount: index % 5 === 0 ? 12000 : null,
  };
}

describe("state index model", () => {
  it("keeps the about box under two negation tokens per 100 words", () => {
    const about = stateIndexAbout();
    expect(about).not.toMatch(/≠/);
    expect(negationTokensPer100Words(about)).toBeLessThanOrEqual(2);
  });

  it("computes two to four facts that change with the state", () => {
    const florida = buildStateIndexFacts({
      stateName: "Florida",
      facilityCount: 691,
      ratedCount: 640,
      averageOverall: 3.2,
      highOverallCount: 210,
      staffingRatedCount: 600,
      topCity: { name: "Miami", count: 48 },
    });
    const wyoming = buildStateIndexFacts({
      stateName: "Wyoming",
      facilityCount: 36,
      ratedCount: 30,
      averageOverall: 3.8,
      highOverallCount: 12,
      staffingRatedCount: 28,
      topCity: { name: "Casper", count: 4 },
    });
    expect(florida.length).toBeGreaterThanOrEqual(2);
    expect(florida.length).toBeLessThanOrEqual(4);
    expect(florida.join(" ")).toContain("Florida");
    expect(florida.join(" ")).toContain("691");
    expect(florida.join(" ")).not.toBe(wyoming.join(" "));
  });

  it("links a facility by CCN and slug and a city search by count", () => {
    expect(facilityIndexHref("105402", "Example & Care")).toBe(
      "/facility/cms/105402/example-and-care",
    );
    expect(cityIndexHref("FL", "Miami")).toBe("/search?search=1&state=FL&city=Miami");
  });

  it("builds an ItemList for the facility table", () => {
    const facilities = Array.from({ length: 25 }, (_, index) => home(index));
    const list = stateIndexItemList({ stateName: "Florida", facilities });
    expect(list["@type"]).toBe("ItemList");
    expect(list.numberOfItems).toBe(25);
    expect(list.itemListElement[0]).toMatchObject({
      position: 1,
      url: "https://www.seniortrusthub.com/facility/cms/100000/example-home-0",
    });
    expect(list.itemListElement[24].position).toBe(25);
  });
});
