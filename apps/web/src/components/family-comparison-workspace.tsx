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
  subscribeFamilyWorkspace,
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
  const stageId = `${idPrefix}-stage-${entry.ccn}`;
  const quoteId = `${idPrefix}-quote-${entry.ccn}`;
  const notesId = `${idPrefix}-notes-${entry.ccn}`;
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
        <p className="kicker">CMS ID {facility.ccn}</p>
        <h3>
          <Link href={facility.facilityHref}>{facility.facilityName}</Link>
        </h3>
        <p>{[facility.city, facility.state].filter(Boolean).join(", ")}</p>
        <button className="text-link" type="button" onClick={onRemove}>
          Remove
        </button>
      </header>
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
            {facility.ownership.chainName ? <p>CMS chain: {facility.ownership.chainName}</p> : null}
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
      <EvidenceLink href={`${facility.facilityHref}#staffing`} label="View staffing" />
      <EvidenceLink href={`${facility.facilityHref}#inspections`} label="View inspection history" />
      <EvidenceLink href={facility.history.historyHref} label="View Facility History" />
      <EvidenceLink
        href={facility.ownership.organizationHref ?? `${facility.facilityHref}#ownership`}
        label="Explore ownership"
      />
      {interviewBuilderEnabled ? (
        <p>
          <Link href={`${INTERVIEW_BUILDER_PATH}?ccn=${facility.ccn}`}>
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
}: {
  navigatorEnabled?: boolean;
  plannerEnabled?: boolean;
  interviewBuilderEnabled?: boolean;
}) {
  const headingId = useId();
  const raw = useSyncExternalStore(subscribeFamilyWorkspace, familyWorkspaceSnapshot, () => "");
  const workspace = useMemo(() => parseFamilyWorkspace(raw || null), [raw]);
  const [comparison, setComparison] = useState<FamilyWorkspaceComparison | null>(null);
  const [activeCcn, setActiveCcn] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [generatedOn, setGeneratedOn] = useState("");
  const ccnKey = workspace.entries.map((entry) => entry.ccn).join(",");

  useEffect(() => {
    const ccns = ccnKey ? ccnKey.split(",") : [];
    if (ccns.length === 0) return;
    let cancelled = false;
    fetch("/api/workspace/comparison", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ccns }),
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
        setActiveCcn((current) => current ?? payload.facilities[0]?.ccn ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ccnKey]);

  const entryByCcn = useMemo(
    () => new Map(workspace.entries.map((entry) => [entry.ccn, entry])),
    [workspace.entries],
  );
  const activeFacility =
    comparison?.facilities.find((item) => item.ccn === activeCcn) ??
    comparison?.facilities[0] ??
    null;

  function update(ccn: string, patch: Partial<FamilyWorkspaceEntry>) {
    updateFacilityWorkspaceAnnotation(ccn, patch);
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
            Start by researching a CMS-certified nursing facility and add it to your Family
            Workspace.
          </p>
          <p>
            <Link className="button button--primary" href="/search">
              Search nursing facilities →
            </Link>
          </p>
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
                  key={facility.ccn}
                  type="button"
                  role="tab"
                  aria-selected={facility.ccn === activeFacility?.ccn}
                  onClick={() => setActiveCcn(facility.ccn)}
                >
                  {facility.facilityName}
                </button>
              ))}
            </div>
            {activeFacility ? (
              <FacilityCard
                facility={activeFacility}
                entry={
                  entryByCcn.get(activeFacility.ccn) ??
                  readFamilyWorkspace().entries.find((item) => item.ccn === activeFacility.ccn)
                }
                interviewBuilderEnabled={interviewBuilderEnabled}
                onUpdate={(patch) => update(activeFacility.ccn, patch)}
                onRemove={() => removeFacilityFromWorkspace(activeFacility.ccn)}
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
                    <th key={facility.ccn} scope="col">
                      <Link href={facility.facilityHref}>{facility.facilityName}</Link>
                      <span>
                        {[facility.city, facility.state].filter(Boolean).join(", ")} ·{" "}
                        {facility.ccn}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">CMS overall</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.ccn}>
                      <CmsStarRating value={facility.ratings.overall} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Staffing</th>
                  {comparison.facilities.map((facility) => (
                    <td key={facility.ccn}>
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
                    <td key={facility.ccn}>
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
                    <td key={facility.ccn}>
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
                    <td key={facility.ccn}>
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
                    <td key={facility.ccn}>
                      {facility.stateEvidence.licenseId
                        ? `${facility.stateEvidence.licenseLabel ?? "State license"} ${facility.stateEvidence.licenseId}`
                        : "Published state-license fields appear only where SeniorTrustHub already shows them."}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Your research</th>
                  {comparison.facilities.map((facility) => {
                    const entry = entryByCcn.get(facility.ccn);
                    return (
                      <td key={facility.ccn}>
                        {entry ? (
                          <ResearchEditor
                            idPrefix="table"
                            entry={entry}
                            onChange={(patch) => update(facility.ccn, patch)}
                          />
                        ) : null}
                        {interviewBuilderEnabled ? (
                          <p>
                            <Link href={`${INTERVIEW_BUILDER_PATH}?ccn=${facility.ccn}`}>
                              Build questions for this facility →
                            </Link>
                          </p>
                        ) : null}
                        <button
                          className="text-link"
                          type="button"
                          onClick={() => removeFacilityFromWorkspace(facility.ccn)}
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
