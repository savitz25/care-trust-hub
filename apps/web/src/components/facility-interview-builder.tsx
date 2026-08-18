"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  BUILDER_CONCERN_CHOICES,
  CARE_SETTING_LABELS,
  CONCERN_TAG_LABELS,
  INTERVIEW_DISCLAIMER,
  buildInterviewChecklist,
  type InterviewCareSetting,
  type InterviewChecklist,
  type InterviewChecklistQuestion,
  type InterviewConcernTag,
  type PublishedFacilityInterviewEvidence,
} from "@care/domain";
import { PrintButton } from "./print-button";
import {
  evidenceSectionHref,
  readCheckedQuestionIds,
  readHiddenQuestionIds,
  interviewBuilderSeedSnapshot,
  parseInterviewBuilderSeed,
  readQuestionNotes,
  subscribeInterviewBuilderSeed,
  writeCheckedQuestionIds,
  writeHiddenQuestionIds,
  writeQuestionNotes,
} from "./interview-builder-bridge";

const CARE_SETTING_OPTIONS: readonly InterviewCareSetting[] = [
  "skilled_nursing",
  "short_term_rehab",
  "assisted_living",
  "memory_care",
  "home_care",
];

type Phase = "setup" | "checklist";

export interface FacilityInterviewBuilderProps {
  facilityName?: string | null;
  facilityCcn?: string | null;
  facilityHref?: string | null;
  facilityEvidence?: PublishedFacilityInterviewEvidence | null;
  navigatorEnabled?: boolean;
  plannerEnabled?: boolean;
}

function persistLocalState(
  checked: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
  notes: Record<string, string>,
) {
  writeCheckedQuestionIds(checked);
  writeHiddenQuestionIds(hidden);
  writeQuestionNotes(notes);
}

function QuestionCard({
  question,
  facilityHref,
  checked,
  note,
  onToggle,
  onHide,
  onNote,
}: {
  question: InterviewChecklistQuestion;
  facilityHref?: string | null;
  checked: boolean;
  note: string;
  onToggle: () => void;
  onHide: () => void;
  onNote: (value: string) => void;
}) {
  const checkboxId = `question-${question.id}`;
  const noteId = `${checkboxId}-note`;
  const evidenceHref =
    question.evidenceBasis && facilityHref
      ? evidenceSectionHref(facilityHref, question.evidenceBasis.evidencePathHint)
      : null;
  const evidenceLabel =
    question.evidenceBasis?.evidencePathHint === "staffing"
      ? "View staffing history"
      : question.evidenceBasis?.evidencePathHint === "inspections"
        ? "View inspections"
        : question.evidenceBasis?.evidencePathHint === "penalties"
          ? "View penalties"
          : question.evidenceBasis?.evidencePathHint === "ownership"
            ? "View ownership"
            : question.evidenceBasis?.evidencePathHint === "state"
              ? "View state license & oversight"
              : "View facility history";

  return (
    <article className="interview-builder__question">
      <div className="interview-builder__question-row">
        <input id={checkboxId} type="checkbox" checked={checked} onChange={onToggle} />
        <div>
          <p className="interview-builder__category">{question.categoryLabel}</p>
          <label htmlFor={checkboxId}>
            <span className="interview-builder__prompt">{question.text}</span>
          </label>
          {question.evidenceBasis ? (
            <p className="interview-builder__evidence">
              <strong>Why this is on the list. </strong>
              {question.evidenceBasis.summary}
            </p>
          ) : null}
          <details>
            <summary>Why ask?</summary>
            <p>{question.whyAsk}</p>
            {question.followUp ? <p>{question.followUp}</p> : null}
          </details>
          {evidenceHref ? (
            <p>
              <strong>Evidence: </strong>
              <Link href={evidenceHref}>{evidenceLabel} →</Link>
            </p>
          ) : null}
          <div className="interview-builder__note">
            <label htmlFor={noteId}>Notes for this question</label>
            <textarea
              id={noteId}
              rows={2}
              value={note}
              onChange={(event) => onNote(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="interview-builder__note-lines" aria-hidden="true">
            <span />
            <span />
          </div>
          <button className="text-link interview-builder__hide" type="button" onClick={onHide}>
            Hide this question
          </button>
        </div>
      </div>
    </article>
  );
}

function QuestionGroup({
  title,
  questions,
  facilityHref,
  checked,
  hidden,
  notes,
  onToggle,
  onHide,
  onNote,
}: {
  title: string;
  questions: readonly InterviewChecklistQuestion[];
  facilityHref?: string | null;
  checked: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  notes: Record<string, string>;
  onToggle: (id: string) => void;
  onHide: (id: string) => void;
  onNote: (id: string, value: string) => void;
}) {
  const visible = questions.filter((question) => !hidden.has(question.id));
  if (visible.length === 0) return null;
  return (
    <section className="interview-builder__group">
      <h2>{title}</h2>
      <ul>
        {visible.map((question) => (
          <li key={question.id}>
            <QuestionCard
              question={question}
              facilityHref={facilityHref}
              checked={checked.has(question.id)}
              note={notes[question.id] ?? ""}
              onToggle={() => onToggle(question.id)}
              onHide={() => onHide(question.id)}
              onNote={(value) => onNote(question.id, value)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FacilityInterviewBuilder({
  facilityName = null,
  facilityCcn = null,
  facilityHref = null,
  facilityEvidence = null,
  navigatorEnabled = false,
  plannerEnabled = false,
}: FacilityInterviewBuilderProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const facilityMode = Boolean(facilityEvidence);
  const seedJson = useSyncExternalStore(
    subscribeInterviewBuilderSeed,
    interviewBuilderSeedSnapshot,
    () => "",
  );
  const seed = useMemo(() => parseInterviewBuilderSeed(seedJson || null), [seedJson]);
  const [phase, setPhase] = useState<Phase>("setup");
  const [settingOverride, setSettingOverride] = useState<InterviewCareSetting | null>(null);
  const [concernsOverride, setConcernsOverride] = useState<InterviewConcernTag[] | null>(null);
  const careSetting = facilityMode
    ? "skilled_nursing"
    : (settingOverride ?? seed.setting ?? "skilled_nursing");
  const concerns = useMemo(
    () => concernsOverride ?? [...(seed.concerns ?? [])],
    [concernsOverride, seed.concerns],
  );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [generatedOn, setGeneratedOn] = useState("");

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  const checklist = useMemo<InterviewChecklist | null>(() => {
    if (phase !== "checklist") return null;
    return buildInterviewChecklist({
      careSetting,
      concernTags: concerns,
      facilityEvidence: facilityMode ? facilityEvidence : null,
    });
  }, [phase, careSetting, concerns, facilityEvidence, facilityMode]);

  function toggleConcern(tag: InterviewConcernTag) {
    setConcernsOverride((current) => {
      const base = current ?? [...(seed.concerns ?? [])];
      return base.includes(tag) ? base.filter((item) => item !== tag) : [...base, tag];
    });
  }

  function generate() {
    setChecked(readCheckedQuestionIds());
    setHidden(readHiddenQuestionIds());
    setNotes(readQuestionNotes());
    setGeneratedOn(
      new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date()),
    );
    setPhase("checklist");
  }

  function updateChecked(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    persistLocalState(next, hidden, notes);
  }

  function hideQuestion(id: string) {
    const next = new Set(hidden);
    next.add(id);
    setHidden(next);
    persistLocalState(checked, next, notes);
  }

  function restoreHidden() {
    const next = new Set<string>();
    setHidden(next);
    persistLocalState(checked, next, notes);
  }

  function updateNote(id: string, value: string) {
    const next = { ...notes, [id]: value };
    setNotes(next);
    persistLocalState(checked, hidden, next);
  }

  const heading = facilityMode
    ? `Questions for ${facilityName}`
    : "Build your care-provider interview checklist";

  if (phase === "setup") {
    return (
      <section className="care-navigator interview-builder" aria-labelledby={headingId}>
        <p className="eyebrow">Facility Tour &amp; Interview Builder</p>
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>
          {facilityMode ? `Questions for ${facilityName}` : heading}
        </h1>
        <p className="lede">
          Choose the type of care and what matters most. SeniorTrustHub will create questions to
          take with you on a tour, call, or care-planning meeting.
        </p>
        <p className="care-navigator__disclaimer">{INTERVIEW_DISCLAIMER}</p>
        {facilityMode ? (
          <p>
            This checklist can include published evidence from this facility&apos;s SeniorTrustHub
            record. It does not transfer health answers and does not score the facility.
          </p>
        ) : null}

        <form
          className="interview-builder__form"
          onSubmit={(event) => {
            event.preventDefault();
            generate();
          }}
        >
          <fieldset className="care-navigator__question" disabled={facilityMode}>
            <legend>Step 1. What type of care are you evaluating?</legend>
            <div className="care-navigator__options">
              {CARE_SETTING_OPTIONS.map((setting) => (
                <label key={setting} htmlFor={`setting-${setting}`}>
                  <input
                    id={`setting-${setting}`}
                    type="radio"
                    name="care-setting"
                    checked={careSetting === setting}
                    onChange={() => setSettingOverride(setting)}
                  />
                  <span>{CARE_SETTING_LABELS[setting]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="care-navigator__question">
            <legend>Step 2. What matters most?</legend>
            <p>
              Select any concerns you want the checklist to emphasize. You can leave this blank.
            </p>
            <div className="care-navigator__options">
              {BUILDER_CONCERN_CHOICES.map((tag) => (
                <label key={tag} htmlFor={`concern-${tag}`}>
                  <input
                    id={`concern-${tag}`}
                    type="checkbox"
                    checked={concerns.includes(tag)}
                    onChange={() => toggleConcern(tag)}
                  />
                  <span>{CONCERN_TAG_LABELS[tag]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="care-navigator__actions">
            <button className="button button--primary" type="submit">
              Create checklist
            </button>
          </div>
        </form>
      </section>
    );
  }

  if (!checklist) return null;

  const evidenceQuestions = checklist.questions.filter((question) => question.evidenceBasis);
  const generalQuestions = checklist.questions.filter((question) => !question.evidenceBasis);
  const hiddenCount = checklist.questions.filter((question) => hidden.has(question.id)).length;

  return (
    <section
      className="care-navigator interview-builder interview-builder--results"
      aria-labelledby={headingId}
    >
      <p className="eyebrow">Your interview checklist</p>
      <h1 id={headingId} ref={headingRef} tabIndex={-1}>
        {facilityMode ? `Questions for ${facilityName}` : "Your care-provider interview checklist"}
      </h1>
      <p>
        {checklist.careSettingLabel}
        {facilityCcn ? ` · CMS provider ID ${facilityCcn}` : ""}
        {generatedOn ? ` · Prepared ${generatedOn}` : ""}
      </p>
      {checklist.transparencyNote ? <p>{checklist.transparencyNote}</p> : null}
      <p className="care-navigator__disclaimer">{checklist.disclaimer}</p>
      <div className="care-navigator__actions interview-builder__toolbar">
        <PrintButton label="Print / Save PDF" />
        <button className="button button--quiet" type="button" onClick={() => setPhase("setup")}>
          Change care type or priorities
        </button>
        {hiddenCount > 0 ? (
          <button className="button button--quiet" type="button" onClick={restoreHidden}>
            Restore hidden questions ({hiddenCount})
          </button>
        ) : null}
      </div>

      {facilityMode && evidenceQuestions.length > 0 ? (
        <QuestionGroup
          title="Questions based on this facility's public record"
          questions={evidenceQuestions}
          facilityHref={facilityHref}
          checked={checked}
          hidden={hidden}
          notes={notes}
          onToggle={updateChecked}
          onHide={hideQuestion}
          onNote={updateNote}
        />
      ) : null}

      {facilityMode ? <h2>General questions worth asking</h2> : null}

      <QuestionGroup
        title="Must ask"
        questions={
          facilityMode ? checklist.mustAsk.filter((item) => !item.evidenceBasis) : checklist.mustAsk
        }
        facilityHref={facilityHref}
        checked={checked}
        hidden={hidden}
        notes={notes}
        onToggle={updateChecked}
        onHide={hideQuestion}
        onNote={updateNote}
      />
      <QuestionGroup
        title="Important follow-ups"
        questions={
          facilityMode
            ? checklist.important.filter((item) => !item.evidenceBasis)
            : checklist.important
        }
        facilityHref={facilityHref}
        checked={checked}
        hidden={hidden}
        notes={notes}
        onToggle={updateChecked}
        onHide={hideQuestion}
        onNote={updateNote}
      />
      <QuestionGroup
        title="Additional questions"
        questions={
          facilityMode
            ? checklist.additional.filter((item) => !item.evidenceBasis)
            : checklist.additional
        }
        facilityHref={facilityHref}
        checked={checked}
        hidden={hidden}
        notes={notes}
        onToggle={updateChecked}
        onHide={hideQuestion}
        onNote={updateNote}
      />

      {facilityMode && evidenceQuestions.length === 0 && generalQuestions.length > 0 ? (
        <p>
          This facility&apos;s published record did not add extra evidence prompts. The general
          questions above are still worth taking on a tour or call.
        </p>
      ) : null}

      <aside className="care-navigator__about">
        <h2>About this checklist</h2>
        <p>
          Answers, checkmarks, hidden questions, and notes stay in this browser only. SeniorTrustHub
          does not create an account, collect an email, or store a health or financial profile.
        </p>
        {navigatorEnabled ? (
          <p>
            <Link href="/tools/care-needs-navigator">Use the Care Needs Navigator</Link>
          </p>
        ) : null}
        {plannerEnabled ? (
          <p>
            <Link href="/tools/senior-care-cost-planner">Open the Senior Care Cost Planner</Link>
          </p>
        ) : null}
      </aside>
    </section>
  );
}
