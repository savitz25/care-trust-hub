import { selectNjProfileEvidence, type NjProfileEvidence } from "@care/domain";

export function NjProfileEvidenceModule({
  ccn,
  state,
  facId,
  licenseNumber,
}: {
  ccn?: string | null;
  state?: string | null;
  facId?: string | null;
  licenseNumber?: string | null;
}) {
  const evidence = selectNjProfileEvidence({ ccn, state, facId, licenseNumber });
  return <NjProfileEvidenceView evidence={evidence} />;
}

export function NjProfileEvidenceView({ evidence }: { evidence: NjProfileEvidence }) {
  if (!evidence.render) return null;
  return (
    <section className="state-license-oversight" aria-labelledby="nj-profile-evidence-title">
      <div className="section-heading">
        <p className="eyebrow">New Jersey state evidence</p>
        <h2 id="nj-profile-evidence-title">New Jersey license and regulatory record</h2>
        <p>
          Shown only when an exact or approved deterministic identity join exists. Unresolved
          enforcement is withheld. This is not a New Jersey endorsement.
        </p>
      </div>
      <ul className="hub-plain-list">
        {evidence.attachments.map((row) => (
          <li key={`${row.kind}-${row.facId ?? row.ccn ?? row.label}`}>
            <strong>{row.label}</strong> — {row.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
