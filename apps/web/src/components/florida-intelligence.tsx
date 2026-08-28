import Link from "next/link";
import { coverageShare, formatHubCount, type FloridaIntelligence } from "@care/domain";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <span className="hub-bar" aria-hidden="true">
      <span className="hub-bar__fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </span>
  );
}

export function FloridaIntelligenceView({ intel }: { intel: FloridaIntelligence }) {
  const r = intel.regulatory;
  const cmsNh = intel.cmsOverlay.nursingHome;
  const nhReported = cmsNh.current - cmsNh.starCounts.missing;
  const familyRows = [
    ["Inspection", r.families.inspection, r.coverage.inspection],
    ["Deficiency", r.families.deficiency, r.coverage.deficiency],
    ["Legal action", r.families.legal_action, r.coverage.legal_action],
    ["Fine", r.families.fine, r.coverage.fine],
    ["Final order", r.families.final_order, r.coverage.final_order],
    ["Emergency action", r.families.emergency_action, r.coverage.emergency_action],
  ] as const;
  const classCards = [intel.classes.nh, intel.classes.alf, intel.classes.afch, intel.classes.hha, intel.classes.hospice];
  const eventShare = (100 * intel.providers.withConnectedEvent) / intel.providers.current;

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="fl-scale-title">
        <div className="section-heading">
          <p className="eyebrow">CURRENT AHCA identities</p>
          <h2 id="fl-scale-title">Five Florida provider classes, not one senior-care total</h2>
          <p>
            SeniorTrustHub tracks {formatHubCount(intel.providers.current)} CURRENT AHCA P0 identities.
            CURRENT means the provider appears in the FloridaHealthFinder Active/Open locator. It does
            not mean good standing, fully licensed, or no enforcement. Raw AHCA license status is a
            separate field.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="CURRENT AHCA P0 identities"
            value={formatHubCount(intel.providers.current)}
            note="Locator Active/Open census"
          />
          <Stat
            label="Credential observations"
            value={formatHubCount(intel.credentials.observations)}
            note="Not a provider count"
          />
          <Stat
            label="Geography observations"
            value={formatHubCount(intel.geographyObservations)}
            note="Facility, office, mailing, served, and field office kept separate"
          />
        </div>
        <div className="hub-class-grid florida-intel__classes">
          {classCards.map((card) => (
            <article className="hub-card" key={card.id}>
              <p className="eyebrow">{card.label}</p>
              <h3>{formatHubCount(card.current)} current</h3>
              <p>{card.identity}</p>
              <ul>
                <li>
                  Florida regulatory observations: {formatHubCount(card.observations)}
                </li>
                <li>
                  Providers with ≥1 inspection: {formatHubCount(card.inspectionProviders)}
                </li>
                <li>
                  Providers with ≥1 deficiency: {formatHubCount(card.deficiencyProviders)}
                </li>
                <li>
                  Providers with ≥1 final order: {formatHubCount(card.finalOrderProviders)}
                </li>
                <li>
                  Providers with ≥1 fine: {formatHubCount(card.fineProviders)}
                </li>
              </ul>
              {card.notes.map((note) => (
                <p className="hub-stat__note" key={note}>
                  {note}
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="fl-reg-title">
        <div className="section-heading">
          <p className="eyebrow">Florida AHCA</p>
          <h2 id="fl-reg-title">Regulatory &amp; Enforcement History</h2>
          <p>
            {formatHubCount(r.observations)} observations across{" "}
            {formatHubCount(intel.providers.withConnectedEvent)} CURRENT providers. Observation
            counts and provider counts are different metrics. Connected source coverage runs{" "}
            {r.dateMin} through {r.dateMax}. That is not a claim of complete regulatory history
            since 2003.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="Florida regulatory observations"
            value={formatHubCount(r.observations)}
            note={`${formatHubCount(intel.providers.withConnectedEvent)} distinct CURRENT providers`}
          />
          <Stat
            label="Final-order observations"
            value={formatHubCount(r.families.final_order)}
            note={`${formatHubCount(r.coverage.final_order)} providers; unique AHCA cases`}
          />
          <Stat
            label="Officially reported Florida fine dollars"
            value={`$${(r.fineUsd / 1_000_000).toFixed(1)}M`}
            note={`${formatHubCount(r.families.fine)} fine observations · AHCA, not CMS`}
          />
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Florida regulatory families: observations vs distinct CURRENT providers</caption>
            <thead>
              <tr>
                <th scope="col">Evidence family</th>
                <th scope="col">Observations</th>
                <th scope="col">Distinct providers</th>
              </tr>
            </thead>
            <tbody>
              {familyRows.map(([label, observations, providers]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatHubCount(observations)}</td>
                  <td>{formatHubCount(providers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {coverageShare(intel.providers.withConnectedEvent, intel.providers.current)} have at
          least one connected Florida regulatory observation.
        </p>
        <p>
          {formatHubCount(intel.providers.withoutConnectedEvent)} CURRENT providers have{" "}
          <strong>no connected Florida regulatory event observed</strong> in the acquired AHCA
          sources. That is not a clean record, not “no violations,” and not proof of absence.
        </p>
        <p className="hub-kicker" style={{ marginTop: "1rem" }}>
          Share of CURRENT identities with ≥1 connected Florida event
        </p>
        <Bar percent={eventShare} />
        <p>
          Complaint-triggered inspections are inspections initiated from a complaint-related
          process. They do not establish a substantiated complaint, a final finding, or consumer
          harm. ALF example: 1,713 CURRENT ALF identities have at least one complaint-triggered
          inspection observation.
        </p>
        <p>
          Finality: {formatHubCount(r.finality.final)} final, {formatHubCount(r.finality.nonFinal)}{" "}
          non-final, {formatHubCount(r.finality.unknown)} unknown / not reported. Unknown stays
          unknown. {formatHubCount(r.chowHeld)} CHOW-labeled source rows were held and are not
          included in these enforcement counts.
        </p>
      </section>

      <section aria-labelledby="fl-status-title">
        <div className="section-heading">
          <h2 id="fl-status-title">Locator CURRENT vs raw AHCA license status</h2>
          <p>
            Every row below is still CURRENT in the Active/Open locator. Raw status can still be
            IN REVIEW, PROVISIONAL, IN LITIGATION, INACTIVE, SUSPENDED, or CONDITIONAL.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>Raw AHCA license status among CURRENT locator identities</caption>
            <thead>
              <tr>
                <th scope="col">Raw AHCA status</th>
                <th scope="col">CURRENT providers</th>
              </tr>
            </thead>
            <tbody>
              {intel.statusRaw.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{formatHubCount(row.providers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fl-cred-title">
        <div className="section-heading">
          <h2 id="fl-cred-title">ALF specialty credentials</h2>
          <p>
            Limited Mental Health (LMH), Limited Nursing Services (LNS), and Extended Congregate
            Care (ECC) are add-on credentials on ALF licenses. They are not provider classes and
            they are not Memory Care licenses. SeniorTrustHub does not publish a Florida Memory
            Care facility count because no authoritative statewide Memory Care class denominator
            is stored.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="LMH credentials" value={formatHubCount(intel.credentials.lmh)} />
          <Stat label="LNS credentials" value={formatHubCount(intel.credentials.lns)} />
          <Stat label="ECC credentials" value={formatHubCount(intel.credentials.ecc)} />
        </div>
      </section>

      <section aria-labelledby="fl-cap-title">
        <div className="section-heading">
          <h2 id="fl-cap-title">Licensed capacity (not occupancy)</h2>
          <p>
            Residential licensed-capacity sums from AHCA P0 rows. Home Health capacity is not
            shown (source stores NULL). Hospice capacity is incomplete and is not shown as a
            statewide total.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat label="ALF licensed capacity" value={formatHubCount(intel.capacity.alf)} note="3,016 facilities" />
          <Stat label="AFCH licensed capacity" value={formatHubCount(intel.capacity.afch)} note="228 homes" />
          <Stat label="NH licensed beds (AHCA)" value={formatHubCount(intel.capacity.nh)} note="694 overlays" />
        </div>
      </section>

      <section aria-labelledby="fl-cms-title">
        <div className="section-heading">
          <p className="eyebrow">CMS / federal</p>
          <h2 id="fl-cms-title">National CMS Florida overlay (aggregate only)</h2>
          <p>
            These CMS Florida denominators are independently established. They are not row-linked
            to AHCA identities. Confirmed AHCA↔CMS links remain {intel.cmsConfirmedLinks}. Do not
            add AHCA and CMS inspection totals; the AHCA Nursing Home F/K feed was a federal
            repost and was excluded.
          </p>
        </div>
        <div className="hub-class-grid">
          <article className="hub-card">
            <p className="eyebrow">CMS Nursing Homes in Florida</p>
            <h3>{formatHubCount(cmsNh.current)} current</h3>
            <p>
              Same count as the AHCA NH overlay ({formatHubCount(intel.classes.nh.current)}), but
              that coincidence is not a confirmed identity crosswalk.
            </p>
            <p className="hub-kicker">CMS overall star among reported Florida NH</p>
            <div className="hub-table-scroll">
              <table className="hub-table hub-table--compact">
                <caption>CMS overall star among reported Florida nursing homes. Missing is not a zero score.</caption>
                <thead>
                  <tr>
                    <th scope="col">CMS stars</th>
                    <th scope="col">Providers</th>
                    <th scope="col">Share of reported</th>
                  </tr>
                </thead>
                <tbody>
                  {(["5", "4", "3", "2", "1"] as const).map((star) => {
                    const count = cmsNh.starCounts[star];
                    const percent = nhReported ? (100 * count) / nhReported : 0;
                    return (
                      <tr key={star}>
                        <th scope="row">{star} of 5</th>
                        <td>{formatHubCount(count)}</td>
                        <td>
                          {percent.toFixed(1)}%
                          <Bar percent={percent} />
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <th scope="row">Not reported</th>
                    <td>{formatHubCount(cmsNh.starCounts.missing)}</td>
                    <td>Missing is not a zero score</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Link className="text-link" href="/search">
              Research CMS Nursing Homes <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Home Health in Florida</p>
            <h3>{formatHubCount(intel.cmsOverlay.homeHealth.current)} current</h3>
            <p>
              Not equivalent to {formatHubCount(intel.classes.hha.current)} AHCA Home Health
              licenses. Quality of Patient Care star is missing for{" "}
              {formatHubCount(intel.cmsOverlay.homeHealth.qualityStarMissing)} CMS Florida
              agencies. Missing is not zero.
            </p>
            <Link className="text-link" href="/home-health">
              Research CMS Home Health <span aria-hidden="true">→</span>
            </Link>
          </article>
          <article className="hub-card">
            <p className="eyebrow">CMS Hospice GI in Florida</p>
            <h3>{formatHubCount(intel.cmsOverlay.hospiceGi)} current</h3>
            <p>
              Not equivalent to {formatHubCount(intel.classes.hospice.current)} AHCA hospice
              licenses. No CAHPS or quality-measure star is computed on this page.
            </p>
            <Link className="text-link" href="/hospice">
              Research CMS Hospice <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="fl-geo-title">
        <div className="section-heading">
          <h2 id="fl-geo-title">Geography (kinds kept separate)</h2>
          <p>
            Facility county is a location. Office county is not a service area. Served-county
            evidence is only shown where AHCA reported it. This is not a county Intelligence
            product and not a market-activity ranking.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>ALF facility locations by county (top 12 of 55 counties with an ALF location)</caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">ALF identities</th>
              </tr>
            </thead>
            <tbody>
              {intel.counties.alfFacility.map((row) => (
                <tr key={`alf-${row.county}`}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.providers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>HHA office locations by county (top 12). Not served-county evidence.</caption>
            <thead>
              <tr>
                <th scope="col">County</th>
                <th scope="col">HHA office identities</th>
              </tr>
            </thead>
            <tbody>
              {intel.counties.hhaOffice.map((row) => (
                <tr key={`hha-${row.county}`}>
                  <th scope="row">{row.county}</th>
                  <td>{formatHubCount(row.providers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table hub-table--compact">
            <caption>
              Explicit AHCA served-county aliases (exact map only). Raw source values are preserved.
            </caption>
            <thead>
              <tr>
                <th scope="col">Raw AHCA value</th>
                <th scope="col">Canonical county</th>
                <th scope="col">Served-county observations</th>
              </tr>
            </thead>
            <tbody>
              {intel.counties.servedCountyMappings.map((row) => (
                <tr key={row.raw}>
                  <th scope="row">{row.raw}</th>
                  <td>{row.canonical}</td>
                  <td>{formatHubCount(row.observations)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fl-contact-title">
        <div className="section-heading">
          <h2 id="fl-contact-title">Official contact coverage</h2>
          <p>
            Coverage of official AHCA contact kinds. This page does not publish personal contact
            details.
          </p>
        </div>
        <ul className="hub-plain-list">
          <li>Street address: {coverageShare(intel.contacts.streetAddressProviders, intel.providers.current)}</li>
          <li>Mailing address: {coverageShare(intel.contacts.mailingAddressProviders, intel.providers.current)}</li>
          <li>Phone: {formatHubCount(intel.contacts.phoneProviders)} providers</li>
          <li>Owner/licensee: {formatHubCount(intel.contacts.ownerProviders)}</li>
          <li>Administrator: {formatHubCount(intel.contacts.administratorProviders)}</li>
          <li>Financial officer: {formatHubCount(intel.contacts.financialOfficerProviders)}</li>
          <li>Website: {formatHubCount(intel.contacts.websiteProviders)}</li>
        </ul>
      </section>

      <section aria-labelledby="fl-method-title">
        <div className="section-heading">
          <h2 id="fl-method-title">Sources &amp; methodology</h2>
          <p>
            Source as-of is the official page clock. Retrieved-at is when SeniorTrustHub fetched
            the record. They are not the same.
          </p>
        </div>
        <div className="hub-table-scroll">
          <table className="hub-table">
            <caption>Connected sources on this page</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Agency</th>
                <th scope="col">Official as-of</th>
                <th scope="col">Retrieved</th>
                <th scope="col">Used for</th>
              </tr>
            </thead>
            <tbody>
              {intel.sources.map((source) => (
                <tr key={source.name}>
                  <th scope="row">{source.name}</th>
                  <td>{source.agency}</td>
                  <td>{source.asOf ?? "See national CMS snapshot"}</td>
                  <td>{source.retrievedAt ?? "—"}</td>
                  <td>{source.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>What this page does not infer</h3>
        <ul className="hub-plain-list">
          {intel.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          A small set of Florida assisted living and adult family care profiles is being published
          in controlled stages. This page is not a ranked list of providers. Home Health, Hospice,
          and Nursing Home Florida state-provider pages remain unpublished while AHCA↔CMS identity
          stays unresolved. CMS Nursing Home, Home Health, and Hospice discovery remains available
          nationally.
        </p>
        <div className="hub-cta-grid">
          <Link className="hub-cta" href="/search">
            Research CMS Nursing Homes
          </Link>
          <Link className="hub-cta" href="/home-health">
            Research CMS Home Health
          </Link>
          <Link className="hub-cta" href="/hospice">
            Research CMS Hospice
          </Link>
          <Link className="hub-cta" href="/methodology">
            Read SeniorTrustHub methodology
          </Link>
        </div>
      </section>
    </div>
  );
}
