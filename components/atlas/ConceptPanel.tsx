"use client";

import { X, Bookmark, BookmarkCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { CategoryBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSessionStore } from "@/lib/session-store";
import type { Db2Concept } from "@/types/db2";
import { DB2_CONCEPTS } from "@/lib/db2-concepts";

interface ConceptPanelProps {
  concept: Db2Concept;
  onClose: () => void;
  onNavigateTo: (conceptId: string) => void;
}

export function ConceptPanel({ concept, onClose, onNavigateTo }: ConceptPanelProps) {
  const { toggleBookmark, getProgress } = useSessionStore();
  const progress = getProgress(concept.id);

  const connectedConcepts = concept.connections
    .map(c => ({ connection: c, concept: DB2_CONCEPTS.find(d => d.id === c.targetId) }))
    .filter(c => c.concept != null);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-panel)] border-l border-[var(--color-border-default)] w-96 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex-1 min-w-0 mr-3">
          <CategoryBadge category={concept.category} />
          <h2 className="mt-2 text-base font-semibold text-[var(--color-text-primary)] leading-tight">
            {concept.title}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {concept.shortDescription}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => toggleBookmark(concept.id)}
            className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-amber-400"
            title={progress.bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {progress.bookmarked
              ? <BookmarkCheck size={15} className="text-amber-400" />
              : <Bookmark size={15} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Overview */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Overview</h3>
          <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-2">
            {concept.overview.split('\n\n').map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--color-text-primary)]">$1</strong>') }} />
            ))}
          </div>
        </section>

        {/* Key Parameters */}
        {concept.keyParameters.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Key Parameters</h3>
            <div className="space-y-2">
              {concept.keyParameters.map(param => (
                <div key={param.name} className="bg-[var(--color-surface-elevated)] rounded-lg p-3 border border-[var(--color-border-subtle)]">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-[11px] text-[var(--color-text-code)] font-mono font-semibold">{param.name}</code>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase">{param.scope}</span>
                    {param.defaultValue && (
                      <span className="text-[10px] text-[var(--color-text-param)] font-mono">= {param.defaultValue}</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{param.description}</p>
                  {param.tuningNote && (
                    <p className="text-[10px] text-amber-400 mt-1 leading-relaxed">⟶ {param.tuningNote}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Commands */}
        {concept.commands.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Commands</h3>
            <div className="space-y-2">
              {concept.commands.map((cmd, i) => (
                <div key={i} className="bg-[#050810] rounded-lg p-3 border border-[var(--color-border-subtle)]">
                  <code className="text-[11px] text-[var(--color-text-code)] font-mono block mb-1 leading-relaxed break-all">
                    {cmd.syntax}
                  </code>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{cmd.description}</p>
                  {cmd.example && (
                    <code className="text-[10px] text-[var(--color-text-param)] font-mono block mt-1.5 leading-relaxed break-all">
                      {cmd.example}
                    </code>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Expert Notes */}
        {concept.expertNotes.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Expert Notes</h3>
            <ul className="space-y-2">
              {concept.expertNotes.map((note, i) => (
                <li key={i} className="flex gap-2 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  <span className="text-blue-500 shrink-0 mt-0.5">◆</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Connected Concepts */}
        {connectedConcepts.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Connected Concepts</h3>
            <div className="space-y-1">
              {connectedConcepts.map(({ connection, concept: target }) => (
                target && (
                  <button
                    key={connection.targetId}
                    onClick={() => onNavigateTo(connection.targetId)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] text-left group"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-[var(--color-text-primary)] block">{target.title}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{connection.label}</span>
                    </span>
                    <ChevronRight size={12} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
                  </button>
                )
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
