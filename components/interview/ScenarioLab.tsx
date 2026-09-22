"use client";

import { useState } from "react";
import { Lightbulb, Eye, EyeOff, ClipboardList, Server, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { PROBLEM_SCENARIOS } from "@/lib/interview-scenarios";
import { DOMAIN_LABELS } from "@/lib/interview-quiz";
import { useInterviewStore } from "@/lib/interview-store";
import type { InterviewDomain, ProblemScenario } from "@/types/interview";
import { FilterChip } from "./QuizRunner";

export function ScenarioLab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [domain, setDomain] = useState<InterviewDomain | "all">("all");
  const { scenarioChecks } = useInterviewStore();

  const domains = [...new Set(PROBLEM_SCENARIOS.map(s => s.domain))];
  const list = domain === "all" ? PROBLEM_SCENARIOS : PROBLEM_SCENARIOS.filter(s => s.domain === domain);
  const selected = PROBLEM_SCENARIOS.find(s => s.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-[var(--color-border-subtle)] flex flex-col shrink-0">
        <div className="px-3 py-2.5 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-1">
          <FilterChip active={domain === "all"} onClick={() => setDomain("all")} label="All" />
          {domains.map(d => (
            <FilterChip key={d} active={domain === d} onClick={() => setDomain(d)} label={DOMAIN_LABELS[d].split(" ")[0]} />
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.map(s => {
            const covered = scenarioChecks[s.id]?.length ?? 0;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]",
                  selectedId === s.id && "bg-[var(--color-surface-hover)] border-l-2 border-l-amber-600"
                )}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-text-muted)] mb-1">
                  <span>{DOMAIN_LABELS[s.domain]}</span>
                  <span>{"●".repeat(s.difficulty)}</span>
                </div>
                <div className="text-xs font-medium text-[var(--color-text-primary)] leading-snug">{s.title}</div>
                {covered > 0 && (
                  <div className="text-[10px] text-green-500 mt-1">{covered}/{s.solution.keyPoints.length} key points covered</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <ScenarioWorkspace key={selected.id} scenario={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <ClipboardList size={32} className="text-[var(--color-text-muted)] mb-4" />
            <p className="text-sm text-[var(--color-text-secondary)]">Select a scenario</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 max-w-md leading-relaxed">
              Read the evidence, write your diagnosis and proposal as you would say it to the panel, then compare with the model solution.
              Hints and the solution stay hidden until you open them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioWorkspace({ scenario: s }: { scenario: ProblemScenario }) {
  const { scenarioNotes, setScenarioNote, scenarioChecks, toggleScenarioCheck } = useInterviewStore();
  const [hintsShown, setHintsShown] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);

  const note = scenarioNotes[s.id] ?? "";
  const checks = scenarioChecks[s.id] ?? [];

  const requestReveal = () => {
    if (note.trim().length < 40 && !confirmReveal) {
      setConfirmReveal(true);
      return;
    }
    setShowSolution(true);
    setConfirmReveal(false);
  };

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="border border-amber-900/70 bg-amber-950/20 rounded-xl p-4">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-2">
          Problem scenario · {DOMAIN_LABELS[s.domain]} · difficulty {s.difficulty}/5
        </div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1.5">{s.title}</h2>
        <div className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Server size={11} className="mt-0.5 shrink-0" />{s.environment}
        </div>
      </div>

      <Section label="Situation">
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{s.context}</p>
      </Section>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Evidence</p>
        {s.evidence.map((e, i) => (
          <div key={i}>
            <p className="text-[11px] text-[var(--color-text-secondary)] mb-1">{e.title}</p>
            <pre className="terminal-block text-[11px] leading-snug">{e.content}</pre>
          </div>
        ))}
      </div>

      <Section label="Your task">
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[var(--color-text-primary)]">
          {s.tasks.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      </Section>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Your diagnosis & proposal (saved locally)</p>
        <textarea
          value={note}
          onChange={e => setScenarioNote(s.id, e.target.value)}
          rows={9}
          placeholder={"1. Diagnosis: …\n2. Immediate action: …\n3. Structural fix: …\n4. How I verify: …\n5. Who I involve / communicate with: …"}
          className="w-full rounded-xl bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] p-3.5 text-sm text-[var(--color-text-primary)] font-mono leading-relaxed focus:outline-none focus:border-blue-700"
        />
      </div>

      {/* Hints */}
      <div className="space-y-2">
        {s.hints.slice(0, hintsShown).map((h, i) => (
          <div key={i} className="flex gap-2 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-lg p-3">
            <Lightbulb size={13} className="text-yellow-500 shrink-0 mt-0.5" />{h}
          </div>
        ))}
        {hintsShown < s.hints.length && !showSolution && (
          <Button size="sm" variant="ghost" onClick={() => setHintsShown(hintsShown + 1)}>
            <Lightbulb size={13} /> Show hint {hintsShown + 1} of {s.hints.length}
          </Button>
        )}
      </div>

      {/* Reveal */}
      {!showSolution ? (
        <div className="space-y-2">
          {confirmReveal && (
            <p className="text-xs text-amber-400">
              You have not written a proposal yet. Reasoning first builds the recall you need in the interview. Reveal anyway?
            </p>
          )}
          <Button variant="secondary" className="w-full" onClick={requestReveal}>
            <Eye size={14} /> {confirmReveal ? "Yes, reveal the model solution" : "Reveal model solution"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowSolution(false)}><EyeOff size={13} /> Hide solution</Button>
          </div>

          <Section label="Analysis" accent="text-amber-500">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{s.solution.analysis}</p>
          </Section>

          <Section label="Proposed actions (in order)" accent="text-green-500">
            <ol className="list-decimal pl-5 space-y-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {s.solution.actions.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </Section>

          {s.solution.commands && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Key commands / SQL</p>
              <pre className="terminal-block text-[11px] leading-snug">{s.solution.commands}</pre>
            </div>
          )}

          <Section label="What a weak answer does" accent="text-red-400">
            <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
              {s.solution.pitfalls.map((p, i) => <li key={i} className="flex gap-2"><span className="text-red-500">✕</span>{p}</li>)}
            </ul>
          </Section>

          <Section label="Self-assessment: what the panel listens for" accent="text-blue-400">
            <p className="text-[11px] text-[var(--color-text-muted)] mb-2">Compare with your written proposal and tick what you covered.</p>
            <div className="space-y-1.5">
              {s.solution.keyPoints.map((k, i) => {
                const on = checks.includes(i);
                return (
                  <button key={i} onClick={() => toggleScenarioCheck(s.id, i)} className="w-full flex gap-2 text-left text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    {on ? <CheckSquare size={15} className="text-green-500 shrink-0 mt-0.5" /> : <Square size={15} className="shrink-0 mt-0.5" />}
                    {k}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-3 font-mono">
              {checks.length}/{s.solution.keyPoints.length} covered
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, accent, children }: { label: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-4">
      <p className={cn("text-[10px] uppercase tracking-widest mb-2.5", accent ?? "text-[var(--color-text-muted)]")}>{label}</p>
      {children}
    </div>
  );
}
