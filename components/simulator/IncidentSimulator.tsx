"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight, Eye, RotateCcw, Clock, Server } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Terminal } from "@/components/ui/Terminal";
import { Badge } from "@/components/ui/Badge";
import { DB2_INCIDENTS } from "@/lib/db2-incidents";
import { useSessionStore } from "@/lib/session-store";
import type { Incident, InvestigationStep } from "@/types/db2";

type IncidentPhase = "briefing" | "investigating" | "resolution";

const SEVERITY_COLORS = {
  critical: "text-red-400 border-red-900 bg-red-950",
  high:     "text-orange-400 border-orange-900 bg-orange-950",
  medium:   "text-yellow-400 border-yellow-900 bg-yellow-950",
};

export function IncidentSimulator() {
  const { setLastIncidentId } = useSessionStore();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [phase, setPhase] = useState<IncidentPhase>("briefing");
  const [revealedSteps, setRevealedSteps] = useState<Set<string>>(new Set());
  const [showRootCause, setShowRootCause] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncident(incident);
    setPhase("briefing");
    setRevealedSteps(new Set());
    setShowRootCause(false);
    setLastIncidentId(incident.id);
  };

  const handleRevealStep = (stepId: string) => {
    setRevealedSteps(prev => new Set([...prev, stepId]));
  };

  const handleReset = () => {
    setRevealedSteps(new Set());
    setShowRootCause(false);
    setPhase("briefing");
  };

  const categories = [...new Set(DB2_INCIDENTS.map(i => i.category))];

  const filteredIncidents = filterCategory
    ? DB2_INCIDENTS.filter(i => i.category === filterCategory)
    : DB2_INCIDENTS;

  return (
    <div className="flex h-full">
      {/* Left: Incident list */}
      <div className="w-72 border-r border-[var(--color-border-subtle)] flex flex-col shrink-0">
        {/* Category filter */}
        <div className="px-3 py-2.5 border-b border-[var(--color-border-subtle)] flex flex-wrap gap-1">
          <button
            onClick={() => setFilterCategory(null)}
            className={cn("px-2 py-0.5 rounded text-[10px] font-mono border", !filterCategory ? "bg-blue-900 border-blue-700 text-blue-200" : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}
          >All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-mono border capitalize", filterCategory === cat ? "bg-blue-900 border-blue-700 text-blue-200" : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]")}
            >{cat}</button>
          ))}
        </div>

        {/* Incident list */}
        <div className="flex-1 overflow-y-auto">
          {filteredIncidents.map(incident => (
            <button
              key={incident.id}
              onClick={() => handleSelectIncident(incident)}
              className={cn(
                "w-full text-left px-4 py-3.5 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]",
                selectedIncident?.id === incident.id && "bg-[var(--color-surface-hover)] border-l-2 border-l-red-700"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={10} className={cn(
                  incident.severity === "critical" ? "text-red-500" :
                  incident.severity === "high" ? "text-orange-500" : "text-yellow-500"
                )} />
                <Badge label={incident.severity} variant="severity" />
                <Badge label={incident.category} variant="category" />
              </div>
              <div className="text-xs font-medium text-[var(--color-text-primary)] leading-snug mt-1">{incident.title}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{incident.affectedSystem}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Incident workspace */}
      <div className="flex-1 overflow-y-auto">
        {!selectedIncident ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <AlertTriangle size={32} className="text-[var(--color-text-muted)] mb-4" />
            <p className="text-sm text-[var(--color-text-muted)]">Select an incident to begin simulation</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2 max-w-sm">Each scenario presents real production symptoms. Work through the investigation at your own pace — reveal steps as needed.</p>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-w-3xl mx-auto">
            {/* Alert header */}
            <div className={cn("border rounded-xl p-4", SEVERITY_COLORS[selectedIncident.severity])}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">Production Incident</span>
                    <Badge label={selectedIncident.severity} variant="severity" />
                  </div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{selectedIncident.title}</h2>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1"><Clock size={11} />{selectedIncident.timestamp}</span>
                    <span className="flex items-center gap-1"><Server size={11} />{selectedIncident.affectedSystem}</span>
                  </div>
                </div>
                <button onClick={handleReset} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {/* Synopsis */}
            <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Incident Synopsis</p>
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{selectedIncident.synopsis}</p>
            </div>

            {/* Symptoms */}
            <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Observable Symptoms</p>
              <ul className="space-y-1.5">
                {selectedIncident.symptoms.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="text-red-500 shrink-0 mt-0.5">▸</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Initial diag — db2diag.log excerpt */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Initial Diagnostic — db2diag.log Excerpt</p>
              <Terminal
                title="db2diag.log"
                lines={selectedIncident.initialDiag.map(entry => ({
                  type: entry.level === "SEVERE" ? "error" as const :
                        entry.level === "WARNING" ? "highlight" as const :
                        entry.level === "EVENT" ? "ok" as const : "output" as const,
                  text: `${entry.timestamp} ${entry.level.padEnd(7)} ${entry.pid} ${entry.message}`,
                }))}
              />
            </div>

            {/* Investigation steps */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Investigation</p>
              <div className="space-y-3">
                {selectedIncident.investigationSteps.map((step, idx) => (
                  <InvestigationCard
                    key={step.id}
                    step={step}
                    stepNumber={idx + 1}
                    isRevealed={revealedSteps.has(step.id)}
                    onReveal={() => handleRevealStep(step.id)}
                    isLocked={idx > 0 && !revealedSteps.has(selectedIncident.investigationSteps[idx - 1].id)}
                  />
                ))}
              </div>
            </div>

            {/* Root cause + resolution */}
            {revealedSteps.size > 0 && !showRootCause && (
              <Button onClick={() => setShowRootCause(true)} variant="secondary" className="w-full gap-2">
                <Eye size={14} />
                Reveal root cause & resolution
              </Button>
            )}

            {showRootCause && (
              <>
                <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-widest text-amber-500 mb-3">Root Cause</p>
                  <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed space-y-2">
                    {selectedIncident.rootCause.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>

                <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-widest text-green-500 mb-3">Resolution</p>
                  <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line font-mono text-xs">
                    {selectedIncident.resolution}
                  </div>
                </div>

                <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Prevention Notes</p>
                  <ul className="space-y-2">
                    {selectedIncident.preventionNotes.map((note, i) => (
                      <li key={i} className="flex gap-2 text-xs text-[var(--color-text-secondary)]">
                        <span className="text-blue-500 shrink-0 mt-0.5">◆</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InvestigationCard({
  step, stepNumber, isRevealed, onReveal, isLocked,
}: {
  step: InvestigationStep;
  stepNumber: number;
  isRevealed: boolean;
  onReveal: () => void;
  isLocked: boolean;
}) {
  return (
    <div className={cn(
      "bg-[var(--color-surface-panel)] border rounded-xl p-4",
      isLocked ? "border-[var(--color-border-subtle)] opacity-50" : "border-[var(--color-border-default)]",
      step.isKeyStep && !isLocked && "border-amber-900"
    )}>
      {/* Prompt */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] pt-0.5 shrink-0">
          {String(stepNumber).padStart(2, "0")}
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">{step.prompt}</p>
          {step.isKeyStep && (
            <span className="text-[9px] text-amber-500 font-mono uppercase tracking-wider mt-0.5 block">⬦ Key diagnostic step</span>
          )}
        </div>
      </div>

      {!isRevealed && !isLocked && (
        <Button onClick={onReveal} variant="ghost" size="sm" className="gap-1.5">
          <ChevronRight size={12} />
          Run investigation step
        </Button>
      )}

      {isRevealed && (
        <div className="space-y-3 mt-2">
          <Terminal
            title="Command"
            lines={[{ type: "cmd", text: step.command }]}
          />
          <div className="bg-[var(--color-surface-elevated)] rounded-lg p-3 border border-[var(--color-border-subtle)]">
            <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">Output Summary</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{step.outputSummary}</p>
          </div>
          <div className="bg-[#0a1a0a] rounded-lg p-3 border border-green-950">
            <p className="text-[9px] uppercase tracking-widest text-green-600 mb-1.5">Interpretation</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{step.interpretation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
