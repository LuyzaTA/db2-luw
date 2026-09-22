"use client";

import { useEffect, useState } from "react";
import { MessagesSquare, Mic, BookMarked, Eye, EyeOff, ArrowRight, RotateCcw, Timer, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { DUTCH_QUESTIONS, DUTCH_CATEGORY_LABELS, PUBLIC_SECTOR_BRIEFING, QUESTIONS_TO_ASK } from "@/lib/dutch-interview";
import { useInterviewStore, type AnswerReadiness } from "@/lib/interview-store";
import { TabButton } from "@/components/interview/InterviewPrep";
import { FilterChip } from "@/components/interview/QuizRunner";
import type { DutchCategory, DutchQuestion } from "@/types/interview";

type Tab = "questions" | "mock" | "briefing";

const MOCK_SIZE = 8;
const ANSWER_SECONDS = 120;

const READINESS: { value: AnswerReadiness; label: string; cls: string }[] = [
  { value: "rough", label: "Needs work", cls: "border-red-900 text-red-300" },
  { value: "ok",    label: "Acceptable", cls: "border-yellow-900 text-yellow-300" },
  { value: "ready", label: "Ready",      cls: "border-green-900 text-green-300" },
];

export function DutchInterview() {
  const [tab, setTab] = useState<Tab>("questions");
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 h-11 border-b border-[var(--color-border-subtle)] shrink-0">
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")} icon={<MessagesSquare size={13} />} label={`Questions (${DUTCH_QUESTIONS.length})`} />
        <TabButton active={tab === "mock"} onClick={() => setTab("mock")} icon={<Mic size={13} />} label="Mock interview" />
        <TabButton active={tab === "briefing"} onClick={() => setTab("briefing")} icon={<BookMarked size={13} />} label="Briefing" />
        <span className="ml-auto text-[10px] font-mono text-[var(--color-text-muted)] hidden sm:inline">Interview language: English</span>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "questions" && <QuestionBank />}
        {tab === "mock" && <div className="h-full overflow-y-auto"><MockInterview /></div>}
        {tab === "briefing" && <div className="h-full overflow-y-auto"><Briefing /></div>}
      </div>
    </div>
  );
}

/* ─── Question bank ───────────────────────────────────── */

function QuestionBank() {
  const [category, setCategory] = useState<DutchCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { answerReadiness } = useInterviewStore();

  const list = category === "all" ? DUTCH_QUESTIONS : DUTCH_QUESTIONS.filter(q => q.category === category);
  const selected = DUTCH_QUESTIONS.find(q => q.id === selectedId) ?? null;
  const readyCount = DUTCH_QUESTIONS.filter(q => answerReadiness[q.id] === "ready").length;

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-[var(--color-border-subtle)] flex flex-col shrink-0">
        <div className="px-3 py-2.5 border-b border-[var(--color-border-subtle)] space-y-2">
          <div className="flex flex-wrap gap-1">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")} label="All" />
            {(Object.keys(DUTCH_CATEGORY_LABELS) as DutchCategory[]).map(c => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)} label={DUTCH_CATEGORY_LABELS[c]} />
            ))}
          </div>
          <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{readyCount}/{DUTCH_QUESTIONS.length} marked ready</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.map(q => {
            const r = answerReadiness[q.id];
            return (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]",
                  selectedId === q.id && "bg-[var(--color-surface-hover)] border-l-2 border-l-orange-600"
                )}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-text-muted)] mb-1">
                  <span>{DUTCH_CATEGORY_LABELS[q.category]}</span>
                  {r && <span className={r === "ready" ? "text-green-500" : r === "ok" ? "text-yellow-500" : "text-red-400"}>{READINESS.find(x => x.value === r)?.label}</span>}
                </div>
                <div className="text-xs text-[var(--color-text-primary)] leading-snug">{q.question}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-3xl mx-auto p-6"><QuestionCard key={selected.id} q={selected} /></div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <MessagesSquare size={32} className="text-[var(--color-text-muted)] mb-4" />
            <p className="text-sm text-[var(--color-text-secondary)]">Select a question</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 max-w-md leading-relaxed">
              Answer out loud first, in 60–120 seconds. Then open the answer structure and the model answer, and mark how ready you are.
              Model answers with [brackets] must be filled with your own experience.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q, compact }: { q: DutchQuestion; compact?: boolean }) {
  const { answerReadiness, setAnswerReadiness } = useInterviewStore();
  const [showApproach, setShowApproach] = useState(false);
  const [showModel, setShowModel] = useState(false);

  return (
    <div className="space-y-4">
      <div className="border border-orange-900/60 bg-orange-950/20 rounded-xl p-5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-orange-400 mb-2">{DUTCH_CATEGORY_LABELS[q.category]}</p>
        <p className="text-base text-[var(--color-text-primary)] leading-relaxed">&ldquo;{q.question}&rdquo;</p>
      </div>

      {!compact && (
        <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1.5"><Target size={11} /> What they are really testing</p>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{q.whyAsked}</p>
        </div>
      )}

      <Reveal
        shown={showApproach}
        onToggle={() => setShowApproach(!showApproach)}
        label="Answer structure"
      >
        <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
          {q.approach.map((a, i) => <li key={i} className="flex gap-2"><span className="text-blue-500">▸</span>{a}</li>)}
        </ul>
      </Reveal>

      <Reveal shown={showModel} onToggle={() => setShowModel(!showModel)} label="Model answer">
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{q.modelAnswer}</p>
        {q.avoid && q.avoid.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-red-400 mb-1.5">Avoid</p>
            <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              {q.avoid.map((a, i) => <li key={i} className="flex gap-2"><span className="text-red-500">✕</span>{a}</li>)}
            </ul>
          </div>
        )}
        {q.followUps && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1.5">Likely follow-ups</p>
            <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              {q.followUps.map((f, i) => <li key={i} className="flex gap-2"><span className="text-amber-500">?</span>{f}</li>)}
            </ul>
          </div>
        )}
      </Reveal>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mr-1">My answer is</span>
        {READINESS.map(r => (
          <button
            key={r.value}
            onClick={() => setAnswerReadiness(q.id, r.value)}
            className={cn(
              "px-2.5 py-1 rounded border text-xs",
              answerReadiness[q.id] === r.value ? cn(r.cls, "bg-[var(--color-surface-active)]") : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ shown, onToggle, label, children }: { shown: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
        <span>{label}</span>
        {shown ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      {shown && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ─── Mock interview ──────────────────────────────────── */

function buildMock(): DutchQuestion[] {
  const pick = (cat: DutchCategory, n: number) =>
    [...DUTCH_QUESTIONS.filter(q => q.category === cat)].sort(() => Math.random() - 0.5).slice(0, n);
  const intro = DUTCH_QUESTIONS.find(q => q.id === "nl-p-intro")!;
  const closing = DUTCH_QUESTIONS.find(q => q.id === "nl-c-questions")!;
  const middle = [
    ...pick("technical", 2),
    ...pick("behavioural", 1),
    ...pick("personal", 3).filter(q => q.id !== "nl-p-intro").slice(0, 2),
    ...pick("public-sector", 1),
  ].sort(() => Math.random() - 0.5);
  return [intro, ...middle, closing].slice(0, MOCK_SIZE);
}

function MockInterview() {
  const [questions, setQuestions] = useState<DutchQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [timed, setTimed] = useState(true);
  const [seconds, setSeconds] = useState(ANSWER_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || !timed || seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, timed, seconds]);

  const start = () => {
    setQuestions(buildMock());
    setIndex(0);
    setSeconds(ANSWER_SECONDS);
    setRunning(true);
  };

  const next = () => {
    if (!questions) return;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSeconds(ANSWER_SECONDS);
      setRunning(true);
    } else {
      setRunning(false);
      setIndex(questions.length);
    }
  };

  if (!questions) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Mock interview</h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {MOCK_SIZE} questions in a realistic order: introduction, technical, behavioural, personal/challenging, public sector, and closing.
          Answer each one out loud, standing up if possible. Recording yourself on your phone is the single most effective practice.
          After answering, open the model answer and mark your readiness.
        </p>
        <label className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] cursor-pointer">
          <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />
          <Timer size={14} /> Show a {ANSWER_SECONDS / 60}-minute answer clock (a guide only, nothing happens when it ends)
        </label>
        <Button variant="primary" onClick={start}>Start mock interview <ArrowRight size={14} /></Button>
      </div>
    );
  }

  if (index >= questions.length) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Mock interview complete</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Questions covered:</p>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-[var(--color-text-secondary)]">
          {questions.map(q => <li key={q.id}>{q.question}</li>)}
        </ol>
        <p className="text-xs text-[var(--color-text-muted)]">Anything you marked &quot;Needs work&quot; shows up in the Questions tab, so you can drill it there.</p>
        <Button variant="secondary" onClick={start}><RotateCcw size={14} /> New mock interview</Button>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
        <span>MOCK · {index + 1} / {questions.length}</span>
        {timed && (
          <span className={cn("flex items-center gap-1", seconds <= 0 ? "text-amber-400" : "")}>
            <Timer size={12} /> {seconds > 0 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Time. Wrap up your answer."}
          </span>
        )}
      </div>
      <QuestionCard key={q.id} q={q} compact />
      <Button variant="secondary" onClick={next}>
        {index + 1 < questions.length ? "Next question" : "Finish"} <ArrowRight size={14} />
      </Button>
    </div>
  );
}

/* ─── Briefing ────────────────────────────────────────── */

function Briefing() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Briefing</p>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Dutch public-sector interview: context</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
          The interview is in English. The organisation, its policies and its vocabulary are Dutch. Knowing the terms below and using them naturally signals that you are ready to work there.
        </p>
      </div>

      {PUBLIC_SECTOR_BRIEFING.map(section => (
        <div key={section.title} className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-orange-400 mb-3">{section.title}</p>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {section.points.map((p, i) => <li key={i} className="flex gap-2"><span className="text-[var(--color-text-muted)]">▸</span><span>{p}</span></li>)}
          </ul>
        </div>
      ))}

      <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-blue-400 mb-3">Questions to ask them (pick 3–4)</p>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          {QUESTIONS_TO_ASK.map((q, i) => <li key={i}>{q}</li>)}
        </ol>
      </div>
    </div>
  );
}
