import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/new-mexico-public-snapshot.json";
import { interpretNewMexicoAsk } from "@/server/care/nm-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const BANNED = /\b(52|68|114)\b/;

describe("New Mexico senior publication", () => {
  it("keeps every class unacquired and off one census", () => {
    expect(snapshot.ticket).toBe("NM-SEN-001");
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.classesAdded).toBe(false);
    expect(snapshot.classes.map((row) => row.roster)).toEqual([
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
    ]);
    expect(snapshot.classes.map((row) => row.name)).toEqual([
      "Nursing facilities",
      "Assisted living facilities",
      "Adult residential care",
      "Home health",
      "Hospice",
      "Adult day",
      "ICF/IID",
    ]);
    expect(snapshot.cmsCertificationDownloaded).toBe(false);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.cmsIsFederalOverlay).toBe(true);
    expect(snapshot.facilityDirectoryExportDownloaded).toBe(false);
    expect(snapshot.facilitySearchInteractive).toBe(true);
    expect(snapshot.resourceGuide.isFacilityRoster).toBe(false);
    expect(snapshot.resourceGuide.isFacilityCount).toBe(false);
    expect(snapshot.resourceGuide.publicExtract).toMatch(/not a roster|rules guide|who we are/i);
    expect(snapshot.temporaryOrProvisionalLicenseCount).toBe("NOT_ACQUIRED");
    expect(snapshot.temporaryLicenseIsFullLicense).toBe(false);
    expect(snapshot.capacity).toBe("NOT_ACQUIRED");
    expect(snapshot.surveyCount).toBe("NOT_ACQUIRED");
    expect(snapshot.deficiencyCount).toBe("NOT_ACQUIRED");
    expect(snapshot.complaintCount).toBe("NOT_ACQUIRED");
    expect(snapshot.complaintIsFinding).toBe(false);
    expect(snapshot.complaintIntakeIsCensus).toBe(false);
    expect(snapshot.enforcementCount).toBe("NOT_ACQUIRED");
    expect(snapshot.recordsPath).toBe("hca.ipra@hca.nm.gov");
    expect(snapshot.recordsPathIsCensus).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.netNewEntities).toBe(0);
    expect(snapshot.newCanonicalFacilities).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.cityRoutesPublished).toBe(false);
    expect(JSON.stringify(snapshot)).not.toMatch(BANNED);
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/new-mexico/page.tsx", "utf8");
    const prose = page.replace(/\s+/g, " ");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    const ask = fs.readFileSync("src/server/care/nm-ask.ts", "utf8");
    expect(page).toContain('canonicalUrl("/new-mexico")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(prose).toContain("The guide is not a roster");
    expect(page).toContain("snapshot.recordsPath");
    expect(prose).toContain("records path, not a census");
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(BANNED);
    expect(ask).not.toMatch(BANNED);
    expect(page).not.toMatch(/\/new-mexico\/(?:albuquerque|santa-fe)/);
    expect(sitemap.match(/"\/new-mexico"/g)).toHaveLength(1);
    expect(sitemap).toContain('"/arkansas"');
    expect(sitemap).toContain('"/utah"');
    expect(fs.readdirSync("src/app/new-mexico").sort()).toEqual([
      "nm-publication.test.ts",
      "page.tsx",
    ]);
    expect(fs.existsSync("src/app/new-mexico/albuquerque")).toBe(false);
    expect(normalizedPublishedStatePath("/New-Mexico")).toBe("/new-mexico");
    expect(normalizedPublishedStatePath("/NEW-MEXICO")).toBe("/new-mexico");
    expect(normalizedPublishedStatePath("/new-mexico")).toBeNull();
    expect(normalizedPublishedStatePath("/new-mexico/albuquerque")).toBeNull();
    expect(normalizedPublishedStatePath("/new-mexico/santa-fe")).toBeNull();
  });

  it("fails closed without a senior census", () => {
    const nursing = interpretSeniorAskQuery("nursing homes in New Mexico");
    expect(nursing.failReason).toMatch(/NOT_ACQUIRED/);
    expect(nursing.failReason).not.toMatch(BANNED);
    const postal = interpretSeniorAskQuery("nursing homes in NM");
    expect(postal.failReason).toMatch(/NOT_ACQUIRED/);
    expect(postal.coverageState).toBe("NOT_ACQUIRED");
    const total = interpretSeniorAskQuery("how many senior facilities in New Mexico");
    expect(total.failReason).toMatch(/cannot be combined/);
    expect(total.failReason).toMatch(/NOT_ACQUIRED/);
    expect(total.failReason).not.toMatch(BANNED);
    expect(interpretSeniorAskQuery("best nursing home in New Mexico").failReason).toMatch(
      /does not rank/,
    );
    expect(interpretSeniorAskQuery("best nursing home in New Mexico").coverageState).toBe(
      "UNSUPPORTED",
    );
    expect(interpretSeniorAskQuery("assisted living in Albuquerque New Mexico").failReason).toMatch(
      /NOT_ACQUIRED/,
    );
    expect(interpretSeniorAskQuery("assisted living in Albuquerque New Mexico").failReason).toMatch(
      /geography only/,
    );
    expect(interpretSeniorAskQuery("assisted living in Santa Fe New Mexico").failReason).toMatch(
      /geography only/,
    );
    expect(interpretSeniorAskQuery("adult residential care in New Mexico").failReason).toMatch(
      /NOT_ACQUIRED/,
    );
    expect(interpretSeniorAskQuery("home health in New Mexico").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretSeniorAskQuery("hospice in New Mexico").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretSeniorAskQuery("adult day in New Mexico").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretSeniorAskQuery("ICF in New Mexico").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretSeniorAskQuery("nursing home complaints in New Mexico").failReason).toMatch(
      /not a finding/,
    );
    expect(interpretSeniorAskQuery("nursing home complaints in New Mexico").failReason).toMatch(
      /not a complaint census/,
    );
    expect(interpretSeniorAskQuery("nursing home surveys in New Mexico").failReason).toMatch(
      /NOT_ACQUIRED/,
    );
    expect(interpretSeniorAskQuery("temporary license in New Mexico").failReason).toMatch(
      /not a full license/,
    );
    expect(interpretSeniorAskQuery("nursing home beds in New Mexico").failReason).toMatch(
      /NOT_ACQUIRED/,
    );
    expect(interpretSeniorAskQuery("CMS nursing homes in New Mexico").failReason).toMatch(
      /not downloaded/,
    );
    expect(interpretNewMexicoAsk("nursing home Albuquerque")).toBeNull();
    expect(interpretNewMexicoAsk("nm")).toBeNull();
    expect(interpretNewMexicoAsk("NM")).toBeNull();
    expect(interpretNewMexicoAsk("nursing homes NM")).toBeNull();
    expect(interpretNewMexicoAsk("nursing homes nm")).toBeNull();
    expect(interpretNewMexicoAsk("assisted living Las Vegas NM")).toBeNull();
    expect(interpretNewMexicoAsk("nursing homes in Arizona")).toBeNull();
    expect(interpretNewMexicoAsk("nursing homes in Arkansas")).toBeNull();
    expect(interpretNewMexicoAsk("nursing homes in Oklahoma")).toBeNull();
    expect(interpretNewMexicoAsk("nursing homes in Utah")).toBeNull();
    expect(interpretSeniorAskQuery("nursing homes in Arkansas").failReason).toContain(
      "approximately 224",
    );
    expect(interpretSeniorAskQuery("nursing homes in Arkansas").failReason).not.toContain(
      "Licensed Oversight Bureau",
    );
    expect(interpretSeniorAskQuery("nursing homes in Oklahoma").failReason).not.toContain(
      "Licensed Oversight Bureau",
    );
    expect(interpretSeniorAskQuery("assisted living Las Vegas NM").failReason ?? "").not.toContain(
      "Licensed Oversight Bureau",
    );
  });
});
