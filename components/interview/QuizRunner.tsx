"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Timer, GraduationCap, BookOpen, RotateCcw, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { QUIZ_QUESTIONS, DOMAIN_LABELS, EXAM_WEIGHTS } from "@/lib/interview-quiz";
import { useInterviewStore, type ExamResult } from "@/lib/interview-store";
import type { InterviewDomain, QuizQuestion } from "@/types/interview";

type Mode = "study" | "exam";
type Phase = "setup" | "running" | "results";

const EXAM_SIZE = 20;
const PASS_MARK = 0.8;
const SECONDS_PER_QUESTION = 90;

interface Attempt {
  question: QuizQuestion;
  order: number[];           // Display order of original option indexes
  selected: number[];        // Original option indexes chosen
  isCorrect: boolean | null; // null = not yet answered
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toAttempt(q: QuizQuestion): Attempt {
  return { question: q, order: shuffle(q.options.map((_, i) => i)), selected: [], isCorrect: null };
}

function isAnswerCorrect(q: QuizQuestion, selected: number[]): boolean {
  if (selected.length !== q.correct.length) return false;
  return q.correct.every(i => selected.includes(i));
}

/** Draw an exam weighted by EXAM_WEIGHTS; tops up from the remaining pool if a domain runs short. */
function drawExam(): QuizQuestion[] {
  const picked: QuizQuestion[] = [];
  const domains = Object.keys(EXAM_WEIGHTS) as InterviewDomain[];
  for (const d of domains) {
    const want = Math.round(EXAM_WEIGHTS[d] * EXAM_SIZE);
    picked.push(...shuffle(QUIZ_QUESTIONS.filter(q => q.domain === d)).slice(0, want));
  }
  const rest = shuffle(QUIZ_QUESTIONS.filter(q => !picked.includes(q)));
  while (picked.length < EXAM_SIZE && rest.length) picked.push(rest.pop()!);
  return shuffle(picked.slice(0, EXAM_SIZE));
}

export function QuizRunner() {
  const { missedQuestionIds, recordAnswer, recordExam } = useInterviewStore();
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("exam");
  const [domainFilter, setDomainFilter] = useState<InterviewDomain | "all">("all");
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [timed, setTimed] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);

  const current = attempts[index];

  const studyPool = useMemo(() => {
    let pool = QUIZ_QUESTIONS;
    if (domainFilter !== "all") pool = pool.filter(q => q.domain === domainFilter);
    if (onlyMissed) pool = pool.filter(q => missedQuestionIds.includes(q.id));
    return pool;
  }, [domainFilter, onlyMissed, missedQuestionIds]);

  const start = () => {
    const questions = mode === "exam" ? drawExam() : shuffle(studyPool);
    if (!questions.length) return;
    setAttempts(questions.map(toAttempt));
    setIndex(0);
    setSecondsLeft(SECONDS_PER_QUESTION);
    setPhase("running");
  };

  const finish = useCallback((final: Attempt[]) => {
    if (mode === "exam") {
      const byDomain: ExamResult["byDomain"] = {};
      for (const a of final) {
        const d = byDomain[a.question.domain] ?? { total: 0, correct: 0 };
        d.total += 1;
        if (a.isCorrect) d.correct += 1;
        byDomain[a.question.domain] = d;
      }
      recordExam({
        takenAt: Date.now(),
        total: final.length,
        correct: final.filter(a => a.isCorrect).length,
        byDomain,
        missedIds: final.filter(a => !a.isCorrect).map(a => a.question.id),
      });
    }
    setPhase("results");
  }, [mode, recordExam]);

  const submit = useCallback(() => {
    if (!current || current.isCorrect !== null) return;
    const ok = isAnswerCorrect(current.question, current.selected);
    recordAnswer(current.question.id, ok);
    const next = attempts.map((a, i) => (i === index ? { ...a, isCorrect: ok } : a));
    setAttempts(next);
    // Exam mode: no feedback; advance immediately
    if (mode === "exam") {
      if (index + 1 < next.length) {
        setIndex(index + 1);
        setSecondsLeft(SECONDS_PER_QUESTION);
      } else {
        finish(next);
      }
    }
  }, [current, attempts, index, mode, recordAnswer, finish]);

  // Optional per-question timer (exam mode only)
  useEffect(() => {
    if (phase !== "running" || mode !== "exam" || !timed) return;
    if (secondsLeft <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, mode, timed, secondsLeft, submit]);

  const toggleOption = (optionIndex: number) => {
    if (!current || current.isCorrect !== null) return;
    const multi = current.question.correct.length > 1;
    const selected = multi
      ? current.selected.includes(optionIndex)
        ? current.selected.filter(i => i !== optionIndex)
        : [...current.selected, optionIndex]
      : [optionIndex];
    setAttempts(attempts.map((a, i) => (i === index ? { ...a, selected } : a)));
  };

  const nextStudy = () => {
    if (index + 1 < attempts.length) setIndex(index + 1);
    else finish(attempts);
  };

  /* ─── Setup ─────────────────────────────────────────── */
  if (phase === "setup") {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModeCard
            active={mode === "exam"}
            onClick={() => setMode("exam")}
            icon={<GraduationCap size={16} className="text-amber-400" />}
            title="Interview Mode"
            text={`${EXAM_SIZE} questions drawn at random, weighted ~45% toward performance & tuning. No feedback until the end. Pass mark ${PASS_MARK * 100}%.`}
          />
          <ModeCard
            active={mode === "study"}
            onClick={() => setMode("study")}
            icon={<BookOpen size={16} className="text-blue-400" />}
            title="Study Mode"
            text="Pick a domain. You see the explanation and the common trap right after each answer."
          />
        </div>

        {mode === "exam" ? (
          <label className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />
            <Timer size={14} />
            Time pressure: {SECONDS_PER_QUESTION} s per question, auto-submits when time runs out (optional)
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={domainFilter === "all"} onClick={() => setDomainFilter("all")} label={`All (${QUIZ_QUESTIONS.length})`} />
              {(Object.keys(DOMAIN_LABELS) as InterviewDomain[]).map(d => (
                <FilterChip
                  key={d}
                  active={domainFilter === d}
                  onClick={() => setDomainFilter(d)}
                  label={`${DOMAIN_LABELS[d]} (${QUIZ_QUESTIONS.filter(q => q.domain === d).length})`}
                />
              ))}
            </div>
            <label className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] cursor-pointer">
              <input type="checkbox" checked={onlyMissed} onChange={e => setOnlyMissed(e.target.checked)} />
              Only questions I have answered wrong ({missedQuestionIds.length})
            </label>
          </div>
        )}

        <Button variant="primary" onClick={start} disabled={mode === "study" && studyPool.length === 0}>
          {mode === "exam" ? "Start Interview Mode" : `Start study session (${studyPool.length})`}
          <ArrowRight size={14} />
        </Button>
      </div>
    );
  }

  /* ─── Results ───────────────────────────────────────── */
  if (phase === "results") {
    // Exam: unanswered questions count as wrong. Study: only what was answered.
    const answered = mode === "exam" ? attempts : attempts.filter(a => a.isCorrect !== null);
    const correct = answered.filter(a => a.isCorrect).length;
    const pct = answered.length ? correct / answered.length : 0;
    const domains = [...new Set(answered.map(a => a.question.domain))];
    const missed = answered.filter(a => !a.isCorrect);

    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        <div className={cn("border rounded-xl p-5", pct >= PASS_MARK ? "border-green-900 bg-green-950/40" : "border-amber-900 bg-amber-950/30")}>
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
            {mode === "exam" ? "Interview Mode result" : "Study session result"}
          </p>
          <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {correct} / {answered.length} <span className="text-base text-[var(--color-text-secondary)]">({Math.round(pct * 100)}%)</span>
          </div>
          {mode === "exam" && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {pct >= PASS_MARK
                ? "At or above the pass mark. Review the misses below. A senior panel will probe exactly those."
                : `Below the ${PASS_MARK * 100}% pass mark. Work through the misses in Study Mode ("only questions I have answered wrong"), then retake.`}
            </p>
          )}
        </div>

        <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">By domain</p>
          <div className="space-y-2">
            {domains.map(d => {
              const inD = answered.filter(a => a.question.domain === d);
              const ok = inD.filter(a => a.isCorrect).length;
              const r = ok / inD.length;
              return (
                <div key={d} className="flex items-center gap-3 text-xs">
                  <span className="w-24 sm:w-48 shrink-0 truncate text-[var(--color-text-secondary)]">{DOMAIN_LABELS[d]}</span>
                  <div className="flex-1 h-1.5 bg-[var(--color-surface-elevated)] rounded">
                    <div className={cn("h-1.5 rounded", r >= PASS_MARK ? "bg-green-600" : "bg-amber-600")} style={{ width: `${r * 100}%` }} />
                  </div>
                  <span className="w-12 text-right font-mono text-[var(--color-text-muted)]">{ok}/{inD.length}</span>
                </div>
              );
            })}
          </div>
        </div>

        {missed.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Review: questions missed</p>
            {missed.map(a => (
              <div key={a.question.id} className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4 space-y-2">
                <p className="text-sm text-[var(--color-text-primary)]">{a.question.question}</p>
                <p className="text-xs text-red-300">
                  Your answer: {a.selected.length ? a.selected.map(i => a.question.options[i]).join(" | ") : "(none, time ran out)"}
                </p>
                <p className="text-xs text-green-300">Correct: {a.question.correct.map(i => a.question.options[i]).join(" | ")}</p>
                <Explanation q={a.question} />
              </div>
            ))}
          </div>
        )}

        <Button onClick={() => setPhase("setup")} variant="secondary"><RotateCcw size={14} /> New session</Button>
      </div>
    );
  }

  /* ─── Running ───────────────────────────────────────── */
  const q = current.question;
  const multi = q.correct.length > 1;
  const answeredThis = current.isCorrect !== null;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-[var(--color-text-muted)]">
        <span className="font-mono">
          {mode === "exam" ? "INTERVIEW MODE" : "STUDY"} · {index + 1} / {attempts.length} · {DOMAIN_LABELS[q.domain]} · difficulty {q.difficulty}/5
        </span>
        <div className="flex items-center gap-3">
          {mode === "exam" && timed && (
            <span className={cn("flex items-center gap-1 font-mono", secondsLeft <= 15 ? "text-amber-400" : "")}>
              <Timer size={12} /> {secondsLeft}s
            </span>
          )}
          <button onClick={() => finish(attempts)} className="hover:text-[var(--color-text-secondary)]">End session</button>
        </div>
      </div>

      <div className="h-1 bg-[var(--color-surface-elevated)] rounded">
        <div className="h-1 bg-blue-700 rounded" style={{ width: `${((index + (answeredThis ? 1 : 0)) / attempts.length) * 100}%` }} />
      </div>

      <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5 space-y-4">
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{q.question}</p>
        {q.code && <pre className="terminal-block text-[11px] leading-snug">{q.code}</pre>}
        {multi && <p className="text-[11px] text-amber-400">Select all that apply ({q.correct.length} correct).</p>}

        <div className="space-y-2">
          {current.order.map((optIdx, displayIdx) => {
            const chosen = current.selected.includes(optIdx);
            const isRight = q.correct.includes(optIdx);
            return (
              <button
                key={optIdx}
                onClick={() => toggleOption(optIdx)}
                disabled={answeredThis}
                className={cn(
                  "w-full text-left flex gap-3 px-3.5 py-2.5 rounded-lg border text-sm leading-relaxed",
                  !answeredThis && (chosen
                    ? "border-blue-600 bg-blue-950/50 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"),
                  answeredThis && isRight && "border-green-700 bg-green-950/40 text-green-100",
                  answeredThis && chosen && !isRight && "border-red-800 bg-red-950/40 text-red-200",
                  answeredThis && !chosen && !isRight && "border-[var(--color-border-subtle)] text-[var(--color-text-muted)]",
                )}
              >
                <span className="font-mono text-xs mt-0.5 shrink-0">{String.fromCharCode(65 + displayIdx)}</span>
                <span>{q.options[optIdx]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!answeredThis ? (
        <Button variant="primary" onClick={submit} disabled={current.selected.length === 0}>
          Submit answer
        </Button>
      ) : (
        <>
          <div className={cn("flex items-center gap-2 text-sm", current.isCorrect ? "text-green-400" : "text-red-400")}>
            {current.isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {current.isCorrect ? "Correct" : "Not correct"}
          </div>
          <Explanation q={q} />
          <Button variant="secondary" onClick={nextStudy}>
            {index + 1 < attempts.length ? "Next question" : "See results"} <ArrowRight size={14} />
          </Button>
        </>
      )}
    </div>
  );
}

function Explanation({ q }: { q: QuizQuestion }) {
  return (
    <div className="space-y-2">
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3.5">
        <p className="text-[10px] uppercase tracking-widest text-green-500 mb-1.5">Explanation</p>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{q.explanation}</p>
      </div>
      {q.trap && (
        <div className="bg-[var(--color-surface-elevated)] border border-amber-900/60 rounded-lg p-3.5">
          <p className="text-[10px] uppercase tracking-widest text-amber-500 mb-1.5 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Interview trap
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{q.trap}</p>
        </div>
      )}
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, text }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border p-4 bg-[var(--color-surface-panel)]",
        active ? "border-blue-700" : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]"
      )}
    >
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</span></div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{text}</p>
    </button>
  );
}

export function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-mono border",
        active
          ? "bg-blue-900 border-blue-700 text-blue-200"
          : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {label}
    </button>
  );
}
