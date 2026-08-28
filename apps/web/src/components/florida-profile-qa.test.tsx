import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import qaCohort from "@/data/florida-profile-qa-cohort.json";
import { FloridaProfileQaDetail, FloridaProfileQaList } from "./florida-profile-qa";

describe("Florida internal profile QA", () => {
  it("covers five classes, 25 unpublished snapshots, and no ranking language", () => {
    expect(qaCohort.n).toBe(25);
    expect(qaCohort.indexable).toBe(false);
    const classes = new Set(qaCohort.profiles.map((p) => p.provider_class));
    expect(classes).toEqual(
      new Set([
        "FL_ALF",
        "FL_AFCH",
        "FL_HOME_HEALTH_LICENSE",
        "FL_HOSPICE_LICENSE",
        "FL_NH_LICENSE",
      ]),
    );
    render(<FloridaProfileQaList profiles={qaCohort.profiles} />);
    expect(screen.getByRole("heading", { name: /internal profile cohort/i })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/not published/i);
    expect(document.body.textContent).not.toMatch(/trust score|best (alf|nursing)|ranking of/i);
  });

  it("renders identity, no-event language, and bounded regulatory families without scores", () => {
    const zero = qaCohort.profiles.find((p) => p.events === 0);
    const rich = qaCohort.profiles.find((p) => p.events > 0);
    expect(zero).toBeTruthy();
    expect(rich).toBeTruthy();
    render(<FloridaProfileQaDetail profile={zero!} />);
    expect(document.body.textContent).toMatch(
      /No connected Florida regulatory event was observed in the acquired AHCA sources/,
    );
    expect(document.body.textContent).not.toMatch(/clean record|no violations/i);
    expect(document.body.textContent).toMatch(/CURRENT is not good standing/i);
    expect(document.body.textContent).toMatch(/locator only/i);
    render(<FloridaProfileQaDetail profile={rich!} />);
    expect(document.body.textContent).toMatch(/Inspection|inspection/);
    expect(document.body.textContent).not.toMatch(/aggregateRating|ratingValue/);
    expect(JSON.stringify(rich!.payload)).not.toMatch(/"score"|"rank"/);
  });

  it("uses Florida CMS denominators on HHA/Hospice snapshots and keeps NH equality non-identity", () => {
    const hha = qaCohort.profiles.find((p) => p.provider_class === "FL_HOME_HEALTH_LICENSE");
    const hospice = qaCohort.profiles.find((p) => p.provider_class === "FL_HOSPICE_LICENSE");
    const nh = qaCohort.profiles.find((p) => p.provider_class === "FL_NH_LICENSE");
    expect(hha).toBeTruthy();
    expect(hospice).toBeTruthy();
    expect(nh).toBeTruthy();
    const hhaText = hha!.payload.limitations.join(" ");
    const hospiceText = hospice!.payload.limitations.join(" ");
    const nhText = nh!.payload.limitations.join(" ");
    expect(hhaText).toMatch(/1,146/);
    expect(hhaText).toMatch(/2,971/);
    expect(hhaText).not.toMatch(/12,460|12460/);
    expect(hha!.payload.identity.cms_confirmed).toBe(false);
    expect(hospiceText).toMatch(/61 providers/);
    expect(hospiceText).toMatch(/74 CURRENT Hospice/);
    expect(hospiceText).not.toMatch(/6,669|6669|6,911|6911/);
    expect(hospiceText).toMatch(/No Hospice star/);
    expect(hospice!.payload.identity.cms_confirmed).toBe(false);
    expect(nhText).toMatch(/do not prove row-level identity/);
    expect(nh!.payload.identity.cms_confirmed).toBe(false);
  });
});
