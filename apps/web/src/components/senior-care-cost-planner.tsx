"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CMS_CERTIFIED_FACILITY_COUNT,
  COST_PLANNER_VERSION,
  MEDICARE_SNF_2026,
  MEMORY_CARE_CONTEXT,
  NATIONAL_ASSISTED_LIVING_MONTHLY,
  NATIONAL_HOME_CARE_HOURLY,
  NATIONAL_SNF_PRIVATE_DAILY,
  NATIONAL_SNF_SEMI_PRIVATE_DAILY,
  calculateAssistedLiving,
  calculateBreakEvenHomeCareHours,
  calculateHomeCare,
  calculateMemoryCare,
  calculateShortTermRehab,
  calculateSkilledNursing,
  compareScenarioCosts,
  isInterviewCareSetting,
  type CostScenarioResult,
  type InterviewCareSetting,
  type SupportOffsets,
} from "@care/domain";
import { PrintButton } from "./print-button";
import {
  PLANNER_SCENARIOS,
  readPlannerScenarios,
  type PlannerScenarioId,
} from "./cost-planner-bridge";
import { INTERVIEW_BUILDER_PATH, storeInterviewBuilderSeed } from "./interview-builder-bridge";

export const COST_PLANNER_DISCLAIMER =
  "SeniorTrustHub's Senior Care Cost Planner is educational planning information. It is not a provider quote, financial advice, or a determination of Medicare, Medicaid, VA, or long-term-care insurance benefits.";

const SCENARIO_LABELS: Record<PlannerScenarioId, string> = {
  home_care: "Care at home",
  assisted_living: "Assisted living",
  memory_care: "Memory care",
  skilled_nursing: "Skilled nursing",
  short_term_rehab: "Short-term rehabilitation",
};

function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function subscribe() {
  return () => undefined;
}

function plannerSelectionSnapshot(): string {
  const stored = readPlannerScenarios();
  return (stored.length ? stored : ["home_care", "assisted_living"]).join(",");
}

function numberOrEmpty(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function SeniorCareCostPlanner({
  navigatorEnabled = false,
  interviewBuilderEnabled = false,
}: {
  navigatorEnabled?: boolean;
  interviewBuilderEnabled?: boolean;
}) {
  const headingId = useId();
  const storedSelection = useSyncExternalStore(
    subscribe,
    plannerSelectionSnapshot,
    () => "home_care,assisted_living",
  );
  const [selectedOverride, setSelectedOverride] = useState<PlannerScenarioId[] | null>(null);
  const selected =
    selectedOverride ??
    storedSelection.split(",").filter((value): value is PlannerScenarioId => Boolean(value));
  const [stateCode, setStateCode] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("4");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [useCustomHomeRate, setUseCustomHomeRate] = useState(false);
  const [customHomeRate, setCustomHomeRate] = useState("");
  const [useCustomAl, setUseCustomAl] = useState(false);
  const [customAl, setCustomAl] = useState("");
  const [alAddon, setAlAddon] = useState("");
  const [alFee, setAlFee] = useState("");
  const [memoryMonthly, setMemoryMonthly] = useState("");
  const [snfRoom, setSnfRoom] = useState<"semi_private" | "private">("semi_private");
  const [useCustomSnf, setUseCustomSnf] = useState(false);
  const [customSnfDaily, setCustomSnfDaily] = useState("");
  const [rehabOOP, setRehabOOP] = useState("");
  const [ltc, setLtc] = useState("");
  const [va, setVa] = useState("");
  const [medicaid, setMedicaid] = useState("");
  const [family, setFamily] = useState("");
  const [other, setOther] = useState("");

  const computed = useMemo(() => {
    const geography = stateCode.trim() ? { stateCode: stateCode.trim() } : undefined;
    const offsets: SupportOffsets = {
      ltcInsuranceMonthly: numberOrEmpty(ltc),
      vaBenefitMonthly: numberOrEmpty(va),
      medicaidContributionMonthly: numberOrEmpty(medicaid),
      familyContributionMonthly: numberOrEmpty(family),
      otherSupportMonthly: numberOrEmpty(other),
    };
    const results: CostScenarioResult[] = [];
    const errors: string[] = [];
    if (selected.includes("home_care")) {
      try {
        results.push(
          calculateHomeCare({
            scenarioName: `Home + ${hoursPerDay || "0"} hrs/day`,
            hoursPerDay: Number(hoursPerDay || 0),
            daysPerWeek: Number(daysPerWeek || 0),
            customHourlyRate: useCustomHomeRate ? numberOrEmpty(customHomeRate) : undefined,
            offsets,
            geography,
          }),
        );
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Home-care inputs need attention.");
      }
    }
    if (selected.includes("assisted_living")) {
      try {
        results.push(
          calculateAssistedLiving({
            scenarioName: "Assisted living",
            customMonthlyRate: useCustomAl ? numberOrEmpty(customAl) : undefined,
            careAddonMonthly: numberOrEmpty(alAddon),
            communityFeeOneTime: numberOrEmpty(alFee),
            offsets,
            geography,
          }),
        );
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Assisted-living inputs need attention.",
        );
      }
    }
    if (selected.includes("memory_care")) {
      const custom = numberOrEmpty(memoryMonthly);
      if (custom === undefined) {
        errors.push(
          "Enter a monthly memory-care amount. No national memory-care median is published in this version.",
        );
      } else {
        try {
          results.push(
            calculateMemoryCare({
              scenarioName: "Memory care",
              customMonthlyRate: custom,
              offsets,
              geography,
            }),
          );
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "Memory-care inputs need attention.",
          );
        }
      }
    }
    if (selected.includes("skilled_nursing")) {
      try {
        results.push(
          calculateSkilledNursing({
            scenarioName:
              snfRoom === "private"
                ? "Skilled nursing, private room"
                : "Skilled nursing, semi-private",
            room: snfRoom,
            customDailyRate: useCustomSnf ? numberOrEmpty(customSnfDaily) : undefined,
            offsets,
            geography,
          }),
        );
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Skilled-nursing inputs need attention.",
        );
      }
    }
    if (selected.includes("short_term_rehab")) {
      try {
        results.push(
          calculateShortTermRehab({
            scenarioName: "Short-term rehabilitation",
            expectedOutOfPocket: numberOrEmpty(rehabOOP) ?? 0,
            offsets,
            geography,
          }),
        );
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : "Rehabilitation inputs need attention.",
        );
      }
    }
    const breakEven =
      selected.includes("home_care") && selected.includes("assisted_living")
        ? calculateBreakEvenHomeCareHours({
            assistedLivingMonthly: results.find((item) => item.setting === "assisted_living")
              ?.monthly,
            homeCareHourlyRate:
              (results.find((item) => item.setting === "home_care")?.inputs.hourlyRateUsed as
                | number
                | undefined) ?? NATIONAL_HOME_CARE_HOURLY.value,
            geography,
          })
        : null;
    return { results, errors, rows: compareScenarioCosts(results), breakEven };
  }, [
    selected,
    hoursPerDay,
    daysPerWeek,
    useCustomHomeRate,
    customHomeRate,
    useCustomAl,
    customAl,
    alAddon,
    alFee,
    memoryMonthly,
    snfRoom,
    useCustomSnf,
    customSnfDaily,
    rehabOOP,
    ltc,
    va,
    medicaid,
    family,
    other,
    stateCode,
  ]);

  const showNursingBridge =
    selected.includes("skilled_nursing") || selected.includes("short_term_rehab");
  const homeResult = computed.results.find((item) => item.setting === "home_care");

  function toggleScenario(id: PlannerScenarioId) {
    const current = selected;
    setSelectedOverride(
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <div className="cost-planner">
      <header className="care-navigator">
        <p className="eyebrow">Senior Care Cost Planner</p>
        <h1 id={headingId}>Senior Care Cost Planner</h1>
        <p className="lede">
          Compare the potential cost of care at home, assisted living, memory care, and skilled
          nursing using transparent assumptions and published benchmarks.
        </p>
        <p className="care-navigator__disclaimer">{COST_PLANNER_DISCLAIMER}</p>
        {navigatorEnabled ? (
          <p>
            <Link href="/tools/care-needs-navigator">
              Not sure what kind of care to compare? Use the Care Needs Navigator
            </Link>
          </p>
        ) : null}
      </header>

      <form className="cost-planner__form" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="care-navigator__question">
          <legend>Which scenarios do you want to compare?</legend>
          <div className="care-navigator__options">
            {PLANNER_SCENARIOS.map((id) => (
              <label key={id} htmlFor={`scenario-${id}`}>
                <input
                  id={`scenario-${id}`}
                  type="checkbox"
                  checked={selected.includes(id)}
                  onChange={() => toggleScenario(id)}
                />
                <span>{SCENARIO_LABELS[id]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="cost-planner__field">
          Optional state for geography label
          <input
            type="text"
            inputMode="text"
            maxLength={2}
            value={stateCode}
            onChange={(event) => setStateCode(event.target.value.toUpperCase())}
            aria-describedby="state-help"
          />
        </label>
        <p id="state-help">
          This version uses national CareScout 2025 medians. A state code only changes the geography
          label and fallback note. ZIP prices are not invented.
        </p>

        {selected.includes("home_care") && (
          <fieldset className="care-navigator__question">
            <legend>Care at home</legend>
            <label className="cost-planner__field">
              Hours per day
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={hoursPerDay}
                onChange={(event) => setHoursPerDay(event.target.value)}
              />
            </label>
            <label className="cost-planner__field">
              Days per week
              <input
                type="number"
                min={0}
                max={7}
                step={1}
                value={daysPerWeek}
                onChange={(event) => setDaysPerWeek(event.target.value)}
              />
            </label>
            <label htmlFor="custom-home-rate">
              <input
                id="custom-home-rate"
                type="checkbox"
                checked={useCustomHomeRate}
                onChange={(event) => setUseCustomHomeRate(event.target.checked)}
              />{" "}
              Use my own hourly rate
            </label>
            {useCustomHomeRate ? (
              <label className="cost-planner__field">
                Custom hourly rate
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={customHomeRate}
                  onChange={(event) => setCustomHomeRate(event.target.value)}
                />
              </label>
            ) : (
              <p>
                Published hourly benchmark: {money(NATIONAL_HOME_CARE_HOURLY.value)} (
                {NATIONAL_HOME_CARE_HOURLY.source.publicationYear} national median).
              </p>
            )}
          </fieldset>
        )}

        {selected.includes("assisted_living") && (
          <fieldset className="care-navigator__question">
            <legend>Assisted living</legend>
            <p>
              Published monthly benchmark: {money(NATIONAL_ASSISTED_LIVING_MONTHLY.value)} (
              {NATIONAL_ASSISTED_LIVING_MONTHLY.source.publicationYear} national median). Actual
              provider pricing varies with service level and what is included.
            </p>
            <label htmlFor="custom-al">
              <input
                id="custom-al"
                type="checkbox"
                checked={useCustomAl}
                onChange={(event) => setUseCustomAl(event.target.checked)}
              />{" "}
              Use my own monthly rate
            </label>
            {useCustomAl ? (
              <label className="cost-planner__field">
                Custom monthly rate
                <input
                  type="number"
                  min={0}
                  value={customAl}
                  onChange={(event) => setCustomAl(event.target.value)}
                />
              </label>
            ) : null}
            <label className="cost-planner__field">
              Optional monthly care add-on
              <input
                type="number"
                min={0}
                value={alAddon}
                onChange={(event) => setAlAddon(event.target.value)}
              />
            </label>
            <label className="cost-planner__field">
              Optional one-time community / entrance fee
              <input
                type="number"
                min={0}
                value={alFee}
                onChange={(event) => setAlFee(event.target.value)}
              />
            </label>
          </fieldset>
        )}

        {selected.includes("memory_care") && (
          <fieldset className="care-navigator__question">
            <legend>Memory care</legend>
            <p>{MEMORY_CARE_CONTEXT}</p>
            <label className="cost-planner__field">
              Monthly amount you want to plan with
              <input
                type="number"
                min={0}
                value={memoryMonthly}
                onChange={(event) => setMemoryMonthly(event.target.value)}
              />
            </label>
          </fieldset>
        )}

        {selected.includes("skilled_nursing") && (
          <fieldset className="care-navigator__question">
            <legend>Skilled nursing</legend>
            <p>
              These are national private-pay planning medians, not SeniorTrustHub facility-specific
              rates. Semi-private {money(NATIONAL_SNF_SEMI_PRIVATE_DAILY.value)}/day · private{" "}
              {money(NATIONAL_SNF_PRIVATE_DAILY.value)}/day (
              {NATIONAL_SNF_SEMI_PRIVATE_DAILY.source.publicationYear}).
            </p>
            <label className="cost-planner__field">
              Room type
              <select
                value={snfRoom}
                onChange={(event) => setSnfRoom(event.target.value as "semi_private" | "private")}
              >
                <option value="semi_private">Semi-private</option>
                <option value="private">Private</option>
              </select>
            </label>
            <label htmlFor="custom-snf">
              <input
                id="custom-snf"
                type="checkbox"
                checked={useCustomSnf}
                onChange={(event) => setUseCustomSnf(event.target.checked)}
              />{" "}
              Use my own daily rate
            </label>
            {useCustomSnf ? (
              <label className="cost-planner__field">
                Custom daily rate
                <input
                  type="number"
                  min={0}
                  value={customSnfDaily}
                  onChange={(event) => setCustomSnfDaily(event.target.value)}
                />
              </label>
            ) : null}
          </fieldset>
        )}

        {selected.includes("short_term_rehab") && (
          <fieldset className="care-navigator__question">
            <legend>Short-term rehabilitation</legend>
            <p>
              Costs may depend on Medicare qualification, coinsurance, supplemental coverage, the
              payer, and clinical eligibility. CMS published 2026 SNF coinsurance of{" "}
              {money(MEDICARE_SNF_2026.snfDays21to100DailyCoinsurance)} per day for days 21–100 of a
              qualifying stay. This planner does not determine benefits or guarantee Medicare
              payment.
            </p>
            <label className="cost-planner__field">
              Optional expected monthly planning amount
              <input
                type="number"
                min={0}
                value={rehabOOP}
                onChange={(event) => setRehabOOP(event.target.value)}
              />
            </label>
          </fieldset>
        )}

        <fieldset className="care-navigator__question">
          <legend>Known monthly support (optional)</legend>
          <p>Enter only amounts you already know. Do not guess eligibility.</p>
          <label className="cost-planner__field">
            Long-term-care insurance
            <input
              type="number"
              min={0}
              value={ltc}
              onChange={(event) => setLtc(event.target.value)}
            />
          </label>
          <label className="cost-planner__field">
            Known VA support
            <input
              type="number"
              min={0}
              value={va}
              onChange={(event) => setVa(event.target.value)}
            />
          </label>
          <label className="cost-planner__field">
            Known Medicaid contribution
            <input
              type="number"
              min={0}
              value={medicaid}
              onChange={(event) => setMedicaid(event.target.value)}
            />
          </label>
          <label className="cost-planner__field">
            Family contribution
            <input
              type="number"
              min={0}
              value={family}
              onChange={(event) => setFamily(event.target.value)}
            />
          </label>
          <label className="cost-planner__field">
            Other confirmed support
            <input
              type="number"
              min={0}
              value={other}
              onChange={(event) => setOther(event.target.value)}
            />
          </label>
        </fieldset>
      </form>

      <section className="cost-planner__results" aria-labelledby="comparison-title">
        <div className="care-navigator__actions">
          <PrintButton label="Print / Save as PDF" />
        </div>
        <h2 id="comparison-title">Side-by-side planning comparison</h2>
        {computed.errors.map((error) => (
          <p key={error} className="care-navigator__urgent" role="status">
            {error}
          </p>
        ))}
        {computed.rows.length > 0 ? (
          <div className="cost-planner__table-wrap">
            <table>
              <caption>
                Monthly and annual planning estimates. These are not guaranteed out-of-pocket costs.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Scenario</th>
                  <th scope="col">Gross monthly</th>
                  <th scope="col">Gross annual</th>
                  <th scope="col">Remaining monthly</th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.map((row) => (
                  <tr key={row.scenarioName}>
                    <th scope="row">{row.scenarioName}</th>
                    <td data-label="Gross monthly">{money(row.monthly)}</td>
                    <td data-label="Gross annual">{money(row.annual)}</td>
                    <td data-label="Remaining monthly">{money(row.remainingPlanningAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Select at least one scenario to compare.</p>
        )}

        {homeResult && (
          <p>
            Home-care math: {homeResult.inputs.hoursPerDay} hours/day ×{" "}
            {homeResult.inputs.daysPerWeek} days/week ×{" "}
            {money(Number(homeResult.inputs.hourlyRateUsed))}
            /hour = {money(homeResult.weekly ?? 0)} weekly, {money(homeResult.monthly)} monthly,{" "}
            {money(homeResult.annual)} annual.
          </p>
        )}
        {computed.results
          .filter((item) => item.warnings.length)
          .map((item) => (
            <p key={`${item.setting}-warn`} className="care-navigator__urgent" role="status">
              {item.warnings.join(" ")}
            </p>
          ))}

        {computed.breakEven && (
          <aside>
            <h2>Break-even insight</h2>
            <p>
              At your assumptions, paid home care reaches the assisted-living benchmark at
              approximately {computed.breakEven.hoursPerWeek} hours/week.
            </p>
            <p>
              Assumptions: assisted-living monthly {money(computed.breakEven.assistedLivingMonthly)}
              , home-care hourly {money(computed.breakEven.homeCareHourlyRate)}.{" "}
              {computed.breakEven.formula}. {computed.breakEven.note}
            </p>
          </aside>
        )}

        <h2>What drives this estimate?</h2>
        {computed.results.map((item) => (
          <article key={item.setting}>
            <h3>{item.scenarioName}</h3>
            <p>
              <strong>Gross planning estimate:</strong> {money(item.monthly)} / month,{" "}
              {money(item.annual)} / year
              {item.oneTimeCosts > 0 ? `, plus ${money(item.oneTimeCosts)} one-time` : ""}.
            </p>
            <p>
              <strong>User-entered support:</strong> {money(item.supportOffsetsMonthly)} / month.
            </p>
            <p>
              <strong>Remaining planning amount:</strong> {money(item.remainingPlanningAmount)} /
              month. This is not a promised out-of-pocket cost.
            </p>
            <ul>
              <li>
                {item.benchmark.customOverride ? "User-entered rate" : "Published benchmark"}:{" "}
                {item.benchmark.valueUsed == null ? "none" : money(item.benchmark.valueUsed)}{" "}
                {item.benchmark.unit}
                {item.benchmark.publishedValue != null
                  ? ` (published ${item.benchmark.statistic} ${money(item.benchmark.publishedValue)})`
                  : ""}
              </li>
              <li>
                Source: {item.benchmark.sourceOrganization}
                {item.benchmark.publicationYear ? `, ${item.benchmark.publicationYear}` : ""}
              </li>
              <li>Geography: {item.geography.basis}</li>
              {item.methodologyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        ))}

        <h2>Questions to ask providers</h2>
        {interviewBuilderEnabled ? (
          <p>
            <Link
              className="button button--secondary"
              href={INTERVIEW_BUILDER_PATH}
              onClick={() =>
                storeInterviewBuilderSeed({
                  setting:
                    selected.length === 1 && isInterviewCareSetting(selected[0] ?? "")
                      ? (selected[0] as InterviewCareSetting)
                      : undefined,
                  concerns: ["cost"],
                })
              }
            >
              Questions to ask about pricing and fees →
            </Link>
          </p>
        ) : null}
        {selected.includes("home_care") && (
          <>
            <h3>Home care</h3>
            <ul>
              <li>Is there a minimum shift?</li>
              <li>What are weekend or holiday rates?</li>
              <li>How is overnight care priced?</li>
              <li>Are transportation or mileage charges separate?</li>
              <li>When do care-level rate changes apply?</li>
            </ul>
          </>
        )}
        {(selected.includes("assisted_living") || selected.includes("memory_care")) && (
          <>
            <h3>Assisted living / memory care</h3>
            <ul>
              <li>What is included in the base rate?</li>
              <li>How are care-tier charges billed?</li>
              <li>Are medication fees extra?</li>
              <li>Is there an entrance or community fee?</li>
              <li>How often can rates change?</li>
            </ul>
            <p>
              SeniorTrustHub does not yet have equivalent national provider-level assisted-living or
              memory-care evidence coverage. Use these questions with local communities. This is not
              the same as the CMS-certified nursing facility directory.
            </p>
          </>
        )}
        {(selected.includes("skilled_nursing") || selected.includes("short_term_rehab")) && (
          <>
            <h3>Nursing facility</h3>
            <ul>
              <li>What is the private-pay daily rate?</li>
              <li>What is the difference between private and semi-private rooms?</li>
              <li>Which services are included, and which are billed separately?</li>
              <li>What happens when Medicare coverage ends?</li>
              <li>Does the facility participate in Medicaid?</li>
            </ul>
          </>
        )}

        {showNursingBridge && (
          <aside className="care-navigator__bridge">
            <h2>Research CMS-certified nursing facilities</h2>
            <p>
              SeniorTrustHub can help compare staffing, inspections, penalties, Facility History,
              ownership, and state evidence where available across{" "}
              {CMS_CERTIFIED_FACILITY_COUNT.toLocaleString("en-US")} CMS-certified nursing
              facilities. It does not know each facility&apos;s actual private-pay price.
            </p>
            <Link className="button button--primary" href="/search">
              Search nursing facilities near me
            </Link>
          </aside>
        )}

        <section id="cost-methodology">
          <h2>Cost data &amp; methodology</h2>
          <p>Methodology version {COST_PLANNER_VERSION}.</p>
          <ul>
            <li>
              Private-pay medians: {NATIONAL_HOME_CARE_HOURLY.source.organization},{" "}
              {NATIONAL_HOME_CARE_HOURLY.source.title} (
              {NATIONAL_HOME_CARE_HOURLY.source.publicationYear}
              ), national. <a href={NATIONAL_HOME_CARE_HOURLY.source.url}>View source</a>
            </li>
            <li>
              Medicare SNF cost-sharing: CMS 2026 Parts A &amp; B fact sheet. Medicare may cover
              qualifying skilled care when requirements are met. This tool does not decide
              eligibility.
            </li>
            <li>Monthly home-care conversion uses 52 / 12 weeks per month.</li>
            <li>
              Limitations: national medians are not local quotes; custom rates replace the published
              value only when you enter them; household costs and eligibility are outside this
              calculator unless you type a known amount.
            </li>
          </ul>
        </section>
      </section>
    </div>
  );
}
