"use client";

import { ChevronLeft } from "lucide-react";

/**
 * Shown only below md: returns from a detail pane to its list.
 * On larger screens list and detail sit side by side, so this is hidden.
 */
export function BackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      onClick={onBack}
      className="md:hidden sticky top-0 z-10 flex items-center gap-1.5 w-full px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-panel)] border-b border-[var(--color-border-subtle)]"
    >
      <ChevronLeft size={14} />
      {label}
    </button>
  );
}
