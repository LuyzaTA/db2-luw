"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, GraduationCap, MessagesSquare, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { href: "/ibm-interview",               label: "Overview",   icon: LayoutGrid,      exact: true },
  { href: "/ibm-interview/concepts",      label: "Concepts",   icon: BookOpen },
  { href: "/ibm-interview/readiness",     label: "Readiness",  icon: GraduationCap },
  { href: "/ibm-interview/public-sector", label: "Public Sector", icon: MessagesSquare },
];

export function InterviewSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 px-3 sm:px-4 h-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] shrink-0 overflow-x-auto whitespace-nowrap">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mr-3 hidden sm:inline">
        IBM Interview
      </span>
      {SECTIONS.map(s => {
        const active = s.exact ? pathname === s.href : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium",
              active
                ? "bg-[var(--color-surface-active)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <s.icon size={12} />
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
