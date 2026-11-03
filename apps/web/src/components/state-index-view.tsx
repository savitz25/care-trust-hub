import { StructuredData } from "@/components/structured-data";
import { dollar, stateIndexItemList, type StateIndexModel } from "@/server/care/state-index-model";

function star(value: number | null) {
  return value == null ? "—" : String(value);
}

export function StateIndexView({ model }: { model: StateIndexModel }) {
  return (
    <section className="state-cms-index" aria-labelledby={`cms-homes-${model.stateCode}`}>
      <StructuredData value={stateIndexItemList(model)} />
      <h2 id={`notable-${model.stateCode}`}>Notable in {model.stateName}</h2>
      <ul>
        {model.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <h2 id={`cms-homes-${model.stateCode}`}>CMS nursing homes in {model.stateName}</h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <caption>
            {model.facilities.length} CMS nursing homes in {model.stateName}, alphabetical
          </caption>
          <thead>
            <tr>
              <th scope="col">Nursing home</th>
              <th scope="col">City</th>
              <th scope="col">Overall star</th>
              <th scope="col">Health inspection</th>
              <th scope="col">Staffing</th>
              <th scope="col">Deficiencies</th>
              <th scope="col">Fine</th>
            </tr>
          </thead>
          <tbody>
            {model.facilities.map((facility) => (
              <tr key={facility.ccn}>
                <th scope="row">
                  <a href={facility.href}>{facility.name}</a>
                </th>
                <td>{facility.city ?? "—"}</td>
                <td>{star(facility.overall)}</td>
                <td>{star(facility.healthInspection)}</td>
                <td>{star(facility.staffing)}</td>
                <td>{facility.deficiencyCount == null ? "—" : facility.deficiencyCount}</td>
                <td>{facility.fineAmount == null ? "—" : dollar(facility.fineAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {model.places.length > 0 ? (
        <>
          <h2 id={`cms-cities-${model.stateCode}`}>
            Cities with the most CMS nursing homes in {model.stateName}
          </h2>
          <ul>
            {model.places.map((place) => (
              <li key={place.name}>
                <a href={place.href}>
                  {place.name}, {place.count.toLocaleString("en-US")} CMS nursing homes
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <aside aria-labelledby={`cms-about-${model.stateCode}`}>
        <h2 id={`cms-about-${model.stateCode}`}>About this data</h2>
        <p>{model.about}</p>
      </aside>
    </section>
  );
}
