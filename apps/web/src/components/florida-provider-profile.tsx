import Link from "next/link";
import { inspectionDisplayLabel } from "@care/domain";
import { brand } from "@/config/brand";

type PublicPayload = {
  identity: {
    official_name: string;
    profile_kind: string;
    ahca_file_number: string;
    locator_status: string;
    license_status_raw: string | null;
  };
  licensing: {
    license_effective_on: string | null;
    license_expires_on: string | null;
    licensed_capacity: number | null;
  };
  credentials: Array<{
    credential_type: string;
    raw_label: string | null;
    credential_code: string | null;
  }>;
  contacts: Array<{ contact_kind: string; value_text: string }>;
  geography: Array<{ geography_kind: string; raw: string; canonical: string | null }>;
  regulatory: {
    observation_count: number;
    has_connected_event: boolean;
    absence_language: string | null;
    counts: {
      inspection: number;
      deficiency: number;
      legal_action: number;
      fine: number;
      final_order: number;
      emergency_action: number;
    };
    earliest: string | null;
    latest: string | null;
    fine_usd: string;
    recent: Array<{
      event_family: string;
      event_type: string | null;
      event_date: string | null;
      case_number: string | null;
      is_final: boolean | null;
    }>;
    recent_final_orders: Array<{
      event_date: string | null;
      case_number: string | null;
      document_url: string | null;
    }>;
  };
  sources: {
    provider_source_as_of: string | null;
    provider_retrieved_at: string | null;
    adapter_version: string | null;
  };
  limitations: string[];
};

const KIND_LABEL: Record<string, string> = {
  "assisted-living": "Assisted living",
  "adult-family-care": "Adult family care home",
};

const CONTACT_LABEL: Record<string, string> = {
  street_address: "Street address",
  mailing_address: "Mailing address",
  phone: "Phone",
  website: "Website",
  administrator: "Administrator",
  owner_licensee: "Owner / licensee",
  management_company: "Management company",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function asText(value: unknown, fallback = "Not recorded in acquired AHCA sources"): string {
  if (value == null || value === "") return fallback;
  return String(value);
}

function formatDay(value: string | null | undefined): string {
  if (!value) return "Not recorded in acquired AHCA sources";
  return value.slice(0, 10);
}

export function FloridaProviderProfileView({
  path,
  payload,
}: {
  path: string;
  payload: PublicPayload;
}) {
  const identity = payload.identity;
  const licensing = payload.licensing;
  const regulatory = payload.regulatory;
  const kindLabel = KIND_LABEL[identity.profile_kind] ?? identity.profile_kind;
  const licenseNumber = payload.credentials.find((c) => c.credential_type === "LICENSE_NUMBER");
  const specialties = payload.credentials.filter((c) =>
    ["LMH", "LNS", "ECC", "STANDARD"].includes(c.credential_type),
  );
  const facilityCounties = payload.geography.filter((g) => g.geography_kind === "facility_county");
  const groupedContacts = new Map<string, string[]>();
  for (const contact of payload.contacts) {
    const values = groupedContacts.get(contact.contact_kind) ?? [];
    if (!values.includes(contact.value_text)) values.push(contact.value_text);
    groupedContacts.set(contact.contact_kind, values);
  }
  const street = (groupedContacts.get("street_address") ?? [])[0];

  return (
    <article className="florida-profile-qa florida-provider-public">
      <p className="florida-profile-qa__banner" role="note">
        {brand.publicName} presents official public-source research. This is not a regulator, not a
        recommendation, and not an endorsement. No score and no paid placement.
      </p>
      <header className="page-intro">
        <p className="eyebrow">
          Florida {kindLabel} · AHCA file {identity.ahca_file_number}
        </p>
        <h1>{identity.official_name}</h1>
        <p className="lede">
          Locator status is CURRENT because the provider appears in the AHCA Active/Open locator.
          CURRENT is not good standing, not “no enforcement,” and not a fully unconditional license.
          Raw AHCA status remains {asText(identity.license_status_raw)}.
        </p>
      </header>

      <section aria-labelledby="fl-identity">
        <h2 id="fl-identity">Identity and licensing</h2>
        <dl className="florida-profile-qa__facts">
          <Fact label="Provider class" value={kindLabel} />
          <Fact label="AHCA file number" value={identity.ahca_file_number} />
          <Fact
            label="License number"
            value={asText(licenseNumber?.credential_code || licenseNumber?.raw_label)}
          />
          <Fact label="Locator status" value={identity.locator_status} />
          <Fact label="Raw AHCA license status" value={asText(identity.license_status_raw)} />
          <Fact label="License effective" value={formatDay(licensing.license_effective_on)} />
          <Fact label="License expires" value={formatDay(licensing.license_expires_on)} />
          <Fact
            label="Licensed capacity"
            value={
              licensing.licensed_capacity == null
                ? "Not a capacity-bearing record in acquired sources"
                : String(licensing.licensed_capacity)
            }
          />
        </dl>
        <p>Licensed capacity is a license figure. It is not occupancy, current residents, or available beds.</p>
      </section>

      <section aria-labelledby="fl-credentials">
        <h2 id="fl-credentials">Credentials and specialties</h2>
        {specialties.length === 0 ? (
          <p>No specialty credentials were attached in acquired sources.</p>
        ) : (
          <ul>
            {specialties.map((credential, index) => (
              <li key={`${credential.credential_type}-${index}`}>
                {credential.credential_type}
                {credential.raw_label ? ` · ${credential.raw_label}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="hub-stat__note">
          LMH, LNS, and ECC are specialty credentials. They are not Memory Care licenses, Memory Care
          certification, or a Memory Care facility class.
        </p>
      </section>

      <section aria-labelledby="fl-contacts">
        <h2 id="fl-contacts">Official contacts</h2>
        {payload.contacts.length === 0 ? (
          <p>No public-candidate official contacts were attached in acquired sources.</p>
        ) : (
          <dl className="florida-profile-qa__facts">
            {[...groupedContacts.entries()].map(([kind, values]) => (
              <div key={kind}>
                <dt>{CONTACT_LABEL[kind] ?? kind}</dt>
                <dd>
                  {values.map((value) => (
                    <div key={value}>{value}</div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="fl-geo">
        <h2 id="fl-geo">Facility location</h2>
        <p>Facility county is location evidence. Mailing county and AHCA field office are not the facility location.</p>
        <dl className="florida-profile-qa__facts">
          <Fact label="Street address" value={asText(street)} />
          <Fact
            label="Facility county"
            value={
              facilityCounties.length
                ? facilityCounties
                    .map((row) => row.canonical || row.raw)
                    .filter(Boolean)
                    .join(", ")
                : "Not recorded in acquired AHCA sources"
            }
          />
        </dl>
      </section>

      <section aria-labelledby="fl-reg">
        <h2 id="fl-reg">Regulatory &amp; Enforcement History</h2>
        <p>
          Counts below are connected AHCA observations, not violations, scores, or a ranking.
          Inspection, deficiency, legal action, fine, final order, and emergency action remain
          separate families.
        </p>
        {regulatory.has_connected_event ? (
          <dl className="florida-profile-qa__facts">
            <Fact label="Connected observations" value={String(regulatory.observation_count)} />
            <Fact label="Inspection observations" value={String(regulatory.counts.inspection)} />
            <Fact label="Deficiency observations" value={String(regulatory.counts.deficiency)} />
            <Fact label="Legal action observations" value={String(regulatory.counts.legal_action)} />
            <Fact label="Florida AHCA fine observations" value={String(regulatory.counts.fine)} />
            <Fact label="Final order observations" value={String(regulatory.counts.final_order)} />
            <Fact
              label="Emergency action observations"
              value={String(regulatory.counts.emergency_action)}
            />
            <Fact label="Florida AHCA fine total in snapshot" value={`$${regulatory.fine_usd}`} />
            <Fact label="Earliest connected event" value={formatDay(regulatory.earliest)} />
            <Fact label="Latest connected event" value={formatDay(regulatory.latest)} />
          </dl>
        ) : (
          <p>{regulatory.absence_language}</p>
        )}
        {regulatory.recent.length > 0 ? (
          <table className="hub-table">
            <caption>Up to eight recent connected observations</caption>
            <thead>
              <tr>
                <th scope="col">Family</th>
                <th scope="col">Observation</th>
                <th scope="col">Date</th>
                <th scope="col">Case</th>
                <th scope="col">Finality</th>
              </tr>
            </thead>
            <tbody>
              {regulatory.recent.map((event, index) => (
                <tr key={`${event.event_family}-${index}`}>
                  <td>{event.event_family}</td>
                  <td>{inspectionDisplayLabel(event.event_family, event.event_type)}</td>
                  <td>{formatDay(event.event_date)}</td>
                  <td>{asText(event.case_number)}</td>
                  <td>
                    {event.is_final == null ? "Unknown" : event.is_final ? "Final" : "Not final"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {regulatory.recent_final_orders.length > 0 ? (
          <ul>
            {regulatory.recent_final_orders.map((order, index) => (
              <li key={`${order.case_number}-${index}`}>
                Final order {formatDay(order.event_date)}
                {order.case_number ? ` · ${order.case_number}` : ""}
                {order.document_url ? (
                  <>
                    {" · "}
                    <a href={order.document_url} rel="nofollow noopener noreferrer">
                      Official AHCA final-order document
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="fl-sources">
        <h2 id="fl-sources">Sources, freshness, and limitations</h2>
        <p>
          Sources: AHCA FloridaHealthFinder locator/profile records and connected Florida inspection
          and legal-sanction files acquired for this CURRENT identity. Dates below are source as-of
          and retrieval times, not “updated today.”
        </p>
        <dl className="florida-profile-qa__facts">
          <Fact label="Canonical research path" value={path} />
          <Fact label="Provider source as of" value={asText(payload.sources.provider_source_as_of)} />
          <Fact label="Retrieved at" value={asText(payload.sources.provider_retrieved_at)} />
          <Fact label="Adapter" value={asText(payload.sources.adapter_version)} />
        </dl>
        <ul>
          {payload.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>
          <Link href="/florida">Florida senior care research</Link>
          {" · "}
          <Link href="/methodology">Methodology</Link>
        </p>
      </section>
    </article>
  );
}
