"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Quote, ListChecks, ClipboardList, Lightbulb } from "lucide-react";
import { cn } from "@/lib/cn";
import { TECH_CONCEPTS, AREA_LABELS, AREA_VACANCY_LINE } from "@/lib/interview-concepts";
import type { ConceptArea, ConceptBlock, TechConcept } from "@/types/interview";
import { Diagram, type DiagramKey } from "./ConceptDiagrams";
import { BackBar } from "@/components/ui/BackBar";

const AREA_ORDER: ConceptArea[] = ["core", "tuning", "dpf", "wlm", "openshift", "diagnostics", "automation"];

const AREA_ACCENT: Record<ConceptArea, string> = {
  core:        "border-l-blue-600",
  tuning:      "border-l-green-600",
  dpf:         "border-l-purple-600",
  wlm:         "border-l-teal-600",
  openshift:   "border-l-sky-600",
  diagnostics: "border-l-amber-600",
  automation:  "border-l-zinc-500",
};

export function ConceptLibrary() {
  const [selectedId, setSelectedId] = useState<string>(TECH_CONCEPTS[0].id);
  const [mobileDetail, setMobileDetail] = useState(false);
  const selected = TECH_CONCEPTS.find(c => c.id === selectedId) ?? TECH_CONCEPTS[0];

  return (
    <div className="flex h-full">
      {/* Index */}
      <div className={cn(
        "w-full md:w-72 border-r border-[var(--color-border-subtle)] overflow-y-auto shrink-0",
        mobileDetail ? "hidden md:block" : "block"
      )}>
        {AREA_ORDER.map(area => {
          const items = TECH_CONCEPTS.filter(c => c.area === area);
          if (!items.length) return null;
          return (
            <div key={area}>
              <div className="px-4 py-2 sticky top-0 bg-[var(--color-surface-base)] border-b border-[var(--color-border-subtle)]">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">{AREA_LABELS[area]}</p>
              </div>
              {items.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setMobileDetail(true); }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 border-b border-[var(--color-border-subtle)] border-l-2 border-l-transparent hover:bg-[var(--color-surface-hover)]",
                    selectedId === c.id && cn("bg-[var(--color-surface-hover)]", AREA_ACCENT[c.area])
                  )}
                >
                  <div className="text-xs text-[var(--color-text-primary)] leading-snug">{c.title}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Reading pane */}
      <div className={cn("flex-1 overflow-y-auto", mobileDetail ? "block" : "hidden md:block")}>
        <BackBar onBack={() => setMobileDetail(false)} label="All concepts" />
        <ConceptView key={selected.id} concept={selected} />
      </div>
    </div>
  );
}

function ConceptView({ concept }: { concept: TechConcept }) {
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <header className="space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">{AREA_LABELS[concept.area]}</p>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] leading-tight">{concept.title}</h1>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{concept.summary}</p>
        <div className="flex gap-2 items-start text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-lg p-3 leading-relaxed">
          <Quote size={12} className="shrink-0 mt-0.5" />
          <span><span className="text-[var(--color-text-secondary)]">From the vacancy: </span>{AREA_VACANCY_LINE[concept.area]}</span>
        </div>
      </header>

      {concept.blocks.map((block, i) => <Block key={i} block={block} />)}

      <section className="bg-[var(--color-surface-panel)] border border-blue-900/60 rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-1.5">
          <ListChecks size={12} /> Must be able to state without hesitation
        </p>
        <ul className="space-y-1.5">
          {concept.mustKnow.map((m, i) => (
            <li key={i} className="flex gap-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <span className="text-blue-500 shrink-0">▸</span>{m}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[var(--color-surface-panel)] border border-amber-900/60 rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
          <Lightbulb size={12} /> How this gets asked
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{concept.interviewAngle}</p>
      </section>

      {(concept.relatedQuizIds?.length || concept.relatedScenarioIds?.length) ? (
        <section className="flex flex-wrap gap-2 items-center pt-1">
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mr-1">Practise this</span>
          {concept.relatedQuizIds?.length ? (
            <Link href="/ibm-interview/readiness" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
              <ListChecks size={12} /> {concept.relatedQuizIds.length} quiz question{concept.relatedQuizIds.length > 1 ? "s" : ""}
            </Link>
          ) : null}
          {concept.relatedScenarioIds?.length ? (
            <Link href="/ibm-interview/readiness" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]">
              <ClipboardList size={12} /> {concept.relatedScenarioIds.length} scenario{concept.relatedScenarioIds.length > 1 ? "s" : ""}
            </Link>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function Block({ block }: { block: ConceptBlock }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
        <BookOpen size={13} className="text-[var(--color-text-muted)]" />
        {block.heading}
      </h2>

      {block.body && (
        <div className="space-y-2.5">
          {block.body.split("\n\n").map((p, i) => (
            <p key={i} className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{p}</p>
          ))}
        </div>
      )}

      {block.diagram && <Diagram id={block.diagram as DiagramKey} />}

      {block.bullets && (
        <ul className="space-y-1.5">
          {block.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <span className="text-[var(--color-text-muted)] shrink-0">•</span>{b}
            </li>
          ))}
        </ul>
      )}

      {block.code && (
        <div>
          {block.code.label && (
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">{block.code.label}</p>
          )}
          <pre className="terminal-block text-[11px] leading-relaxed">{block.code.content}</pre>
        </div>
      )}
    </section>
  );
}
