"use client";

import { useState, useCallback } from "react";
import { ChevronRight, Eye, Bookmark, BookmarkCheck, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/ui/Badge";
import { useSessionStore } from "@/lib/session-store";
import { getDueConcepts, FAMILIARITY_LABELS, FAMILIARITY_DESCRIPTIONS } from "@/lib/spaced-repetition";
import { DB2_CONCEPTS, CONCEPT_MAP } from "@/lib/db2-concepts";
import type { FamiliarityLevel } from "@/types/db2";

type Phase = "prompt" | "reveal" | "rate";

interface ReviewedItem { id: string; rating: FamiliarityLevel; }

export function RecallSession() {
  const { progress, updateProgress, toggleBookmark, getProgress } = useSessionStore();

  const [queue, setQueue] = useState<string[]>(() =>
    getDueConcepts(progress, DB2_CONCEPTS.map(c => c.id), 12)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [hintVisible, setHintVisible] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedItem[]>([]);
  const [sessionDone, setSessionDone] = useState(false);

  const currentId = queue[currentIndex];
  const currentConcept = currentId ? CONCEPT_MAP.get(currentId) : undefined;
  const currentProgress = currentId ? getProgress(currentId) : null;

  const handleReveal = () => setPhase("reveal");
  const handleRate = () => setPhase("rate");

  const handleFamiliarityRating = useCallback((rating: FamiliarityLevel) => {
    if (!currentId) return;
    updateProgress(currentId, rating);
    setReviewed(prev => [...prev, { id: currentId, rating }]);

    if (currentIndex + 1 >= queue.length) {
      setSessionDone(true);
    } else {
      setCurrentIndex(i => i + 1);
      setPhase("prompt");
      setHintVisible(false);
    }
  }, [currentId, currentIndex, queue.length, updateProgress]);

  const handleRestart = () => {
    const newQueue = getDueConcepts(progress, DB2_CONCEPTS.map(c => c.id), 12);
    setQueue(newQueue);
    setCurrentIndex(0);
    setPhase("prompt");
    setHintVisible(false);
    setReviewed([]);
    setSessionDone(false);
  };

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          All concepts are current
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
          No concepts are due for review right now. Return when the schedule indicates a concept is ready — the system will surface it automatically.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          {Object.keys(progress).length} concepts tracked · next review will appear as scheduled
        </p>
      </div>
    );
  }

  if (sessionDone) {
    const strong = reviewed.filter(r => r.rating >= 4).length;
    const emerging = reviewed.filter(r => r.rating === 3).length;
    const reconnecting = reviewed.filter(r => r.rating <= 2).length;
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="max-w-md w-full">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Session complete</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {reviewed.length} concepts reviewed. Your recall map has been updated.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Fully active", value: strong, color: "text-blue-400" },
              { label: "Emerging", value: emerging, color: "text-green-400" },
              { label: "Reconnecting", value: reconnecting, color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-lg p-3 text-center">
                <div className={cn("text-xl font-bold", color)}>{value}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-1 mb-6">
            {reviewed.map(r => {
              const c = CONCEPT_MAP.get(r.id);
              return c ? (
                <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-[var(--color-border-subtle)]">
                  <span className="text-xs text-[var(--color-text-secondary)] flex-1">{c.title}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{FAMILIARITY_LABELS[r.rating]}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <span key={n} className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        n <= r.rating ? "bg-blue-500" : "bg-[var(--color-border-subtle)]"
                      )} />
                    ))}
                  </div>
                </div>
              ) : null;
            })}
          </div>

          <Button onClick={handleRestart} variant="secondary" className="w-full gap-2">
            <RotateCcw size={14} />
            Start another session
          </Button>
        </div>
      </div>
    );
  }

  if (!currentConcept) return null;

  const totalCards = queue.length;
  const prog = getProgress(currentConcept.id);

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="h-0.5 bg-[var(--color-border-subtle)] shrink-0">
        <div
          className="h-full bg-blue-600"
          style={{ width: `${(currentIndex / totalCards) * 100}%` }}
        />
      </div>

      {/* Main card area */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start py-8 px-4">
        <div className="w-full max-w-2xl">
          {/* Session counter */}
          <div className="flex items-center justify-between mb-5 text-xs text-[var(--color-text-muted)]">
            <span>{currentIndex + 1} of {totalCards}</span>
            <div className="flex items-center gap-3">
              {prog.reviewCount > 0 && (
                <span className="font-mono">reviewed {prog.reviewCount}×</span>
              )}
              <button
                onClick={() => toggleBookmark(currentConcept.id)}
                className="text-[var(--color-text-muted)] hover:text-amber-400"
              >
                {prog.bookmarked ? <BookmarkCheck size={13} className="text-amber-400" /> : <Bookmark size={13} />}
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-6 mb-4">
            {/* Category */}
            <div className="mb-4">
              <CategoryBadge category={currentConcept.category} />
            </div>

            {/* Recall prompt — always visible */}
            <div className="mb-5">
              <p className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Reconnection prompt</p>
              <p className="text-base font-medium text-[var(--color-text-primary)] leading-relaxed">
                {currentConcept.recallPrompt}
              </p>
            </div>

            {/* Hint — optional */}
            {!hintVisible && phase === "prompt" && currentConcept.recallHint && (
              <button
                onClick={() => setHintVisible(true)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] underline underline-offset-2"
              >
                I need a connection hint
              </button>
            )}

            {hintVisible && currentConcept.recallHint && (
              <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Hint</p>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{currentConcept.recallHint}</p>
              </div>
            )}

            {/* Reveal button */}
            {phase === "prompt" && (
              <Button onClick={handleReveal} variant="secondary" className="mt-4 gap-2">
                <Eye size={14} />
                Reveal concept
              </Button>
            )}

            {/* Revealed content */}
            {(phase === "reveal" || phase === "rate") && (
              <div className="mt-5 pt-5 border-t border-[var(--color-border-subtle)]">
                <p className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                  {currentConcept.title}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
                  {currentConcept.shortDescription}
                </p>
                {/* First paragraph of overview */}
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {currentConcept.overview.split('\n\n')[0].replace(/\*\*/g, "")}
                </p>

                {phase === "reveal" && (
                  <Button onClick={handleRate} variant="secondary" className="mt-4 gap-2">
                    <ChevronRight size={14} />
                    Rate recall
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Rating buttons */}
          {phase === "rate" && (
            <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5">
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                How connected does this feel right now?
              </p>
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as FamiliarityLevel[]).map(rating => (
                  <button
                    key={rating}
                    onClick={() => handleFamiliarityRating(rating)}
                    className={cn("confidence-btn", `level-${rating}`, "flex flex-col gap-1 p-2 h-auto")}
                  >
                    <span className="text-base font-bold">{rating}</span>
                    <span className="text-[9px] leading-tight text-center">
                      {FAMILIARITY_LABELS[rating].split(" ").slice(0, 2).join(" ")}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-3 hidden sm:grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as FamiliarityLevel[]).map(rating => (
                  <p key={rating} className="text-[9px] text-[var(--color-text-muted)] text-center leading-tight">
                    {FAMILIARITY_DESCRIPTIONS[rating]}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
