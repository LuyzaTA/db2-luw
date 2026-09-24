"use client";

import Link from "next/link";
import { BookOpen, GraduationCap, MessagesSquare, ArrowRight, Briefcase } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { InterviewSubNav } from "@/components/interview/InterviewSubNav";
import { TECH_CONCEPTS, AREA_LABELS, AREA_VACANCY_LINE } from "@/lib/interview-concepts";
import { QUIZ_QUESTIONS } from "@/lib/interview-quiz";
import { PROBLEM_SCENARIOS } from "@/lib/interview-scenarios";
import { DUTCH_QUESTIONS } from "@/lib/dutch-interview";
import type { ConceptArea } from "@/types/interview";

const AREA_ORDER: ConceptArea[] = ["core", "tuning", "dpf", "wlm", "openshift", "diagnostics", "automation"];

const SECTIONS = [
  {
    href: "/ibm-interview/concepts",
    icon: BookOpen,
    title: "Concepts",
    description:
      "The technical reference: every area named in the position, explained at senior level with diagrams, commands, what you must be able to state, and how each topic gets asked.",
    stats: `${TECH_CONCEPTS.length} concepts · ${AREA_ORDER.length} areas`,
    accent: "border-blue-900 hover:border-blue-700",
    iconColor: "text-blue-500",
  },
  {
    href: "/ibm-interview/readiness",
    icon: GraduationCap,
    title: "Readiness",
    description:
      "Test yourself. Interview Mode draws a weighted exam with no feedback until the end; Study Mode explains each answer. Problem scenarios make you write a proposal before revealing the solution.",
    stats: `${QUIZ_QUESTIONS.length} questions · ${PROBLEM_SCENARIOS.length} scenarios`,
    accent: "border-amber-900 hover:border-amber-700",
    iconColor: "text-amber-500",
  },
  {
    href: "/ibm-interview/public-sector",
    icon: MessagesSquare,
    title: "Public Sector",
    description:
      "The interview itself, in English: technical, STAR, personal and challenging questions, Dutch public-sector context (BIO, AVG, VOG, OTAP), a mock interview drill and questions to ask them.",
    stats: `${DUTCH_QUESTIONS.length} questions · mock drill · briefing`,
    accent: "border-orange-900 hover:border-orange-700",
    iconColor: "text-orange-500",
  },
];

export default function IbmInterviewPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <InterviewSubNav />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
            <header>
              <div className="flex items-center gap-2.5 mb-3">
                <Briefcase size={16} className="text-amber-500" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                  IBM Interview · Senior Db2 LUW DBA
                </span>
              </div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Everything for this position, in one place
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
                Review the concepts first, then test recall under interview conditions, then prepare the conversation itself.
                Content is weighted toward performance and tuning, which is where this panel will go deepest.
              </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SECTIONS.map(s => (
                <Link key={s.href} href={s.href} className={`group block bg-[var(--color-surface-panel)] border rounded-xl p-5 ${s.accent}`}>
                  <div className="flex items-center justify-between mb-3">
                    <s.icon size={18} className={s.iconColor} />
                    <ArrowRight size={13} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
                  </div>
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{s.title}</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">{s.description}</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{s.stats}</p>
                </Link>
              ))}
            </div>

            <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl divide-y divide-[var(--color-border-subtle)]">
              <div className="px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Coverage against the position</p>
              </div>
              {AREA_ORDER.map(area => {
                const items = TECH_CONCEPTS.filter(c => c.area === area);
                return (
                  <Link key={area} href="/ibm-interview/concepts" className="block px-4 py-3 hover:bg-[var(--color-surface-hover)]">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{AREA_LABELS[area]}</p>
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] whitespace-nowrap">{items.length} concepts</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-1 italic">&ldquo;{AREA_VACANCY_LINE[area]}&rdquo;</p>
                  </Link>
                );
              })}
            </div>

            <div className="px-4 py-3 border border-[var(--color-border-subtle)] rounded-lg">
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                <span className="text-[var(--color-text-secondary)]">How to use this: </span>
                read a concept, then immediately take the matching questions in Readiness while it is fresh.
                Scenarios are best done out loud, as if at a whiteboard. Finish each session in Public Sector with one
                personal or STAR answer spoken end to end.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
