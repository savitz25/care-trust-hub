"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CMS_CERTIFIED_FACILITY_COUNT,
  NAVIGATOR_DISCLAIMER,
  evaluateCareNeeds,
  type CareNeedsAnswers,
  type CareNeedsResult,
} from "@care/domain";
import { PrintButton } from "./print-button";
import { NAVIGATOR_QUESTIONS, QUESTION_STEPS } from "./care-needs-navigator-questions";
import {
  COST_PLANNER_PATH,
  mapNavigatorSettingsToPlanner,
  storePlannerScenarios,
} from "./cost-planner-bridge";
import {
  INTERVIEW_BUILDER_PATH,
  mapNavigatorSettingToInterview,
  storeInterviewBuilderSeed,
} from "./interview-builder-bridge";

type Phase = "start" | "questions" | "results";

function questionsForStep(stepId: string, answers: CareNeedsAnswers) {
  return NAVIGATOR_QUESTIONS.filter(
    (question) => question.step === stepId && (!question.showWhen || question.showWhen(answers)),
  );
}

function stepComplete(stepId: string, answers: CareNeedsAnswers): boolean {
  return questionsForStep(stepId, answers).every(
    (question) => question.optional || Boolean(answers[question.id]),
  );
}

export function CareNeedsNavigator({
  plannerEnabled = false,
  interviewBuilderEnabled = false,
}: {
  plannerEnabled?: boolean;
  interviewBuilderEnabled?: boolean;
}) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<CareNeedsAnswers>({});
  const [result, setResult] = useState<CareNeedsResult | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, stepIndex]);

  const step = QUESTION_STEPS[stepIndex]!;
  const visibleQuestions = useMemo(() => questionsForStep(step.id, answers), [answers, step.id]);
  const canContinue = stepComplete(step.id, answers);

  function updateAnswer(id: keyof CareNeedsAnswers, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function finish() {
    setResult(evaluateCareNeeds(answers));
    setPhase("results");
  }

  function reset() {
    setAnswers({});
    setResult(null);
    setStepIndex(0);
    setPhase("start");
  }

  if (phase === "start") {
    return (
      <section className="care-navigator" aria-labelledby={headingId}>
        <p className="eyebrow">Care Needs Navigator</p>
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>
          What kind of senior care should I look into?
        </h1>
        <p className="lede">
          Senior care can be confusing. Answer a few questions about everyday activities, memory and
          safety, medical needs, and available support. We will explain which types of care may be
          worth investigating and why.
        </p>
        <p>About 3 to 5 minutes. No account, email, or patient name is required.</p>
        <p className="care-navigator__disclaimer">{NAVIGATOR_DISCLAIMER}</p>
        <div className="care-navigator__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => setPhase("questions")}
          >
            Start Care Needs Navigator
          </button>
          <a className="text-link" href="#about-navigator">
            About this tool
          </a>
        </div>
        <div id="about-navigator" className="care-navigator__about">
          <h2>About this tool</h2>
          <p>
            This is an educational guide to the care landscape. It does not diagnose, determine
            medical necessity, or say where an older adult belongs. Answers stay in this browser
            session and are not sold as a lead.
          </p>
        </div>
      </section>
    );
  }

  if (phase === "results" && result) {
    const investigating = result.recommendations.filter(
      (item) => item.alignment !== "less_aligned",
    );
    const lessAligned = result.recommendations.filter((item) => item.alignment === "less_aligned");
    return (
      <section className="care-navigator care-navigator--results" aria-labelledby={headingId}>
        <p className="eyebrow">Your care-needs summary</p>
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>
          Based on the needs you described, these care settings may be worth investigating.
        </h1>
        <p>{result.summary}</p>
        {result.urgentSafetyMessage ? (
          <p className="care-navigator__urgent" role="status">
            {result.urgentSafetyMessage}
          </p>
        ) : null}
        <p className="care-navigator__disclaimer">{result.disclaimer}</p>
        <div className="care-navigator__actions">
          <PrintButton label="Print / Save as PDF" />
          <button
            className="button button--quiet"
            type="button"
            onClick={() => setPhase("questions")}
          >
            Revise answers
          </button>
          <button className="button button--quiet" type="button" onClick={reset}>
            Start over
          </button>
        </div>

        <h2>Care settings worth investigating</h2>
        <ol className="care-navigator__settings">
          {investigating.map((item) => (
            <li key={item.setting}>
              <article>
                <p className="eyebrow">{item.alignmentLabel}</p>
                <h3>{item.title}</h3>
                <h4>Why this may fit</h4>
                <ul>
                  {item.why.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <h4>What it provides</h4>
                <ul>
                  {item.provides.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <h4>What it does not necessarily provide</h4>
                <ul>
                  {item.doesNotProvide.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {item.coverageNote ? <p>{item.coverageNote}</p> : null}
                {item.nextActionHref ? (
                  <p>
                    <Link className="button button--secondary" href={item.nextActionHref}>
                      {item.nextActionLabel}
                    </Link>
                  </p>
                ) : (
                  <p>{item.nextActionLabel}</p>
                )}
              </article>
            </li>
          ))}
        </ol>

        {result.alternatives.length > 0 && (
          <>
            <h2>What may still work</h2>
            <ul>
              {result.alternatives.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}

        {plannerEnabled ? (
          <p>
            <Link
              className="button button--secondary"
              href={COST_PLANNER_PATH}
              onClick={() =>
                storePlannerScenarios(
                  mapNavigatorSettingsToPlanner(investigating.map((item) => item.setting)),
                )
              }
            >
              Compare the cost of these care options →
            </Link>
          </p>
        ) : null}
        {interviewBuilderEnabled ? (
          <p>
            <Link
              className="button button--secondary"
              href={INTERVIEW_BUILDER_PATH}
              onClick={() =>
                storeInterviewBuilderSeed({
                  setting:
                    mapNavigatorSettingToInterview(investigating.map((item) => item.setting)) ??
                    undefined,
                })
              }
            >
              Build questions to ask providers →
            </Link>
          </p>
        ) : null}

        <h2>Questions to ask a professional</h2>
        <ul>
          {result.professionalQuestions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>

        {result.showSkilledNursingBridge && (
          <aside className="care-navigator__bridge">
            <h2>Research CMS-certified nursing facilities</h2>
            <p>
              SeniorTrustHub currently covers {CMS_CERTIFIED_FACILITY_COUNT.toLocaleString("en-US")}{" "}
              CMS-certified nursing facilities nationally. You can review staffing, inspections,
              penalties, Facility History, ownership, and state regulatory evidence where available.
              SeniorTrustHub does not determine which facility is medically appropriate.
            </p>
            <Link className="button button--primary" href="/search">
              Search nursing facilities near me
            </Link>
          </aside>
        )}

        {lessAligned.length > 0 && (
          <details>
            <summary>Settings that look less aligned with the needs described</summary>
            <ul>
              {lessAligned.map((item) => (
                <li key={item.setting}>
                  <strong>{item.title}.</strong> {item.why[0]}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    );
  }

  return (
    <form
      className="care-navigator"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canContinue) return;
        if (stepIndex + 1 < QUESTION_STEPS.length) setStepIndex((index) => index + 1);
        else finish();
      }}
    >
      <p className="eyebrow">
        Step {stepIndex + 1} of {QUESTION_STEPS.length}
      </p>
      <progress
        className="care-navigator__progress"
        max={QUESTION_STEPS.length}
        value={stepIndex + 1}
      >
        {stepIndex + 1} of {QUESTION_STEPS.length}
      </progress>
      <h1 id={headingId} ref={headingRef} tabIndex={-1}>
        {step.title}
      </h1>
      <p>{step.blurb}</p>
      {visibleQuestions.map((question) => (
        <fieldset key={question.id} className="care-navigator__question">
          <legend>
            {question.prompt}
            {question.optional ? " (optional)" : ""}
          </legend>
          <div className="care-navigator__options">
            {question.options.map((option) => {
              const optionId = `${question.id}-${option.value}`;
              return (
                <label key={option.value} htmlFor={optionId}>
                  <input
                    id={optionId}
                    type="radio"
                    name={question.id}
                    value={option.value}
                    checked={answers[question.id] === option.value}
                    onChange={() => updateAnswer(question.id, option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <div className="care-navigator__actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            if (stepIndex === 0) setPhase("start");
            else setStepIndex((index) => index - 1);
          }}
        >
          Back
        </button>
        <button className="button button--primary" type="submit" disabled={!canContinue}>
          {stepIndex + 1 < QUESTION_STEPS.length ? "Continue" : "See care settings to investigate"}
        </button>
      </div>
    </form>
  );
}
