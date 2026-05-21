"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/cn";
import type { Db2Concept } from "@/types/db2";

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  architecture: { bg: "bg-[#0e2040]", border: "border-[#1e4080]", text: "text-blue-200",  dot: "bg-blue-500" },
  memory:       { bg: "bg-[#0a2030]", border: "border-[#0d6080]", text: "text-teal-200",  dot: "bg-teal-500" },
  logging:      { bg: "bg-[#201500]", border: "border-[#604020]", text: "text-amber-200", dot: "bg-amber-500" },
  hadr:         { bg: "bg-[#180d35]", border: "border-[#3d1a80]", text: "text-purple-200",dot: "bg-purple-500" },
  performance:  { bg: "bg-[#081a10]", border: "border-[#0d5020]", text: "text-green-200", dot: "bg-green-500" },
  monitoring:   { bg: "bg-[#101828]", border: "border-[#203060]", text: "text-slate-200", dot: "bg-slate-400" },
  locking:      { bg: "bg-[#200808]", border: "border-[#801818]", text: "text-red-200",   dot: "bg-red-500" },
  admin:        { bg: "bg-[#141020]", border: "border-[#302050]", text: "text-violet-200",dot: "bg-violet-400" },
};

export interface ConceptNodeData {
  concept: Db2Concept;
  isSelected: boolean;
  familiarity: number;
}

export const ConceptNode = memo(function ConceptNode({ data }: NodeProps) {
  const { concept, isSelected, familiarity } = data as unknown as ConceptNodeData;
  const styles = CATEGORY_STYLES[concept.category] ?? CATEGORY_STYLES.admin;

  return (
    <>
      <Handle type="target" position={Position.Left} className="!border-none !w-2 !h-2 !bg-[var(--color-border-strong)]" />
      <Handle type="source" position={Position.Right} className="!border-none !w-2 !h-2 !bg-[var(--color-border-strong)]" />

      <div className={cn(
        "w-44 px-3 py-2.5 rounded-lg border text-left cursor-pointer",
        styles.bg, styles.border,
        isSelected && "ring-1 ring-blue-500 ring-offset-0",
      )}>
        {/* Header row */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className={cn("mt-0.5 w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />
          <span className={cn("text-xs font-semibold leading-tight", styles.text)}>
            {concept.title}
          </span>
        </div>

        {/* Short description */}
        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
          {concept.shortDescription}
        </p>

        {/* Familiarity indicator */}
        {familiarity > 0 && (
          <div className="flex gap-0.5 mt-2">
            {[1,2,3,4,5].map(n => (
              <span
                key={n}
                className={cn(
                  "flex-1 h-0.5 rounded-full",
                  n <= familiarity ? styles.dot : "bg-[var(--color-border-subtle)]"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
});
