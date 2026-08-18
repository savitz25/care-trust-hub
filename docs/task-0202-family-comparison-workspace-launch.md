# Task 020.2 — Family Comparison Workspace launch

Route: `/workspace` (always noindex)

Flag: `CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE` (fail-closed)

## Privacy / storage

Uses `senior-family-workspace-v1` in `localStorage`. Comparison evidence is fetched with `POST /api/workspace/comparison` so shortlists never appear in URLs. Notes, stages, and quotes stay in the browser.

## Comparison

Desktop: side-by-side table. Mobile: facility tabs and stacked cards. **Things that differ** uses the 020.1 deterministic copy. No scores or color-coded judgment.

## Integrations

Facility page and compact search-card add controls. Workspace links to Interview Builder by CCN only and to the Cost Planner without transferring quotes.

## Persistence

Shortlist and notes survive reload on the same browser. Clearing the workspace asks for confirmation because it deletes local notes.

## Database

The API uses the 020.1 bounded batch read and the shared pool.

## Google safeguard

Google Places API requests: 0
