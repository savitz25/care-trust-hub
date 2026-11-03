import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StateIndexView } from "./state-index-view";
import {
  buildStateIndexFacts,
  cityIndexHref,
  facilityIndexHref,
  stateIndexAbout,
  type StateIndexModel,
} from "@/server/care/state-index-model";

function model(): StateIndexModel {
  const facilities = Array.from({ length: 25 }, (_, index) => {
    const ccn = String(105000 + index);
    const name = `Florida Home ${index}`;
    return {
      ccn,
      name,
      city: index < 3 ? "Miami" : "Tampa",
      href: facilityIndexHref(ccn, name),
      overall: 4,
      healthInspection: 3,
      staffing: 5,
      deficiencyCount: 7,
      fineAmount: index === 0 ? 8500 : null,
    };
  });
  const factsInput = {
    stateName: "Florida",
    facilityCount: 691,
    ratedCount: 640,
    averageOverall: 3.2,
    highOverallCount: 210,
    staffingRatedCount: 600,
    topCity: { name: "Miami", count: 48 },
  };
  return {
    stateCode: "FL",
    ...factsInput,
    facilities,
    places: [{ name: "Miami", count: 48, href: cityIndexHref("FL", "Miami") }],
    facts: buildStateIndexFacts(factsInput),
    about: stateIndexAbout(),
  };
}

describe("state index server markup", () => {
  it("renders the nursing-home table and facility links", () => {
    const html = renderToStaticMarkup(<StateIndexView model={model()} />);
    expect(html).toContain("Notable in Florida");
    expect(html).toContain("CMS lists 691 nursing homes in Florida");
    expect(html).toContain("<table>");
    expect((html.match(/<tr>/g) ?? []).length).toBe(26);
    expect(html).toContain('href="/facility/cms/105000/florida-home-0"');
    expect(html).toContain('href="/facility/cms/105024/florida-home-24"');
    expect(html).toContain("Miami");
    expect(html).toContain(">4<");
    expect(html).toContain(">7<");
    expect(html).toContain("$8,500");
    expect(html).toContain('href="/search?search=1&amp;state=FL&amp;city=Miami"');
    expect(html).toContain("About this data");
    expect(html).toContain('"@type":"ItemList"');
    expect(html).not.toContain("≠");
  });
});
