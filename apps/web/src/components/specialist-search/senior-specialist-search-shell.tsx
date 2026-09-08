import Link from "next/link";
import { SearchShellAnalytics } from "./search-shell-analytics";

const EXAMPLES = [
  "CMS CCN 105502",
  "Nursing homes in Palm Beach County",
  "Home health agencies in Florida",
  "Nursing homes with civil monetary penalties",
];

export function SeniorSpecialistSearchShell({
  query = "",
  compact = false,
}: {
  query?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={compact ? "specialist-search specialist-search--compact" : "specialist-search"}
      aria-labelledby={compact ? "home-specialist-search-title" : "specialist-search-title"}
    >
      <p className="eyebrow">Research senior care</p>
      <h2 id={compact ? "home-specialist-search-title" : "specialist-search-title"}>
        What do you want to find out?
      </h2>
      <form
        id="senior-specialist-search"
        action="/ask"
        method="get"
        role="search"
        aria-label="Research senior-care providers"
      >
        <div className="specialist-search__row">
          <label
            className="visually-hidden"
            htmlFor={compact ? "home-senior-search-q" : "senior-search-q"}
          >
            Question, provider name, or CMS CCN
          </label>
          <input
            id={compact ? "home-senior-search-q" : "senior-search-q"}
            name="q"
            type="search"
            maxLength={180}
            defaultValue={query}
            placeholder="Ask a question, enter a provider, CMS CCN, city, county or state..."
            required
          />
          <button className="button button--primary" type="submit">
            Research
          </button>
        </div>
        <details className="specialist-search__filters">
          <summary>Advanced filters</summary>
          <div className="specialist-search__filter-grid">
            <label>
              Provider class
              <select name="class" defaultValue="">
                <option value="">Interpret from question</option>
                <option value="nursing_home">Nursing Home</option>
                <option value="home_health">Home Health</option>
                <option value="hospice">Hospice</option>
              </select>
            </label>
            <label>
              Recorded state
              <select name="state" defaultValue="">
                <option value="">Any supported state</option>
                <option value="FL">Florida</option>
                <option value="NJ">New Jersey</option>
                <option value="CA">California</option>
                <option value="TX">Texas</option>
                <option value="WA">Washington</option>
                <option value="AZ">Arizona</option>
              </select>
            </label>
            <label>
              Evidence / metric
              <select name="evidence" defaultValue="">
                <option value="">Any supported evidence</option>
                <option value="deficiencies">Indexed deficiencies · Nursing Home</option>
                <option value="penalties">Civil monetary penalties · Nursing Home</option>
                <option value="staffing">Staffing HPRD · Nursing Home</option>
                <option value="chow">CHOW · Nursing Home</option>
                <option value="hhcahps">HHCAHPS · Home Health</option>
                <option value="hospice_cahps">CAHPS · Hospice</option>
              </select>
            </label>
            <label>
              CMS metric
              <select name="stars" defaultValue="">
                <option value="">Any supported value</option>
                <option value="5_overall">5 overall stars · Nursing Home</option>
                <option value="5_staffing">5 staffing stars · Nursing Home</option>
                <option value="5_inspection">5 inspection stars · Nursing Home</option>
              </select>
            </label>
          </div>
        </details>
      </form>
      <SearchShellAnalytics />
      <nav className="senior-ask__examples" aria-label="Example senior-care research questions">
        {EXAMPLES.map((example) => (
          <Link key={example} href={`/ask?q=${encodeURIComponent(example)}`}>
            {example}
          </Link>
        ))}
      </nav>
      <p className="hub-kicker">
        Natural language is mapped to a structured plan over acquired CMS and state evidence.
        Provider classes stay separate; missing evidence is not zero.
      </p>
    </section>
  );
}
