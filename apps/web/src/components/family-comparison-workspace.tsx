"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  FAMILY_WORKSPACE_MAX_FACILITIES,
  FAMILY_WORKSPACE_PATH,
  FAMILY_WORKSPACE_SHARED_DEVICE_WARNING,
  INTERVIEW_BUILDER_PATH,
  RESEARCH_STAGE_LABELS,
  RESEARCH_STAGES,
  USER_ENTERED_QUOTE_LABEL,
  parseFamilyWorkspace,
  type FamilyWorkspaceComparison,
  type FamilyWorkspaceEntry,
  type ResearchStage,
  type WorkspaceFacilitySnapshot,
} from "@care/domain";
import { PrintButton } from "./print-button";
import { CmsStarRating } from "./real-provider";
import {
  clearFamilyWorkspace,
  familyWorkspaceSnapshot,
  readFamilyWorkspace,
  removeFacilityFromWorkspace,
  removeWorkspaceProvider,
  subscribeFamilyWorkspace,
  updateAssistedLivingFacilityAnnotation,
  updateFacilityWorkspaceAnnotation,
} from "./family-workspace-storage";
import { COST_PLANNER_PATH } from "./cost-planner-bridge";

function formatMetric(value: number | null, digits = 2): string {
  return value == null ? "Not reported" : value.toFixed(digits);
}

function EvidenceLink({ href, label }: { href: string; label: string }) {
  return (
    <p>
      <Link href={href}>{label} →</Link>
    </p>
  );
}

function ResearchEditor({
  entry,
  onChange,
  idPrefix,
}: {
  entry: FamilyWorkspaceEntry;
  onChange: (patch: Partial<FamilyWorkspaceEntry>) => void;
  idPrefix: string;
}) {
  const stageId = `${idPrefix}-stage-${entry.id}`;
  const quoteId = `${idPrefix}-quote-${entry.id}`;
  const notesId = `${idPrefix}-notes-${entry.id}`;
  return (
    <div className="family-workspace__research">
      <label htmlFor={stageId}>Research stage</label>
      <select
        id={stageId}
        value={entry.researchStage ?? ""}
        onChange={(event) =>
          onChange({
            researchStage: event.target.value ? (event.target.value as ResearchStage) : null,
          })
        }
      >
        <option value="">Not set</option>
        {RESEARCH_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {RESEARCH_STAGE_LABELS[stage]}
          </option>
        ))}
      </select>
      <label htmlFor={quoteId}>Your recorded quote — not verified by SeniorTrustHub</label>
      <div className="family-workspace__quote">
        <input
          id={quoteId}
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={entry.quotedAmount ?? ""}
          onChange={(event) =>
            onChange({
              quotedAmount: event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
        <select
          aria-label="Quote cadence"
          value={entry.quotedCadence ?? "daily"}
          onChange={(event) =>
            onChange({ quotedCadence: event.target.value === "monthly" ? "monthly" : "daily" })
          }
        >
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <p className="family-workspace__hint">
        {USER_ENTERED_QUOTE_LABEL}. Not SeniorTrustHub evidence.
      </p>
      <label htmlFor={notesId}>Your notes</label>
      <textarea
        id={notesId}
        rows={3}
        value={entry.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
      />
    </div>
  );
}

function FacilityCard({
  facility,
  entry,
  interviewBuilderEnabled,
  onUpdate,
  onRemove,
}: {
  facility: WorkspaceFacilitySnapshot;
  entry?: FamilyWorkspaceEntry;
  interviewBuilderEnabled: boolean;
  onUpdate: (patch: Partial<FamilyWorkspaceEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="family-workspace__card">
      <header>
        <p className="kicker">
          {facility.kind === "assisted_living"
            ? "Assisted living / residential care"
            : `CMS ID ${facility.ccn}`}
        </p>
        <h3>
          <Link href={facility.facilityHref}>{facility.facilityName}</Link>
        </h3>
        <p>{[facility.city, facility.state].filter(Boolean).join(", ")}</p>
        <button className="text-link" type="button" onClick={onRemove}>
          Remove
        </button>
      </header>
      {facility.kind === "assisted_living" && facility.assistedLiving ? (
        <dl>
          <div>
            <dt>Official care type</dt>
            <dd>{facility.assistedLiving.officialType}</dd>
          </div>
          <div>
            <dt>Licensed capacity</dt>
            <dd>
              {facility.assistedLiving.licensedCapacity == null
                ? "Not reported"
                : facility.assistedLiving.licensedCapacity}
            </dd>
          </div>
          <div>
            <dt>Memory designation</dt>
            <dd>{facility.assistedLiving.memoryLabel ?? "Not reported by the regulator"}</dd>
          </div>
          <div>
            <dt>Regulator status</dt>
            <dd>
              {facility.assistedLiving.statusHeadline ?? facility.assistedLiving.statusDetail}
            </dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>{facility.assistedLiving.licenseId ?? "Not reported"}</dd>
          </div>
          <div>
            <dt>Organization roles</dt>
            <dd>
              {facility.assistedLiving.organizations.length === 0
                ? "Not reported"
                : facility.assistedLiving.organizations
                    .map((party) => `${party.role}: ${party.name}`)
                    .join("; ")}
            </dd>
          </div>
        </dl>
      ) : (
        <dl>
          <div>
            <dt>CMS overall</dt>
            <dd>
              <CmsStarRating value={facility.ratings.overall} />
            </dd>
          </div>
          <div>
            <dt>Staffing rating</dt>
            <dd>
              <CmsStarRating value={facility.ratings.staffing} />
            </dd>
          </div>
          <div>
            <dt>Current staffing</dt>
            <dd>
              {formatMetric(facility.staffing.totalNurseHprd)} nurse HPRD
              {facility.staffing.quarter ? ` (${facility.staffing.quarter})` : ""}
            </dd>
          </div>
          <div>
            <dt>Recent staffing direction</dt>
            <dd>{facility.staffing.direction}</dd>
          </div>
          <div>
            <dt>Latest inspection</dt>
            <dd>
              {facility.inspections.latestDate ?? "Not reported"}
              {facility.inspections.latestDeficiencyCount != null
                ? ` · ${facility.inspections.latestDeficiencyCount} deficiencies`
                : ""}
            </dd>
          </div>
          <div>
            <dt>CMS penalties</dt>
            <dd>
              {facility.penalties.recentCmsPenalty
                ? (facility.penalties.recentSummary ?? "Recent CMS penalty recorded")
                : facility.penalties.hasRecordedCmsPenalty
                  ? "CMS penalties are recorded"
                  : "No CMS penalty in this published snapshot"}
            </dd>
          </div>
          <div>
            <dt>Facility History</dt>
            <dd>
              {facility.history.recentImportantCount > 0
                ? `${facility.history.recentImportantCount} recent changes worth reviewing`
                : "No major recent changes identified"}
            </dd>
          </div>
          <div>
            <dt>Ownership</dt>
            <dd>
              <p>{facility.ownership.cmsOwnershipType ?? "Not reported"}</p>
              {facility.ownership.chainName ? (
                <p>CMS chain: {facility.ownership.chainName}</p>
              ) : null}
              {facility.ownership.organizationName ? (
                <p>Organization: {facility.ownership.organizationName}</p>
              ) : null}
              {facility.ownership.recentOwnershipChange ? (
                <p>{facility.ownership.recentSummary ?? "Recent ownership change recorded"}</p>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>State oversight</dt>
            <dd>
              {facility.stateEvidence.licenseId
                ? `${facility.stateEvidence.licenseLabel ?? "State license"} ${facility.stateEvidence.licenseId}`
                : "No equivalent national state-license comparison. Published state fields appear only where SeniorTrustHub already shows them."}
              {facility.stateEvidence.hasPublishedStateEnforcement
                ? ` ${facility.stateEvidence.stateEnforcementSummary ?? "Published state enforcement evidence is available."}`
                : ""}
            </dd>
          </div>
        </dl>
      )}
      {facility.kind === "cms" ? (
        <>
          <EvidenceLink href={`${facility.facilityHref}#staffing`} label="View staffing" />
          <EvidenceLink
            href={`${facility.facilityHref}#inspections`}
            label="View inspection history"
          />
          <EvidenceLink href={facility.history.historyHref} label="View Facility History" />
          <EvidenceLink
            href={facility.ownership.organizationHref ?? `${facility.facilityHref}#ownership`}
            label="Explore ownership"
          />
        </>
      ) : (
        <EvidenceLink href={facility.facilityHref} label="View assisted-living record" />
      )}
      {interviewBuilderEnabled ? (
        <p>
          <Link
            href={
              facility.kind === "assisted_living"
                ? `${INTERVIEW_BUILDER_PATH}?al=${facility.id}&setting=assisted_living`
                : `${INTERVIEW_BUILDER_PATH}?ccn=${facility.ccn}`
            }
          >
            Build questions for this facility →
          </Link>
        </p>
      ) : null}
      {entry ? <ResearchEditor idPrefix="card" entry={entry} onChange={onUpdate} /> : null}
    </article>
  );
}

export function FamilyComparisonWorkspace({
  navigatorEnabled = false,
  plannerEnabled = false,
  interviewBuilderEnabled = false,
  assistedLivingEnabled = false,
}: {
  navigatorEnabled?: boolean;
  plannerEnabled?: boolean;
  interviewBuilderEnabled?: boolean;
  assistedLivingEnabled?: boolean;
}) {
  const headingId = useId();
  const raw = useSyncExternalStore(subscribeFamilyWorkspace, familyWorkspaceSnapshot, () => "");
  const workspace = useMemo(() => parseFamilyWorkspace(raw || null), [raw]);
  const [comparison, setComparison] = useState<FamilyWorkspaceComparison | null>(null);
  const [activeCcn, setActiveCcn] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [generatedOn, setGeneratedOn] = useState("");
  const ccnKey = workspace.entries.map((entry) => `${entry.kind}:${entry.id}`).join(",");

  useEffect(() => {
    const items = workspace.entries.map((entry) => ({ kind: entry.kind, id: entry.id }));
    const ccns = workspace.entries.filter((entry) => entry.kind === "cms").map((entry) => entry.id);
    if (items.length === 0) return;
    let cancelled = false;
    fetch("/api/workspace/comparison", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, ccns }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return (await response.json()) as FamilyWorkspaceComparison;
      })
      .then((payload) => {
        if (cancelled) return;
        setComparison(payload);
        setLoadError(false);
        setGeneratedOn(
          new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
            new Date(),
          ),
        );
        setActiveCcn((current) => current ?? payload.facilities[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ccnKey]);

  const entryByCcn = useMemo(
    () => new Map(workspace.entries.map((entry) => [entry.id, entry])),
    [workspace.entries],
  );
  const activeFacility =
    comparison?.facilities.find((item) => item.id === activeCcn) ??
    comparison?.facilities[0] ??
    null;

  function update(facility: WorkspaceFacilitySnapshot, patch: Partial<FamilyWorkspaceEntry>) {
    if (facility.kind === "assisted_living") {
      updateAssistedLivingFacilityAnnotation(facility.id, patch);
      return;
    }
    updateFacilityWorkspaceAnnotation(facility.ccn, patch);
  }

  function clearAll() {
    if (
      window.confirm(
        "Clear the Family Workspace? This removes locally saved notes and quotes on this browser.",
      )
    ) {
      clearFamilyWorkspace();
      setComparison(null);
    }
  }

  return (
    <section className="family-workspace" aria-labelledby={headingId}>
      <p className="eyebrow">Saved in this browser</p>
      <h1 id={headingId}>Family Comparison Workspace</h1>
      <p>
        Your shortlist and notes are saved only in this browser. SeniorTrustHub does not require an
        account or upload your notes.
      </p>
      <p>{FAMILY_WORKSPACE_SHARED_DEVICE_WARNING}</p>
      <p>
        {workspace.entries.length} of {FAMILY_WORKSPACE_MAX_FACILITIES} facilities saved
        {generatedOn ? ` · Prepared ${generatedOn}` : ""}
      </p>
      <div className="family-workspace__toolbar care-navigator__actions">
        <Link className="button button--secondary" href="/search">
          Add another facility
        </Link>
        <PrintButton label="Print / Save PDF" />
        {workspace.entries.length > 0 ? (
          <button className="button button--quiet" type="button" onClick={clearAll}>
            Clear workspace
          </button>
        ) : null}
      </div>

      {workspace.entries.length === 0 ? (
        <div className="empty-state">
          <p>
            Start by researching a CMS-certified nursing facility or a CA/NY/TX assisted-living
            provider and add it to your Family Workspace.
          </p>
          <p>
            <Link className="button button--primary" href="/search">
              Search nursing facilities →
            </Link>
          </p>
          {assistedLivingEnabled ? (
            <p>
              <Link className="button button--secondary" href="/assisted-living">
                Search assisted living →
              </Link>
            </p>
          ) : null}
          {navigatorEnabled ? (
            <p>
              <Link href="/tools/care-needs-navigator">Care Needs Navigator</Link>
            </p>
          ) : null}
          {plannerEnabled ? (
            <p>
              <Link href={COST_PLANNER_PATH}>Senior Care Cost Planner</Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {loadError ? (
        <p>Published evidence could not be loaded. Your local shortlist is unchanged.</p>
      ) : null}

      {ccnKey && comparison && comparison.facilities.length > 0 ? (
        <>
          {comparison.differences.length > 0 ? (
            <section className="family-workspace__differences">
              <h2>Things that differ</h2>
              <ul>
                {comparison.differences.map((item) => (
                  <li key={item.id}>{item.text}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="family-workspace__mobile">
            <div className="family-workspace__tabs" role="tablist" aria-label="Saved facilities">
              {comparison.facilities.map((facility) => (
                <button
                  key={facility.id}
                  type="button"
                  role="tab"
                  aria-selected={facility.id === activeFacility?.id}
                  onClick={() => setActiveCcn(facility.id)}
                >
                  {facility.facilityName}
                </button>
              ))}
            </div>
            {activeFacility ? (
              <FacilityCard
                facility={activeFacility}
                entry={
                  entryByCcn.get(activeFacility.id) ??
                  readFamilyWorkspace().entries.find((item) => item.id === activeFacility.id)
                }
                interviewBuilderEnabled={interviewBuilderEnabled}
                onUpdate={(patch) => update(activeFacility, patch)}
                onRemove={() =>
                  activeFacility.kind === "assisted_living"
                    ? removeWorkspaceProvider("assisted_living", activeFacility.id)
                    : removeFacilityFromWorkspace(activeFacility.ccn)
                }
              />
            ) : null}
          </div>

          <div className="family-workspace__desktop family-workspace__table-wrap">
            <table className="family-workspace__table">
              <caption className="visually-hidden">Side-by-side published evidence</caption>
              <thead>
                <tr>
                  <th scope="col">Topic</th>
                  {comparison.facilities.map((facility) => (
                    <th key={facility.id} scope="col">
                      <Link href={facility.facilityHref}>{facility.facilityName}</Link>
                      <span>
                        {[facility.city, facility.state].filter(Boolean).join(", ")}
                        {facility.kind === "cms" ? ` · ${facility.ccn}` : " · Assisted living"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">CMS overall</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.id}>
                      {facility.kind === "assisted_living" ? (
                        "Not a CMS nursing facility"
                      ) : (
                        <CmsStarRating value={facility.ratings.overall} />
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Staffing</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.id}>
                      <CmsStarRating value={facility.ratings.staffing} />
                      <p>
                        {formatMetric(facility.staffing.totalNurseHprd)} HPRD
                        {facility.staffing.quarter ? ` · ${facility.staffing.quarter}` : ""}
                      </p>
                      <p>{facility.staffing.direction}</p>
                      <EvidenceLink
                        href={`${facility.facilityHref}#staffing`}
                        label="View staffing"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Inspections &amp; enforcement</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.id}>
                      <p>{facility.inspections.latestDate ?? "Not reported"}</p>
                      {facility.inspections.recentComplaintInspection ? (
                        <p>Recent complaint inspection recorded</p>
                      ) : null}
                      <p>
                        {facility.penalties.recentCmsPenalty
                          ? (facility.penalties.recentSummary ?? "Recent CMS penalty recorded")
                          : facility.penalties.hasRecordedCmsPenalty
                            ? "CMS penalties are recorded"
                            : "No CMS penalty in this published snapshot"}
                      </p>
                      {facility.stateEvidence.hasPublishedStateEnforcement ? (
                        <p>
                          {facility.stateEvidence.stateEnforcementSummary ??
                            "Published state enforcement evidence is available."}
                        </p>
                      ) : null}
                      <EvidenceLink
                        href={`${facility.facilityHref}#inspections`}
                        label="View inspection history"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Facility History</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.id}>
                      <p>
                        {facility.history.recentImportantCount > 0
                          ? `${facility.history.recentImportantCount} recent changes worth reviewing`
                          : "No major recent changes identified"}
                      </p>
                      <EvidenceLink
                        href={facility.history.historyHref}
                        label="View Facility History"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Ownership</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.id}>
                      <p>{facility.ownership.cmsOwnershipType ?? "Not reported"}</p>
                      {facility.ownership.chainName ? (
                        <p>CMS chain: {facility.ownership.chainName}</p>
                      ) : null}
                      {facility.ownership.organizationName ? (
                        <p>Organization: {facility.ownership.organizationName}</p>
                      ) : null}
                      {facility.ownership.recentOwnershipChange ? (
                        <p>Recent ownership change recorded</p>
                      ) : null}
                      <EvidenceLink
                        href={
                          facility.ownership.organizationHref ??
                          `${facility.facilityHref}#ownership`
                        }
                        label="Explore ownership"
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">State oversight</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.id}>
                      {facility.stateEvidence.licenseId
                        ? `${facility.stateEvidence.licenseLabel ?? "State license"} ${facility.stateEvidence.licenseId}`
                        : "Published state-license fields appear only where SeniorTrustHub already shows them."}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Your research</th>
                  {comparison.facilities.map((facility) => {
                    const entry = entryByCcn.get(facility.id);
                    return (
                      <td key={facility.id}>
                        {entry ? (
                          <ResearchEditor
                            idPrefix="table"
                            entry={entry}
                            onChange={(patch) => update(facility, patch)}
                          />
                        ) : null}
                        {interviewBuilderEnabled ? (
                          <p>
                            <Link
                              href={
                                facility.kind === "assisted_living"
                                  ? `${INTERVIEW_BUILDER_PATH}?al=${facility.id}&setting=assisted_living`
                                  : `${INTERVIEW_BUILDER_PATH}?ccn=${facility.ccn}`
                              }
                            >
                              Build questions for this facility →
                            </Link>
                          </p>
                        ) : null}
                        <button
                          className="text-link"
                          type="button"
                          onClick={() =>
                            facility.kind === "assisted_living"
                              ? removeWorkspaceProvider("assisted_living", facility.id)
                              : removeFacilityFromWorkspace(facility.ccn)
                          }
                        >
                          Remove
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="care-navigator__disclaimer">{comparison.disclaimer}</p>
          {plannerEnabled ? (
            <p>
              <Link href={COST_PLANNER_PATH}>Compare general care costs →</Link>
            </p>
          ) : null}
        </>
      ) : null}

      <p className="family-workspace__print-path">{FAMILY_WORKSPACE_PATH}</p>
    </section>
  );
}
