"use client";

import { useState } from "react";
import Link from "next/link";
import { Target, ListChecks, ClipboardList, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { QUIZ_QUESTIONS, DOMAIN_LABELS } from "@/lib/interview-quiz";
import { PROBLEM_SCENARIOS } from "@/lib/interview-scenarios";
import { useInterviewStore } from "@/lib/interview-store";
import type { InterviewDomain } from "@/types/interview";
import { QuizRunner } from "./QuizRunner";
import { ScenarioLab } from "./ScenarioLab";

type Tab = "brief" | "quiz" | "scenarios";

const REQUIREMENTS: { requirement: string; domains: InterviewDomain[]; probes: string }[] = [
  {
    requirement: "Performance & query tuning (primary focus)",
    domains: ["tuning"],
    probes: "Reading db2exfmt plans, estimate vs actual cardinality, statistics (column groups, statistical views), sargability and SQL rewrites, REOPT/profiles, memory (STMM, sort, buffer pools), locking/isolation, log latency.",
  },
  {
    requirement: "DPF / MPP, distribution, co-location, table partitioning",
    domains: ["dpf"],
    probes: "Distribution-key design and skew, collocation rules, table queues (DTQ/BTQ), replicated MQTs, coordinator partition, attach/detach with partitioned indexes, FCM, STMM in DPF.",
  },
  {
    requirement: "WLM setup and tuning",
    domains: ["wlm"],
    probes: "Workloads → service classes, work class/action sets, predictive vs reactive thresholds, REMAP, dispatcher shares vs CPU LIMIT, queue monitoring, monitor-first rollout.",
  },
  {
    requirement: "OpenShift / Kubernetes, Operators and Helm",
    domains: ["openshift"],
    probes: "Operator vs Helm, CR as source of truth, storage access modes, sysctls via KubeletConfig, probes vs crash recovery, OOM/QoS, HADR with Services, anti-affinity, backups to object storage.",
  },
  {
    requirement: "Diagnostics: db2diag, db2pd, MON_GET",
    domains: ["diagnostics"],
    probes: "EDU → application → SQL chain, lock waits, latches, in-flight vs cached metrics, time units, db2fodc/db2support for hangs.",
  },
  {
    requirement: "Automation: Linux, shell, Python, Ansible",
    domains: ["automation"],
    probes: "CLP return codes, db2profile in non-login shells, idempotency, rolling HADR fix packs, secrets handling, change-control integration.",
  },
  {
    requirement: "Version range 10.5 → 12.1",
    domains: ["versions"],
    probes: "Upgrade paths, HADR during version upgrades, plan-regression protection.",
  },
];

export function InterviewPrep() {
  const [tab, setTab] = useState<Tab>("brief");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 h-11 border-b border-[var(--color-border-subtle)] shrink-0">
        <TabButton active={tab === "brief"} onClick={() => setTab("brief")} icon={<Target size={13} />} label="Brief" />
        <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")} icon={<ListChecks size={13} />} label={`Quiz (${QUIZ_QUESTIONS.length})`} />
        <TabButton active={tab === "scenarios"} onClick={() => setTab("scenarios")} icon={<ClipboardList size={13} />} label={`Scenarios (${PROBLEM_SCENARIOS.length})`} />
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "brief" && <div className="h-full overflow-y-auto"><Brief onGo={setTab} /></div>}
        {tab === "quiz" && <div className="h-full overflow-y-auto"><QuizRunner /></div>}
        {tab === "scenarios" && <ScenarioLab />}
      </div>
    </div>
  );
}

function Brief({ onGo }: { onGo: (t: Tab) => void }) {
  const { examHistory, clearExamHistory } = useInterviewStore();

  // Aggregate the last 5 exams per domain
  const recent = examHistory.slice(0, 5);
  const agg: Partial<Record<InterviewDomain, { total: number; correct: number }>> = {};
  for (const r of recent) {
    for (const [d, v] of Object.entries(r.byDomain) as [InterviewDomain, { total: number; correct: number }][]) {
      const cur = agg[d] ?? { total: 0, correct: 0 };
      agg[d] = { total: cur.total + v.total, correct: cur.correct + v.correct };
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Interview Readiness · Senior Db2 LUW DBA</p>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Dutch public sector: performance-focused role</h1>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
          Every requirement in the vacancy maps to a domain below. The panel will go deepest on performance and tuning, so the quiz and scenarios are weighted accordingly.
          Content is written at the level of a demanding technical panel. Expect to miss questions; the misses are what you train on.
        </p>
      </div>

      <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl divide-y divide-[var(--color-border-subtle)]">
        {REQUIREMENTS.map(r => {
          const d = r.domains[0];
          const nQ = QUIZ_QUESTIONS.filter(q => q.domain === d).length;
          const nS = PROBLEM_SCENARIOS.filter(s => s.domain === d).length;
          const score = agg[d];
          return (
            <div key={r.requirement} className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.requirement}</p>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">{r.probes}</p>
              </div>
              <div className="text-[10px] font-mono text-[var(--color-text-muted)] sm:text-right whitespace-nowrap space-y-0.5">
                <div>{nQ} questions · {nS} scenarios</div>
                {score && (
                  <div className={score.correct / score.total >= 0.8 ? "text-green-500" : "text-amber-500"}>
                    recent: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">On-site 3–5 days in Utrecht or Apeldoorn</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">Not technical, but a hard requirement. Prepare a clear, concrete answer.</p>
          </div>
          <Link href="/dutch-interview" className="text-[10px] font-mono text-blue-400 hover:text-blue-300 sm:text-right whitespace-nowrap">Public-sector interview module →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => onGo("quiz")} className="text-left bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Quiz · Interview Mode</span>
            <ArrowRight size={13} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">A 20-question exam weighted like the panel, with an optional timer. Or Study Mode with explanations and interview traps.</p>
        </button>
        <button onClick={() => onGo("scenarios")} className="text-left bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Problem scenarios</span>
            <ArrowRight size={13} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">Real evidence (plans, MON_GET, db2pd, oc output). Write your proposal, then compare with the model solution and the panel&apos;s rubric.</p>
        </button>
      </div>

      <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Suggested preparation sequence</p>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          <li>Take one Interview Mode exam cold to get a baseline. Don&apos;t study first.</li>
          <li>Study Mode on your weakest domain, then &quot;only questions I have answered wrong&quot; until the list is empty.</li>
          <li>One scenario per session: write the full proposal <em>out loud</em> as if at a whiteboard, then reveal and self-assess.</li>
          <li>Prioritise the tuning scenarios: upgrade regression, SQL rewrite, compile storm, lock waits, I/O.</li>
          <li>Retake Interview Mode until you are above 80% on two consecutive attempts.</li>
          <li>Finish with the public-sector interview module: introduction, CV-gap answer, STAR stories, questions to ask.</li>
        </ol>
      </div>

      {examHistory.length > 0 && (
        <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Interview Mode history</p>
            <button onClick={clearExamHistory} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">Clear</button>
          </div>
          <div className="space-y-1">
            {examHistory.slice(0, 8).map(r => {
              const pct = Math.round((r.correct / r.total) * 100);
              return (
                <div key={r.takenAt} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--color-text-muted)]">{new Date(r.takenAt).toLocaleString()}</span>
                  <span className={pct >= 80 ? "text-green-400" : "text-amber-400"}>{r.correct}/{r.total} · {pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
        Domains: {(Object.keys(DOMAIN_LABELS) as InterviewDomain[]).map(d => DOMAIN_LABELS[d]).join(" · ")}. Verify version-specific
        minimum fix pack levels and operator details against current IBM documentation for the exact release the client runs.
      </p>
    </div>
  );
}

export function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium",
        active
          ? "bg-[var(--color-surface-active)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
      )}
    >
      {icon}{label}
    </button>
  );
}
