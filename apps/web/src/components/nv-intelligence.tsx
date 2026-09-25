import {
  formatHubCount,
  nvTraceMetrics,
  type NvPublicSnapshot,
  type NvTraceMetric,
} from "@care/domain";
import type { NvFacilityLists } from "@/server/care/nv-intelligence";

type Facility = NvFacilityLists["facilities"][number];

const CLASS_LABEL: Record<string, string> = {
  SNF: "Skilled Nursing (SNF)",
  SFD: "SNF distinct part of hospital (SFD)",
  AGC: "Residential Facility for Groups",
  HIC: "Home for Individual Residential Care",
  ADC: "Adult Day Care",
  HHA: "Home Health Agency",
  HBR: "Home Health branch office",
  HPC: "Hospice program of care",
  HFS: "Facility for hospice care",
};

const BRIDGE_LABEL: Record<string, string> = {
  exact_same_class: "Printed CCN matches a current CMS provider of the same class",
  none_printed: "No Federal Provider # printed",
  printed_not_a_ccn: "Printed value is not a CCN (kept as printed)",
  printed_ccn_not_in_cms_current_directory: "Printed CCN is not in the current CMS directory",
  printed_ccn_other_cms_class: "Printed CCN belongs to a different CMS class",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="hub-stat">
      <p className="hub-stat__value">{value}</p>
      <p className="hub-stat__label">{label}</p>
      {note ? <p className="hub-stat__note">{note}</p> : null}
    </div>
  );
}

function Trace({ metric }: { metric: NvTraceMetric }) {
  return (
    <details className="intel-disclose">
      <summary>Trace this number: {metric.label}</summary>
      <ul>
        <li>Source: {metric.source}</li>
        <li>Agency clock: {metric.sourceDate ?? "Unknown / source unavailable"}</li>
        <li>Source grain: {metric.sourceGrain}</li>
        <li>Coverage: {metric.coverageState}</li>
        <li>Limitation: {metric.caveat}</li>
      </ul>
    </details>
  );
}

function FacilityTable({
  rows,
  showEndorsements = false,
  showCcn = false,
}: {
  rows: Facility[];
  showEndorsements?: boolean;
  showCcn?: boolean;
}) {
  return (
    <div className="hub-table-scroll">
      <table className="hub-table">
        <thead>
          <tr>
            <th scope="col">Facility (as licensed)</th>
            <th scope="col">State license</th>
            <th scope="col">City</th>
            <th scope="col">Beds</th>
            {showEndorsements ? <th scope="col">Endorsements (as printed)</th> : null}
            {showCcn ? <th scope="col">CMS link</th> : null}
            <th scope="col">Latest state inspection</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.credentialNumber}>
              <td>{f.name}</td>
              <td>
                {f.credentialNumber} · {f.status}
                {f.expires ? ` · expires ${f.expires}` : ""}
              </td>
              <td>{f.city ?? "—"}</td>
              <td>{f.bedCount ?? "—"}</td>
              {showEndorsements ? (
                <td>{f.endorsements.length ? f.endorsements.join("; ") : "None printed"}</td>
              ) : null}
              {showCcn ? (
                <td>
                  {f.cmsBridge ? (
                    <a href={`/facility/cms/${f.cmsBridge}/profile`}>CCN {f.cmsBridge}</a>
                  ) : (
                    BRIDGE_LABEL[f.federalProviderState ?? "none_printed"]
                  )}
                </td>
              ) : null}
              <td>{f.latestInspection ?? "None listed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NvIntelligenceView({
  intel,
  lists,
}: {
  intel: NvPublicSnapshot;
  lists: NvFacilityLists;
}) {
  const traces = nvTraceMetrics(intel);
  const cms = intel.cmsOverlay;
  const snf = intel.skilledNursing;
  const sfd = intel.skilledNursingDistinctPart;
  const rfg = intel.rfg;
  const hirc = intel.hirc;
  const adc = intel.adultDay;
  const hh = intel.homeHealth;
  const hbr = intel.homeHealthBranch;
  const hpc = intel.hospiceProgram;
  const hfs = intel.hospiceFacility;
  const insp = intel.inspections;
  const sanc = intel.stateSanctions;
  const cw = intel.crosswalk;
  const reg = intel.regulatorMap;
  const by = (cls: string) => lists.facilities.filter((f) => f.cls === cls);
  const al = by("AGC").filter((f) =>
    (f.endorsements as string[]).includes("ASSISTED LIVING SERVICES"),
  );
  const alz = by("AGC").filter((f) => (f.endorsements as string[]).includes("ALZHEIMER DISEASE"));
  const sanctioned = lists.facilities.filter((f) => f.sanctions.length);

  return (
    <div className="national-hub florida-intel">
      <section className="hub-scale" aria-labelledby="nv-state-title">
        <div className="section-heading">
          <p className="eyebrow">Nevada state sources</p>
          <h2 id="nv-state-title">Each care setting has its own license and count</h2>
          <p>
            Nevada health facilities are licensed by the {reg.current.bureau}, part of the{" "}
            {reg.current.division} of the {reg.current.authority}. Older pages and the facility
            search itself still carry the former Division of Public and Behavioral Health (DPBH)
            name; that name is historical. The counts below come from HCQC&apos;s public facility
            search, which lists active licenses only, downloaded {intel.retrievedAt.slice(0, 10)}.
            They are different kinds of providers and are never added into one Nevada total.
          </p>
        </div>
        <div className="hub-stat-grid">
          <Stat
            label="State Skilled Nursing licenses (SNF)"
            value={formatHubCount(snf.distinctCredentialNumbers)}
            note={`${formatHubCount(snf.bedsAsPrinted)} beds · plus ${formatHubCount(sfd.distinctCredentialNumbers)} hospital distinct-part SNFs`}
          />
          <Stat
            label="Residential Facilities for Groups"
            value={formatHubCount(rfg.distinctCredentialNumbers)}
            note={`${formatHubCount(rfg.bedsAsPrinted)} beds · base state class`}
          />
          <Stat
            label="RFGs with the Assisted Living endorsement"
            value={formatHubCount(rfg.assistedLivingEndorsed)}
            note="Endorsed subset of RFGs, not every RFG"
          />
          <Stat
            label="RFGs with the Alzheimer's disease endorsement"
            value={formatHubCount(rfg.alzheimerEndorsed)}
            note={`${formatHubCount(rfg.assistedLivingAndAlzheimerEndorsed)} hold both endorsements`}
          />
          <Stat
            label="Homes for Individual Residential Care"
            value={formatHubCount(hirc.distinctCredentialNumbers)}
            note="Separate class, not an RFG"
          />
          <Stat
            label="State Home Health agencies"
            value={formatHubCount(hh.distinctCredentialNumbers)}
            note={`plus ${formatHubCount(hbr.distinctCredentialNumbers)} branch offices · CMS lists ${formatHubCount(cms.homeHealth)}`}
          />
          <Stat
            label="Hospice programs of care"
            value={formatHubCount(hpc.distinctCredentialNumbers)}
            note={`plus ${formatHubCount(hfs.distinctCredentialNumbers)} facilities for hospice care · CMS lists ${formatHubCount(cms.hospice)}`}
          />
          <Stat
            label="Adult Day Care facilities"
            value={formatHubCount(adc.distinctCredentialNumbers)}
            note="Separate class"
          />
        </div>
        {traces.map((metric) => (
          <Trace key={metric.id} metric={metric} />
        ))}
      </section>

      <section className="hub-scale" id="skilled-nursing" aria-labelledby="nv-snf-title">
        <div className="section-heading">
          <p className="eyebrow">Skilled Nursing</p>
          <h2 id="nv-snf-title">A state SNF license is not CMS certification</h2>
          <p>
            HCQC licenses {formatHubCount(snf.distinctCredentialNumbers)} Facilities for Skilled
            Nursing and {formatHubCount(sfd.distinctCredentialNumbers)} skilled nursing distinct
            parts of hospitals. CMS separately lists {formatHubCount(cms.nursingHomes)} certified
            Nevada nursing homes. HCQC prints a Federal Provider # on most SNF rows;{" "}
            {formatHubCount(cw.cmsNursingHomesBridged)} of the {formatHubCount(cms.nursingHomes)}{" "}
            CMS nursing homes match a state row by that exact printed number and class. The other{" "}
            {formatHubCount(cw.cmsNursingHomesNotBridged)} are not linked: no match is not the same
            as no overlap, and nothing is matched by name.
          </p>
        </div>
        <FacilityTable rows={[...by("SNF"), ...by("SFD")]} showCcn />
      </section>

      <section className="hub-scale" id="rfg" aria-labelledby="nv-rfg-title">
        <div className="section-heading">
          <p className="eyebrow">Residential Facilities for Groups</p>
          <h2 id="nv-rfg-title">An RFG is the base license; assisted living is an endorsement</h2>
          <p>
            A Residential Facility for Groups (RFG; HCQC code AGC) provides room, board, and some
            personal care. HCQC lists {formatHubCount(rfg.distinctCredentialNumbers)} RFGs. Each
            RFG&apos;s detail page prints its endorsements, for example{" "}
            {Object.entries(rfg.endorsementCountsAsPrinted)
              .map(([k, v]) => `${k.toLowerCase()} (${formatHubCount(v)})`)
              .join(", ")}
            . Endorsements are shown exactly as printed; one RFG can hold several.
          </p>
        </div>
      </section>

      <section className="hub-scale" id="assisted-living" aria-labelledby="nv-al-title">
        <div className="section-heading">
          <p className="eyebrow">Assisted Living</p>
          <h2 id="nv-al-title">Only endorsed RFGs may provide assisted living services</h2>
          <p>
            In Nevada, a Residential Facility for Groups needs the state&apos;s Assisted Living
            endorsement before it may provide assisted living services.{" "}
            {formatHubCount(rfg.assistedLivingEndorsed)} of{" "}
            {formatHubCount(rfg.distinctCredentialNumbers)} RFGs print that endorsement (
            {formatHubCount(rfg.assistedLivingEndorsedBeds)} beds). The rest are RFGs, not assisted
            living. <a href={rfg.endorsementGuide}>HCQC endorsement guidance</a>
          </p>
        </div>
        <FacilityTable rows={al} showEndorsements />
      </section>

      <section className="hub-scale" id="memory-care" aria-labelledby="nv-alz-title">
        <div className="section-heading">
          <p className="eyebrow">Other endorsements</p>
          <h2 id="nv-alz-title">Alzheimer&apos;s disease endorsement</h2>
          <p>
            {formatHubCount(rfg.alzheimerEndorsed)} RFGs print an Alzheimer&apos;s disease
            endorsement ({formatHubCount(rfg.assistedLivingAndAlzheimerEndorsed)} also hold Assisted
            Living), and RFGs print {formatHubCount(rfg.categoryIIAlzheimerBedsPrinted)} Category II
            Alzheimer&apos;s beds. A facility that advertises &quot;memory care&quot; is
            state-endorsed only if its license shows the endorsement. Mental illness and
            intellectual-disability endorsements are separate and are not memory care.
          </p>
        </div>
        <FacilityTable rows={alz} showEndorsements />
      </section>

      <section className="hub-scale" id="hirc" aria-labelledby="nv-hirc-title">
        <div className="section-heading">
          <p className="eyebrow">Homes for Individual Residential Care</p>
          <h2 id="nv-hirc-title">A separate, smaller licensed home</h2>
          <p>
            HCQC lists {formatHubCount(hirc.distinctCredentialNumbers)} Homes for Individual
            Residential Care (HIRC; code HIC). They are a separate class from RFGs and are not
            assisted living. {formatHubCount(adc.distinctCredentialNumbers)} Facilities for the Care
            of Adults During the Day (Adult Day Care) are another separate class.
          </p>
        </div>
      </section>

      <section className="hub-scale" id="home-health" aria-labelledby="nv-hh-title">
        <div className="section-heading">
          <p className="eyebrow">Home Health</p>
          <h2 id="nv-hh-title">State Home Health license and CMS certification are separate</h2>
          <p>
            HCQC lists {formatHubCount(hh.distinctCredentialNumbers)} Agencies to Provide Nursing in
            the Home (Home Health Agencies) and {formatHubCount(hbr.distinctCredentialNumbers)}{" "}
            branch offices; branches are not agencies. CMS lists {formatHubCount(cms.homeHealth)}{" "}
            certified Nevada Home Health agencies. {formatHubCount(hh.exactCmsBridges ?? 0)} state
            agency rows match a CMS agency by an exact printed CCN. The state and CMS counts are
            never added.
          </p>
        </div>
      </section>

      <section className="hub-scale" id="hospice" aria-labelledby="nv-hospice-title">
        <div className="section-heading">
          <p className="eyebrow">Hospice</p>
          <h2 id="nv-hospice-title">Hospice program and hospice facility are different licenses</h2>
          <p>
            HCQC licenses {formatHubCount(hpc.distinctCredentialNumbers)} Hospice Care programs of
            care and {formatHubCount(hfs.distinctCredentialNumbers)} Facilities for Hospice Care
            (inpatient buildings). CMS lists {formatHubCount(cms.hospice)} certified Nevada
            hospices. {formatHubCount(hpc.exactCmsBridges ?? 0)} program rows match a CMS hospice by
            an exact printed CCN; some rows print notes such as &quot;revoked&quot; in that field,
            which are kept as printed and never linked. There is no combined hospice count.
          </p>
        </div>
      </section>

      <section className="hub-scale" id="inspections" aria-labelledby="nv-insp-title">
        <div className="section-heading">
          <p className="eyebrow">Inspections and state sanctions</p>
          <h2 id="nv-insp-title">State inspections are not CMS inspections</h2>
          <p>
            Each HCQC facility page lists its Statements of Deficiency and Plans of Correction by
            date, inspection number, and grade. {formatHubCount(insp.facilitiesWithIndex)} active
            facilities list {formatHubCount(insp.indexRows)} state inspections (
            {intel.clocks.earliest_inspection_date} to {intel.clocks.latest_inspection_date}); the
            findings themselves stay on HCQC and were not copied. CMS Statements of Deficiencies
            stay on each CMS profile.
          </p>
          <p>
            The same pages list State Sanctions: {formatHubCount(sanc.rows)} sanction rows on{" "}
            {formatHubCount(sanc.facilities)} active facilities (
            {Object.entries(sanc.byType)
              .map(([k, v]) => `${k} ${formatHubCount(v)}`)
              .join(", ")}
            ). Each is shown only on the license page it came from. The search results&apos;
            &quot;Disciplinary Action&quot; flag reads Yes for{" "}
            {formatHubCount(sanc.gridDisciplinaryFlagYes)} facilities, so it understates the detail
            pages. Closed and revoked licenses are not in the search, so their sanctions are not
            here.
          </p>
        </div>
        {sanctioned.length ? (
          <div className="hub-table-scroll">
            <table className="hub-table">
              <thead>
                <tr>
                  <th scope="col">Facility</th>
                  <th scope="col">Class · license</th>
                  <th scope="col">Sanction (as printed)</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sanctioned.flatMap((f) =>
                  f.sanctions.map((s, i) => (
                    <tr key={`${f.credentialNumber}-${i}`}>
                      <td>{f.name}</td>
                      <td>
                        {CLASS_LABEL[f.cls] ?? f.cls} · {f.credentialNumber}
                      </td>
                      <td>{s.type}</td>
                      <td>{s.date}</td>
                      <td>{[s.status, s.statusReason].filter(Boolean).join(" · ")}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="hub-scale" id="complaints" aria-labelledby="nv-complaints-title">
        <div className="section-heading">
          <p className="eyebrow">Complaints</p>
          <h2 id="nv-complaints-title">Complaints go to HCQC; records are not published</h2>
          <p>
            HCQC takes complaints about licensed health facilities. Complaint records and outcomes
            are not published in bulk and were not acquired (request only). A complaint is not a
            deficiency and not an enforcement finding.{" "}
            <a href={intel.complaints.intake}>File a complaint with HCQC</a>
          </p>
        </div>
      </section>

      <section className="hub-scale" aria-labelledby="nv-limits-title">
        <div className="section-heading">
          <p className="eyebrow">Limitations</p>
          <h2 id="nv-limits-title">What this page does not claim</h2>
          <ul>
            <li>
              No combined Nevada senior-facility or bed total. Classes are counted separately.
            </li>
            <li>
              Not every Residential Facility for Groups is assisted living; only endorsed RFGs are.
            </li>
            <li>
              The facility search lists active licenses only; closed or revoked licenses are not
              here.
            </li>
            <li>
              No state row is matched to CMS by name. Unmatched is not the same as no overlap.
            </li>
            <li>Beds are licensed capacity, not residents. City is context only; no city pages.</li>
            <li>
              Administrators are licensed separately and are people, not facilities. Their names are
              not shown.
            </li>
            <li>No ranking, rating, or Trust Score.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
