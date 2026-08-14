import type { Facility } from "@care/domain";
import { TrendIndicator, StarValue } from "./evidence";

export function FacilityCard({
  facility,
  selected = false,
  compareHref = "/compare",
}: {
  facility: Facility;
  selected?: boolean;
  compareHref?: string;
}) {
  return (
    <article className={`facility-card${selected ? " facility-card--selected" : ""}`}>
      <div className="facility-card__heading">
        <div>
          <p className="kicker">{facility.careType}</p>
          <h2>
            <a href={`/facility/${facility.slug}`}>{facility.name}</a>
          </h2>
          <p>
            {facility.city}, {facility.state} · {facility.distance.toFixed(1)} miles
          </p>
        </div>
        <TrendIndicator trend={facility.trend} />
      </div>
      <dl className="facility-card__metrics">
        <div>
          <dt>CMS overall</dt>
          <dd>
            <StarValue value={facility.cmsOverall} />
          </dd>
        </div>
        <div>
          <dt>Staffing</dt>
          <dd>
            <StarValue value={facility.staffingStars} />
          </dd>
        </div>
        <div>
          <dt>Latest inspection</dt>
          <dd>
            {facility.deficiencies === null
              ? "Limited history"
              : `${facility.deficiencies} deficiencies`}
          </dd>
        </div>
        <div>
          <dt>Recent enforcement</dt>
          <dd>
            {facility.penalties.length ? `${facility.penalties.length} penalty` : "None shown"}
          </dd>
        </div>
        <div>
          <dt>Ownership</dt>
          <dd>{facility.chainName ?? facility.ownershipType}</dd>
        </div>
      </dl>
      <div className="facility-card__actions">
        <a className="button button--primary" href={`/facility/${facility.slug}`}>
          View evidence
        </a>
        <a className="button button--quiet" href={`/facility/${facility.slug}#history`}>
          View history
        </a>
        <a className="button button--quiet" href={compareHref}>
          Compare
        </a>
      </div>
      <p className="source-inline">Synthetic demonstration release · observed July 2026</p>
    </article>
  );
}
