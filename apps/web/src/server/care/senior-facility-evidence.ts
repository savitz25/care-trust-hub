import "server-only";
import type { SeniorAskEntity } from "./senior-ask-execute";
import type { SeniorResearchQuery } from "./senior-ask-contract";
import { getProviderByCcn } from "./repository";
import { getProviderOwnershipIntelligence } from "./ownership-repository";
import { getProviderRegulatoryIntelligence } from "./regulatory-repository";
import { getCareDatabasePool } from "./db";
import { isOwnershipIntelligenceEnabled, isInspectionIntelligenceEnabled } from "./feature-flags";
export type FacilityEvidenceAnswer = {
  task: NonNullable<SeniorResearchQuery["facilityEvidence"]>;
  status: "AVAILABLE" | "UNSUPPORTED";
  title: string;
  summary: string;
  rows: Array<{
    label: string;
    value: string;
    date?: string | null;
    source?: string;
    sourceAsOf?: string | null;
    retrievedAt?: string | null;
  }>;
  sources: Array<{
    name: string;
    release: string;
    asOf: string | null;
    retrievedAt: string | null;
  }>;
  limitations: string[];
};
const sourceKeys = {
  ownership: [
    "nursing-home-ownership",
    "skilled-nursing-facility-all-owners",
    "skilled-nursing-facility-enrollments",
  ],
  chow: ["skilled-nursing-facility-change-of-ownership"],
  penalty: ["nursing-home-penalties"],
  inspection: ["nursing-home-inspection-dates"],
  deficiency: ["nursing-home-health-deficiencies"],
};
/** The already-resolved public identity is the only evidence key. No name, owner or location joins. */
export async function loadFacilityEvidence(
  entity: SeniorAskEntity,
  task: NonNullable<SeniorResearchQuery["facilityEvidence"]>,
): Promise<FacilityEvidenceAnswer> {
  const answer: FacilityEvidenceAnswer = {
    task,
    status: "AVAILABLE",
    title: {
      ownership: "Indexed ownership relationships",
      chow: "Indexed changes of ownership",
      penalty: "Indexed penalty and enforcement observations",
      inspection: "Indexed inspection observations",
      deficiency: "Indexed deficiency observations",
    }[task],
    summary: "",
    rows: [],
    sources: [],
    limitations: [
      "These observations belong only to the displayed provider and CCN. Source dates are not live verification or a safety assessment.",
    ],
  };
  if (entity.providerClass !== "nursing_home")
    return {
      ...answer,
      status: "UNSUPPORTED",
      summary:
        "This evidence path is acquired for CMS nursing homes. Home Health and Hospice do not inherit its ownership, CHOW, penalty or inspection evidence. Use this provider's class-specific report and official CMS research.",
    };
  if (
    task === "ownership" || task === "chow"
      ? !isOwnershipIntelligenceEnabled()
      : !isInspectionIntelligenceEnabled()
  )
    return {
      ...answer,
      status: "UNSUPPORTED",
      summary:
        "This evidence module is not enabled for public research. No absence-of-evidence conclusion was inferred.",
    };
  const provider = await getProviderByCcn(entity.ccn);
  if (!provider || provider.ccn !== entity.ccn) throw new Error("Provider identity unavailable");
  const clocks = await getCareDatabasePool().query<{
    dataset_key: string;
    display_name: string;
    release_key: string;
    source_modified_at: Date | null;
    retrieved_at: Date;
  }>(
    `SELECT DISTINCT ON(sd.dataset_key) sd.dataset_key,sd.display_name,sr.release_key,sr.source_modified_at,sr.retrieved_at FROM source_dataset sd JOIN source_release sr ON sr.source_dataset_id=sd.id JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded' WHERE sd.dataset_key=ANY($1::text[]) ORDER BY sd.dataset_key,sr.source_modified_at DESC NULLS LAST,sr.source_release_date DESC NULLS LAST,sr.release_key DESC,ir.completed_at DESC`,
    [sourceKeys[task]],
  );
  if (!clocks.rows.length) throw new Error("Required evidence source unavailable");
  answer.sources = clocks.rows.map((s) => ({
    name: s.display_name,
    release: s.release_key,
    asOf: s.source_modified_at?.toISOString() ?? null,
    retrievedAt: s.retrieved_at?.toISOString() ?? null,
  }));
  if (task === "ownership" || task === "chow") {
    const evidence = await getProviderOwnershipIntelligence(entity.ccn);
    if (task === "ownership") {
      answer.rows.push({
        label: "CMS ownership category",
        value: provider.ownershipType ?? "Not reported in this snapshot",
        source: "CMS Nursing Home Provider Information",
        sourceAsOf: provider.source.freshness.sourceModifiedAt,
      });
      for (const p of evidence.parties)
        answer.rows.push({
          label: `${p.kind}: ${p.roleText}`,
          value: p.displayName,
          date: p.associationDate,
          source: `${p.source.datasetName} / ${p.source.releaseIdentifier}`,
          sourceAsOf: p.source.sourceModifiedAt,
          retrievedAt: p.source.retrievedAt,
        });
      answer.summary = evidence.parties.length
        ? "CMS has indexed ownership or managerial relationships for this provider. Each role and source is shown separately; these are not one inferred current legal owner."
        : "No indexed ownership-party relationship was found in the loaded corpus for this provider. An ownership category is not a named owner.";
      answer.limitations.push(
        "Enrollment disclosures may include individuals, organizations, direct/indirect owners and managers. We do not merge them or determine ultimate beneficial ownership. The category describes a type, not an owner name. Up to 75 source relationship observations are shown; repeated source representations are not a count of unique owners.",
      );
    } else {
      for (const e of evidence.changes)
        answer.rows.push({
          label: e.changeTypeText,
          value: `Reported seller: ${e.sellerName}; reported buyer: ${e.buyerName}`,
          date: e.effectiveDate,
          source: `${e.source.datasetName} / ${e.source.releaseIdentifier}`,
          sourceAsOf: e.source.sourceModifiedAt,
          retrievedAt: e.source.retrievedAt,
        });
      answer.summary = evidence.changes.length
        ? "Indexed CMS CHOW events were found for this provider."
        : "No indexed CHOW event was found in the current research corpus for this provider.";
      answer.limitations.push(
        "A CHOW event is not automatically a sale, proof of current ownership, misconduct or a quality signal. No indexed event does not mean the facility never changed owners. The existing provider report supplies up to 20 event observations.",
      );
    }
  } else {
    const evidence = await getProviderRegulatoryIntelligence(entity.ccn);
    if (task === "penalty")
      for (const e of evidence.penalties) {
        if (e.source.providerIdentifier !== entity.ccn)
          throw new Error("Penalty identity mismatch");
        answer.rows.push({
          label: e.penaltyType,
          value: e.fineAmount
            ? `Source fine amount: ${e.fineAmount}`
            : e.paymentDenialDays !== null
              ? `Source payment-denial days: ${e.paymentDenialDays}`
              : "See source observation",
          date: e.penaltyDate,
          source: `${e.source.datasetName} / ${e.source.releaseIdentifier}`,
          sourceAsOf: e.source.sourceModifiedAt,
          retrievedAt: e.source.retrievedAt,
        });
      }
    else if (task === "inspection")
      for (const e of evidence.inspections) {
        if (e.source.providerIdentifier !== entity.ccn)
          throw new Error("Inspection identity mismatch");
        answer.rows.push({
          label: e.surveyType,
          value: `Source survey cycle: ${e.surveyCycle}`,
          date: e.surveyDate,
          source: `${e.source.datasetName} / ${e.source.releaseIdentifier}`,
          sourceAsOf: e.source.sourceModifiedAt,
          retrievedAt: e.source.retrievedAt,
        });
      }
    else {
      if (!evidence.deficiencies) throw new Error("Deficiency source projection unavailable");
      for (const f of evidence.deficiencies) {
        if (f.source.providerIdentifier !== entity.ccn)
          throw new Error("Deficiency identity mismatch");
        answer.rows.push({
          label: `Deficiency ${f.tag}`,
          value: f.officialDescription ?? "Description not reported",
          source: `${f.source.datasetName} / ${f.source.releaseIdentifier}`,
          sourceAsOf: f.source.sourceModifiedAt,
          retrievedAt: f.source.retrievedAt,
        });
      }
    }
    answer.summary = answer.rows.length
      ? `Indexed ${task} observations were found for this provider in the loaded corpus.`
      : `No indexed ${task} record was found in the current corpus for this provider.`;
    answer.limitations.push(
      "This is not an all-time yes/no finding, proof of a clean history, or a conclusion that the provider has never been fined. Existing report limits apply (100 penalties, 20 inspections and 200 deficiency findings); counts shown are observations, not a quality ranking.",
    );
  }
  return answer;
}
