import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { reconcileSenior } from "./reconcile-senior-network-metrics.mjs";
import {
  assertSeniorNetworkMetrics,
  fingerprintSeniorNetworkMetrics,
} from "../packages/domain/src/senior-network-metrics.ts";
const out = "apps/web/src/data/senior-network-metrics-v1.json";
const check = process.argv.includes("--check");
const generatedAt = check
  ? JSON.parse(readFileSync(out, "utf8")).generatedAt
  : new Date().toISOString();
const py = spawnSync(
  "python",
  ["-X", "utf8", "scripts/build-senior-network-metrics.py", "--base-json"],
  {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, METRICS_GENERATED_AT: generatedAt },
  },
);
if (py.status !== 0) throw new Error(py.stderr || py.stdout);
const manifest = reconcileSenior(JSON.parse(py.stdout));
manifest.sourceFingerprint = fingerprintSeniorNetworkMetrics(manifest);
assertSeniorNetworkMetrics(manifest);
const { format, resolveConfig } = await import("prettier");
const bytes = await format(JSON.stringify(manifest), {
  ...(await resolveConfig(out)),
  parser: "json",
});
if (check) {
  if (readFileSync(out, "utf8").replace(/\r\n/g, "\n") !== bytes)
    throw new Error("Stale metrics; run npm run build:network-metrics");
} else writeFileSync(out, bytes, "utf8");
console.log(
  JSON.stringify({
    checked: check,
    path: out,
    generatedAt: manifest.generatedAt,
    fingerprint: manifest.sourceFingerprint,
    stateMetrics: manifest.reconciliation.stateMetrics.length,
  }),
);
