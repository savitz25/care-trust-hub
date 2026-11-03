import Link from "next/link";
import { StructuredData } from "@/components/structured-data";
import type { FacilityProfileModel } from "@/server/care/facility-profile-model";

export function FacilityProfileView({ model }: { model: FacilityProfileModel }) {
  return (
    <section className="facility-profile-lead page-shell" aria-labelledby="facility-lead-title">
      <StructuredData value={model.organization} />
      <StructuredData value={model.breadcrumb} />
      <h2 id="facility-lead-title" className="sr-only">
        Facility record
      </h2>
      <p>{model.lead}</p>
      {model.nearby.length > 0 ? (
        <>
          <h2>Nearby facilities</h2>
          <ul>
            {model.nearby.map((facility) => (
              <li key={facility.ccn}>
                <Link href={facility.href}>{facility.name}</Link>
                {facility.city ? <span> {facility.city}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {model.stateHref ? (
        <p>
          <Link href={model.stateHref}>CMS nursing homes in {model.stateName}</Link>
        </p>
      ) : null}
    </section>
  );
}
