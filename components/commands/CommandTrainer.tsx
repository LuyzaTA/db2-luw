"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronRight, Eye, RotateCcw, CheckCircle, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Terminal } from "@/components/ui/Terminal";
import { DB2_COMMANDS, COMMAND_CATEGORIES } from "@/lib/db2-commands";
import type { CommandEntry } from "@/types/db2";
import { BackBar } from "@/components/ui/BackBar";

function normalizeCommand(cmd: string): string {
  return cmd.toLowerCase().replace(/\s+/g, " ").trim();
}

function commandMatch(input: string, target: string): "exact" | "close" | "no" {
  const normInput = normalizeCommand(input);
  const normTarget = normalizeCommand(target);
  if (normInput === normTarget) return "exact";
  // Fuzzy: if input contains all "words" of the target command name
  const targetWords = normTarget.split(" ").filter(w => w.length > 2);
  const inputWords = normInput.split(" ");
  const allPresent = targetWords.every(tw => inputWords.some(iw => iw.includes(tw) || tw.includes(iw)));
  if (allPresent && normInput.length > 5) return "close";
  return "no";
}

export function CommandTrainer() {
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommand, setSelectedCommand] = useState<CommandEntry | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [attemptResult, setAttemptResult] = useState<"exact" | "close" | "no" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = DB2_COMMANDS.filter(cmd => {
    if (filterCategory && cmd.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q) || cmd.recallScenario.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSelect = (cmd: CommandEntry) => {
    setSelectedCommand(cmd);
    setUserInput("");
    setShowAnswer(false);
    setShowHint(false);
    setAttemptResult(null);
    setMobileDetail(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleAttempt = useCallback(() => {
    if (!selectedCommand || !userInput.trim()) return;
    const result = commandMatch(userInput, selectedCommand.name);
    setAttemptResult(result);
    if (result !== "exact") {
      // Don't auto-reveal — let user decide
    }
  }, [selectedCommand, userInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAttempt();
  };

  const handleReset = () => {
    setUserInput("");
    setShowAnswer(false);
    setShowHint(false);
    setAttemptResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="flex h-full">
      {/* Left: Command list */}
      <div className={cn(
        "w-full md:w-72 border-r border-[var(--color-border-subtle)] flex-col shrink-0",
        mobileDetail ? "hidden md:flex" : "flex"
      )}>
        {/* Search */}
        <div className="p-3 border-b border-[var(--color-border-subtle)]">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search commands..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-lg pl-7 pr-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        {/* Category filters */}
        <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-[var(--color-border-subtle)]">
          <button
            onClick={() => setFilterCategory(null)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-mono border",
              !filterCategory ? "bg-blue-900 border-blue-700 text-blue-200" : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >All</button>
          {COMMAND_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono border",
                filterCategory === cat ? "bg-blue-900 border-blue-700 text-blue-200" : "border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >{cat}</button>
          ))}
        </div>

        {/* Command list */}
        <div className="flex-1 overflow-y-auto">
          {filteredCommands.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => handleSelect(cmd)}
              className={cn(
                "w-full text-left px-4 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]",
                selectedCommand?.id === cmd.id && "bg-[var(--color-surface-hover)] border-l-2 border-l-blue-600"
              )}
            >
              <div className="text-xs font-mono font-semibold text-[var(--color-text-code)] mb-0.5">{cmd.name}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] leading-tight line-clamp-2">{cmd.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Trainer area */}
      <div className={cn("flex-1 overflow-y-auto", mobileDetail ? "block" : "hidden md:block")}>
        {selectedCommand && <BackBar onBack={() => setMobileDetail(false)} label="All commands" />}
        <div className="p-4 sm:p-6">
        {!selectedCommand ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-[var(--color-text-muted)]">Select a command to begin recall training</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">You&apos;ll be presented with an operational scenario and asked to recall the command</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Scenario */}
            <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Operational Scenario</p>
              <p className="text-base font-medium text-[var(--color-text-primary)] leading-relaxed">
                {selectedCommand.recallScenario}
              </p>
            </div>

            {/* Input */}
            <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-default)] rounded-xl p-5">
              <label className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] block mb-3">
                Your answer (command name or syntax)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[var(--color-text-muted)] font-mono text-xs">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={e => { setUserInput(e.target.value); setAttemptResult(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type the command..."
                  className="w-full bg-[#050810] border border-[var(--color-border-default)] rounded-lg pl-7 pr-3 py-2.5 font-mono text-sm text-[var(--color-text-code)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-700"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>

              {/* Attempt result */}
              {attemptResult && (
                <div className={cn(
                  "mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2",
                  attemptResult === "exact" && "bg-green-950 border border-green-800 text-green-300",
                  attemptResult === "close" && "bg-amber-950 border border-amber-800 text-amber-300",
                  attemptResult === "no"    && "bg-red-950 border border-red-800 text-red-300",
                )}>
                  {attemptResult === "exact" && <><CheckCircle size={12} /> Close match — check exact syntax below</>}
                  {attemptResult === "close" && <>Almost — key parts are there, verify the flags</>}
                  {attemptResult === "no"    && <>Not quite — try a hint or reveal the answer</>}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button onClick={handleAttempt} variant="primary" size="sm">Check</Button>
                {!showHint && (
                  <Button onClick={() => setShowHint(true)} variant="ghost" size="sm">
                    Show hint
                  </Button>
                )}
                <Button onClick={() => setShowAnswer(true)} variant="ghost" size="sm">
                  <Eye size={12} />
                  Reveal
                </Button>
                <Button onClick={handleReset} variant="ghost" size="sm">
                  <RotateCcw size={12} />
                </Button>
              </div>
            </div>

            {/* Progressive hint */}
            {showHint && !showAnswer && (
              <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-default)] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">Hint</p>
                <code className="text-sm font-mono text-[var(--color-text-code)]">
                  {selectedCommand.name.split(" ").map((part, i) =>
                    i === 0 ? part : part.replace(/[a-z]/gi, "_")
                  ).join(" ")}
                </code>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{selectedCommand.description.split(". ")[0]}.</p>
              </div>
            )}

            {/* Full answer */}
            {showAnswer && (
              <div className="space-y-4">
                <Terminal
                  title="Full Syntax"
                  lines={[
                    { type: "comment", text: `# ${selectedCommand.description}` },
                    { type: "cmd", text: selectedCommand.fullSyntax },
                  ]}
                />

                {selectedCommand.flags.length > 0 && (
                  <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Flags</p>
                    <div className="space-y-2">
                      {selectedCommand.flags.map(flag => (
                        <div key={flag.flag} className="flex gap-3">
                          <code className="text-[11px] font-mono text-[var(--color-text-code)] shrink-0 pt-0.5">{flag.flag}</code>
                          <p className="text-xs text-[var(--color-text-secondary)]">{flag.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCommand.examples.map((ex, i) => (
                  <Terminal
                    key={i}
                    title={ex.description}
                    lines={[
                      { type: "cmd", text: ex.command },
                      ...(ex.output ? [{ type: "output" as const, text: ex.output }] : []),
                    ]}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
