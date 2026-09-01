import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloridaProviderProfileView } from "./florida-provider-profile";

const payload = {
  identity: {
    official_name: "EXAMPLE ALF",
    profile_kind: "assisted-living",
    ahca_file_number: "11900000",
    locator_status: "CURRENT",
    license_status_raw: "IN REVIEW",
  },
  licensing: {
    license_effective_on: "2024-01-01",
    license_expires_on: "2026-01-01",
    licensed_capacity: 12,
  },
  credentials: [
    { credential_type: "LICENSE_NUMBER", raw_label: "AL123", credential_code: "AL123" },
    { credential_type: "ECC", raw_label: "ECC", credential_code: "ECC" },
  ],
  contacts: [
    { contact_kind: "street_address", value_text: "1 MAIN ST" },
    { contact_kind: "phone", value_text: "(305) 555-0100" },
  ],
  geography: [{ geography_kind: "facility_county", raw: "Dade", canonical: "Miami-Dade" }],
  regulatory: {
    observation_count: 0,
    has_connected_event: false,
    absence_language:
      "No connected Florida regulatory event was observed in the acquired AHCA sources.",
    counts: {
      inspection: 0,
      deficiency: 0,
      legal_action: 0,
      fine: 0,
      final_order: 0,
      emergency_action: 0,
    },
    earliest: null,
    latest: null,
    fine_usd: "0",
    recent: [],
    recent_final_orders: [],
  },
  sources: {
    provider_source_as_of: "2026-08-27T19:13:36+00:00",
    provider_retrieved_at: "2026-08-27T19:58:38+00:00",
    adapter_version: "fl-ahca-p0-v1",
  },
  limitations: ["Historical/non-current Florida identities are not represented."],
};

describe("Florida public provider profile", () => {
  it("explains CURRENT, avoids scores/Memory Care, and keeps absence language", () => {
    render(
      <FloridaProviderProfileView
        path="/florida/assisted-living/11900000/example-alf"
        payload={payload}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "EXAMPLE ALF" })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/CURRENT is not good standing/i);
    expect(document.body.textContent).toMatch(/IN REVIEW/);
    expect(document.body.textContent).toMatch(/Licensed capacity/);
    expect(document.body.textContent).toMatch(/is not occupancy/);
    expect(document.body.textContent).toMatch(/not Memory Care licenses/i);
    expect(document.body.textContent).toMatch(
      /No connected Florida regulatory event was observed in the acquired AHCA sources/,
    );
    expect(document.body.textContent).not.toMatch(
      /clean record|no violations|Trust Score|top provider/i,
    );
    expect(document.body.textContent).not.toMatch(
      /controlling_interest|financial_officer|other_named_party/,
    );
    expect(document.body.textContent).toMatch(
      /not a ranked list|not a recommendation|not an endorsement/i,
    );
    expect(document.body.textContent).toMatch(
      /Historical\/non-current Florida identities are not represented/,
    );
  });
});
