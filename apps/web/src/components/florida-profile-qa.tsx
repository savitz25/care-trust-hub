import Link from "next/link";
import qaCohort from "@/data/florida-profile-qa-cohort.json";

type FloridaQaProfile = (typeof qaCohort.profiles)[number];

const KIND_LABEL: Record<string, string> = {
  "assisted-living": "Assisted living",
  "adult-family-care": "Adult family care home",
  "home-health": "Home health",
  hospice: "Hospice",
  "nursing-home": "Nursing home",
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

export function FloridaProfileQaBanner() {
  return (
    <p className="florida-profile-qa__banner" role="status">
      Internal QA only. These snapshots are not published, not in the sitemap, and not a ranking or
      score.
    </p>
  );
}

export function FloridaProfileQaList({ profiles }: { profiles: readonly FloridaQaProfile[] }) {
  const byKind = new Map<string, FloridaQaProfile[]>();
  for (const profile of profiles) {
    const list = byKind.get(profile.profile_kind) ?? [];
    list.push(profile);
    byKind.set(profile.profile_kind, list);
  }
  return (
    <div className="florida-profile-qa">
      <FloridaProfileQaBanner />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Florida provider profiles · fail-closed QA</p>
        <h1>Internal profile cohort</h1>
        <p className="lede">
          Twenty-five CURRENT P0 snapshots, five per class. Public provider URLs are not live.
          Future paths are reserved and unpublished.
        </p>
      </header>
      {[...byKind.entries()].map(([kind, items]) => (
        <section key={kind} aria-labelledby={`qa-${kind}`}>
          <h2 id={`qa-${kind}`}>{KIND_LABEL[kind] ?? kind}</h2>
          <ul className="florida-profile-qa__list">
            {items.map((profile) => (
              <li key={profile.provider_id}>
                <article className="hub-card">
                  <p className="eyebrow">{profile.qa_reason.replace(/_/g, " ")}</p>
                  <h3>
                    <Link href={profile.internal_path}>{profile.official_name}</Link>
                  </h3>
                  <p>AHCA file {profile.ahca_file_number}</p>
                  <p>
                    {profile.events} connected event{profile.events === 1 ? "" : "s"} ·{" "}
                    {asText(profile.license_status_raw, "status not recorded")}
                  </p>
                  <p className="hub-stat__note">Reserved path {profile.future_path}</p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FloridaProfileQaDetail({ profile }: { profile: FloridaQaProfile }) {
  const payload = profile.payload;
  const identity = payload.identity;
  const licensing = payload.licensing;
  const regulatory = payload.regulatory;
  const publicContacts = payload.contacts.filter((c) => c.display_tier === "public_candidate");
  const reviewContacts = payload.contacts.filter((c) => c.display_tier !== "public_candidate");
  const kindLabel = KIND_LABEL[profile.profile_kind] ?? profile.profile_kind;
  return (
    <article className="florida-profile-qa">
      <FloridaProfileQaBanner />
      <p>
        <Link href="/florida/internal">Back to internal cohort</Link>
      </p>
      <header className="page-intro">
        <p className="eyebrow">
          {kindLabel} · AHCA file {identity.ahca_file_number}
        </p>
        <h1>{identity.official_name}</h1>
        <p className="lede">
          Locator status is CURRENT because the provider appears in the AHCA Active/Open locator.
          CURRENT is not good standing. Raw AHCA status remains{" "}
          {asText(identity.license_status_raw)}.
        </p>
      </header>

      <section aria-labelledby="qa-identity">
        <h2 id="qa-identity">Identity</h2>
        <dl className="florida-profile-qa__facts">
          <Fact label="External key" value={identity.external_key} />
          <Fact label="Provider class" value={identity.provider_class} />
          <Fact label="AHCA file number" value={identity.ahca_file_number} />
          <Fact
            label="HealthFinder LID"
            value={`${asText(identity.healthfinder_lid)} (locator only)`}
          />
          <Fact label="CMS confirmed link" value="No. State and CMS identity stay separate." />
          <Fact label="Publication" value="internal_only · not indexable" />
        </dl>
      </section>

      <section aria-labelledby="qa-licensing">
        <h2 id="qa-licensing">Licensing and capacity</h2>
        <dl className="florida-profile-qa__facts">
          <Fact label="Locator status" value={identity.locator_status} />
          <Fact label="Raw AHCA license status" value={asText(identity.license_status_raw)} />
          <Fact
            label="Normalized locator field"
            value={asText(identity.license_status_normalized)}
          />
          <Fact label="License effective" value={asText(licensing.license_effective_on)} />
          <Fact label="License expires" value={asText(licensing.license_expires_on)} />
          <Fact
            label="Licensed capacity"
            value={
              licensing.licensed_capacity == null
                ? "Not a capacity-bearing record in acquired sources"
                : String(licensing.licensed_capacity)
            }
          />
        </dl>
        <p>Capacity is a license figure. It is not occupancy and not a quality score.</p>
      </section>

      <section aria-labelledby="qa-credentials">
        <h2 id="qa-credentials">Credentials and specialties</h2>
        {payload.credentials.length === 0 ? (
          <p>No specialty or license-number credentials were attached in acquired sources.</p>
        ) : (
          <ul>
            {payload.credentials.map((credential, index) => (
              <li key={`${credential.credential_type}-${index}`}>
                {credential.credential_type}
                {credential.raw_label ? ` · ${credential.raw_label}` : ""}
                {credential.credential_code ? ` · ${credential.credential_code}` : ""}
              </li>
            ))}
          </ul>
        )}
        <p className="hub-stat__note">
          LMH, LNS, and ECC remain specialty credentials. License numbers remain credentials. Memory
          Care is not a Florida provider class.
        </p>
      </section>

      <section aria-labelledby="qa-contacts">
        <h2 id="qa-contacts">Official contacts</h2>
        <p>Contact roles stay distinct. Multiple official contacts are retained.</p>
        <h3>Public-candidate contacts</h3>
        <ContactList contacts={publicContacts} />
        <h3>Review-before-public contacts</h3>
        <ContactList contacts={reviewContacts} />
      </section>

      <section aria-labelledby="qa-geo">
        <h2 id="qa-geo">Geography</h2>
        <p>Office, mailing, facility, served-county, and field-office rows stay distinct.</p>
        {payload.geography.length === 0 ? (
          <p>No geography observations were attached.</p>
        ) : (
          <ul>
            {payload.geography.map((row, index) => (
              <li key={`${row.geography_kind}-${index}`}>
                {row.geography_kind}: {row.raw}
                {row.mapping ? ` (${row.mapping})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="qa-reg">
        <h2 id="qa-reg">Regulatory and enforcement history</h2>
        <p>
          Bounded snapshot. Not a score, grade, or ranking. Inspection, deficiency, legal action,
          fine, final order, and emergency action remain separate families.
        </p>
        {regulatory.has_connected_event ? (
          <dl className="florida-profile-qa__facts">
            <Fact label="Connected observations" value={String(regulatory.observation_count)} />
            <Fact label="Inspections" value={String(regulatory.counts.inspection)} />
            <Fact label="Deficiencies" value={String(regulatory.counts.deficiency)} />
            <Fact label="Legal actions" value={String(regulatory.counts.legal_action)} />
            <Fact label="Fines" value={String(regulatory.counts.fine)} />
            <Fact label="Final orders" value={String(regulatory.counts.final_order)} />
            <Fact label="Emergency actions" value={String(regulatory.counts.emergency_action)} />
            <Fact label="AHCA fine total in snapshot" value={`$${regulatory.fine_usd}`} />
            <Fact label="Earliest connected event" value={asText(regulatory.earliest)} />
            <Fact label="Latest connected event" value={asText(regulatory.latest)} />
          </dl>
        ) : (
          <p>{regulatory.absence_language}</p>
        )}
        {regulatory.recent.length > 0 ? (
          <table className="hub-table">
            <caption>Up to eight recent connected events</caption>
            <thead>
              <tr>
                <th scope="col">Family</th>
                <th scope="col">Type</th>
                <th scope="col">Date</th>
                <th scope="col">Case</th>
                <th scope="col">Finality</th>
              </tr>
            </thead>
            <tbody>
              {regulatory.recent.map((event, index) => (
                <tr key={`${event.event_type}-${index}`}>
                  <td>{event.event_family}</td>
                  <td>{asText(event.event_type)}</td>
                  <td>{asText(event.event_date)}</td>
                  <td>{asText(event.case_number)}</td>
                  <td>
                    {event.is_final == null ? "Unknown" : event.is_final ? "Final" : "Not final"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section aria-labelledby="qa-sources">
        <h2 id="qa-sources">Sources, freshness, and limitations</h2>
        <dl className="florida-profile-qa__facts">
          <Fact
            label="Provider source as of"
            value={asText(payload.sources.provider_source_as_of)}
          />
          <Fact label="Retrieved at" value={asText(payload.sources.provider_retrieved_at)} />
          <Fact label="Adapter" value={asText(payload.sources.adapter_version)} />
        </dl>
        <ul>
          {payload.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ContactList({ contacts }: { contacts: FloridaQaProfile["payload"]["contacts"] }) {
  if (contacts.length === 0) {
    return <p>None in this tier.</p>;
  }
  return (
    <ul>
      {contacts.map((contact, index) => (
        <li key={`${contact.contact_kind}-${index}`}>
          {contact.contact_kind}
          {contact.title ? ` · ${contact.title}` : ""}: {contact.value_text}
        </li>
      ))}
    </ul>
  );
}
