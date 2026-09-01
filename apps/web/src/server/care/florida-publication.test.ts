import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FLORIDA_PHASE1_PUBLIC_COUNTS,
  FLORIDA_PUBLICATION_CONTRACT,
  isFloridaPhase1PublicKind,
} from "@care/domain";
import manifest from "@/data/florida-provider-publication.json";
import {
  assertFloridaPublicationManifest,
  findFloridaPublicationEntry,
  resolveFloridaPublicationRoute,
  toPublicFloridaPayload,
  type FloridaProfilePayload,
} from "./florida-publication";

describe("Florida Phase 1 publication gate", () => {
  it("keeps a deterministic 20 ALF + 5 AFCH manifest with unique file-number routes", () => {
    assertFloridaPublicationManifest();
    expect(manifest.contract_version).toBe(FLORIDA_PUBLICATION_CONTRACT);
    expect(manifest.n).toBe(25);
    expect(manifest.profiles).toHaveLength(25);
    const alf = manifest.profiles.filter((p) => p.profile_kind === "assisted-living");
    const afch = manifest.profiles.filter((p) => p.profile_kind === "adult-family-care");
    expect(alf).toHaveLength(FLORIDA_PHASE1_PUBLIC_COUNTS["assisted-living"]);
    expect(afch).toHaveLength(FLORIDA_PHASE1_PUBLIC_COUNTS["adult-family-care"]);
    const paths = manifest.profiles.map((p) => p.future_path);
    expect(new Set(paths).size).toBe(25);
    expect(
      paths.every((path) => /\/florida\/(assisted-living|adult-family-care)\/\d+\//.test(path)),
    ).toBe(true);
    expect(manifest.profiles.some((p) => p.profile_kind === "nursing-home")).toBe(false);
  });

  it("404s unpublished kinds and noncohort identities, and redirects wrong slugs", () => {
    const published = manifest.profiles[0];
    expect(
      resolveFloridaPublicationRoute({
        kind: published.profile_kind,
        fileNumber: published.ahca_file_number,
        slug: published.name_slug,
        publicationEnabled: false,
      }).status,
    ).toBe("not_found");
    expect(isFloridaPhase1PublicKind("home-health")).toBe(false);
    expect(
      resolveFloridaPublicationRoute({
        kind: "nursing-home",
        fileNumber: "23702",
        slug: "aviata-at-tallahassee",
        publicationEnabled: true,
      }).status,
    ).toBe("not_found");
    expect(
      resolveFloridaPublicationRoute({
        kind: "assisted-living",
        fileNumber: "99999999",
        slug: "not-in-cohort",
        publicationEnabled: true,
      }).status,
    ).toBe("not_found");
    const redirected = resolveFloridaPublicationRoute({
      kind: published.profile_kind,
      fileNumber: published.ahca_file_number,
      slug: "wrong-slug",
      publicationEnabled: true,
    });
    expect(redirected).toEqual({ status: "redirect", path: published.future_path });
    expect(
      findFloridaPublicationEntry(published.profile_kind, published.ahca_file_number)?.provider_id,
    ).toBe(published.provider_id);
  });

  it("strips review-before-public contacts from the public payload", () => {
    const payload = {
      contacts: [
        {
          contact_kind: "phone",
          value_text: "1",
          title: null,
          source_field: "p",
          display_tier: "public_candidate",
        },
        {
          contact_kind: "controlling_interest",
          value_text: "secret-owner",
          title: null,
          source_field: "c",
          display_tier: "review_before_public",
        },
        {
          contact_kind: "financial_officer",
          value_text: "secret-cfo",
          title: null,
          source_field: "f",
          display_tier: "review_before_public",
        },
        {
          contact_kind: "other_named_party",
          value_text: "secret-party",
          title: null,
          source_field: "o",
          display_tier: "review_before_public",
        },
      ],
      publication: { state: "internal_only", indexable: false },
    } as FloridaProfilePayload;
    const publicPayload = toPublicFloridaPayload(payload);
    const blob = JSON.stringify(publicPayload);
    expect(publicPayload.contacts.map((c) => c.contact_kind)).toEqual(["phone"]);
    expect(blob).not.toMatch(/controlling_interest|financial_officer|other_named_party|secret-/);
  });
});
