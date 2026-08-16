"use client";
import { useState } from "react";

const copy = {
  claim: {
    type: "profile_claim",
    title: "Submit a profile claim",
    intro:
      "Tell us how you are authorized to represent this facility or organization. Claiming is free and does not affect evidence or ranking.",
  },
  correction: {
    type: "trusthub_correction",
    title: "Suggest a SeniorTrustHub correction",
    intro:
      "Report a possible identity, mapping, organization-linkage, duplicate, or presentation error made by SeniorTrustHub.",
  },
  "source-concern": {
    type: "source_data_concern",
    title: "Report a source-data concern",
    intro:
      "Tell us which cited government value concerns you. SeniorTrustHub cannot rewrite the source record, but we can explain the source and accept separately labeled factual context.",
  },
  context: {
    type: "provider_factual_context",
    title: "Submit factual provider context",
    intro:
      "Submit concise factual context for manual review. Advertising, personal information, and unsupported promotional claims are not accepted.",
  },
} as const;
export function TrustRequestForm({ kind, ccn = "" }: { kind: keyof typeof copy; ccn?: string }) {
  const content = copy[kind];
  const [status, setStatus] = useState<{
    kind: "idle" | "sending" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Free trust participation</p>
        <h1>{content.title}</h1>
        <p className="lede">{content.intro}</p>
      </header>
      <form
        className="trust-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setStatus({ kind: "sending" });
          const form = new FormData(event.currentTarget);
          const evidenceLinks = [String(form.get("evidenceUrl") ?? "")].filter(Boolean);
          const body = {
            requestType: content.type,
            ccn: form.get("ccn"),
            submitterName: form.get("name"),
            submitterRole: form.get("role"),
            submitterOrganization: form.get("organization"),
            submitterEmail: form.get("email"),
            submitterPhone: form.get("phone"),
            description: form.get("description"),
            referencedSection: form.get("section"),
            evidenceLinks,
            website: form.get("website"),
          };
          const response = await fetch("/api/trust-requests", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await response.json();
          setStatus(
            response.ok
              ? { kind: "success", message: `Request received. Reference ${data.requestId}.` }
              : { kind: "error", message: data.error ?? "Unable to submit request." },
          );
        }}
      >
        <input
          type="text"
          name="website"
          className="honeypot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <fieldset>
          <legend>Profile or organization</legend>
          <div className="field">
            <label htmlFor="trust-ccn">
              CMS provider ID <small>(if this concerns a facility)</small>
            </label>
            <input id="trust-ccn" name="ccn" maxLength={6} defaultValue={ccn} />
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Your contact information <span className="visually-hidden">Private</span>
          </legend>
          <p className="filter-note">
            Used only to review this request. It is never displayed publicly.
          </p>
          <div className="filter-row">
            <div className="field">
              <label htmlFor="trust-name">Name</label>
              <input id="trust-name" name="name" required maxLength={160} />
            </div>
            <div className="field">
              <label htmlFor="trust-role">Role or title</label>
              <input id="trust-role" name="role" required maxLength={160} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="trust-organization">Organization</label>
            <input id="trust-organization" name="organization" required maxLength={240} />
          </div>
          <div className="filter-row">
            <div className="field">
              <label htmlFor="trust-email">Email</label>
              <input id="trust-email" name="email" type="email" required maxLength={320} />
            </div>
            <div className="field">
              <label htmlFor="trust-phone">
                Phone <small>(optional)</small>
              </label>
              <input id="trust-phone" name="phone" type="tel" maxLength={40} />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Factual details</legend>
          <div className="field">
            <label htmlFor="trust-section">
              Evidence section <small>(optional)</small>
            </label>
            <select id="trust-section" name="section">
              <option value="">Select if applicable</option>
              <option>Facility identity</option>
              <option>Inspections</option>
              <option>Staffing</option>
              <option>Enforcement</option>
              <option>Ownership</option>
              <option>Chain context</option>
              <option>Sources</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="trust-description">Description</label>
            <textarea
              id="trust-description"
              name="description"
              required
              minLength={20}
              maxLength={5000}
              rows={8}
            />
          </div>
          <div className="field">
            <label htmlFor="trust-evidence">
              Supporting HTTPS link <small>(optional; no file uploads)</small>
            </label>
            <input
              id="trust-evidence"
              name="evidenceUrl"
              type="url"
              pattern="https://.*"
              maxLength={1000}
            />
          </div>
        </fieldset>
        <button
          className="button button--primary"
          disabled={status.kind === "sending"}
          type="submit"
        >
          {status.kind === "sending" ? "Submitting…" : "Submit for manual review"}
        </button>
        {status.kind !== "idle" && status.kind !== "sending" && (
          <p role={status.kind === "error" ? "alert" : "status"} className="methodology-note">
            {status.message}
          </p>
        )}
        <p className="filter-note">
          Submitting a request does not hide or change CMS evidence. Payment cannot influence
          review, ranking, or display.
        </p>
      </form>
    </>
  );
}
