import Link from "next/link";
import { Map, Brain, AlertTriangle, Terminal, ArrowRight, Database, Activity } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DB2_CONCEPTS, CATEGORY_LABELS } from "@/lib/db2-concepts";
import { DB2_INCIDENTS } from "@/lib/db2-incidents";
import { DB2_COMMANDS } from "@/lib/db2-commands";

const MODULES = [
  {
    href: "/atlas",
    icon: Map,
    title: "Concept Atlas",
    description: "Interactive graph of DB2 LUW concepts with relationships, parameters, commands, and expert notes. Navigate the knowledge network visually.",
    stats: `${DB2_CONCEPTS.length} concepts · ${Object.keys(CATEGORY_LABELS).length} categories`,
    accent: "border-blue-900 hover:border-blue-700",
    iconColor: "text-blue-500",
    badge: "Core",
  },
  {
    href: "/recall",
    icon: Brain,
    title: "Memory Reconstruction",
    description: "Spaced repetition session designed for dormant expertise. Recognition-first prompts, familiarity ratings, no pressure mechanics.",
    stats: "SM-2 adaptive scheduling · 5-level familiarity scale",
    accent: "border-teal-900 hover:border-teal-700",
    iconColor: "text-teal-500",
    badge: "Recall",
  },
  {
    href: "/simulator",
    icon: AlertTriangle,
    title: "Incident Simulator",
    description: "Realistic production incidents: HADR failures, log full conditions, deadlock spikes, package cache overflow. Work through at your own pace.",
    stats: `${DB2_INCIDENTS.length} scenarios · progressive reveal`,
    accent: "border-red-900 hover:border-red-700",
    iconColor: "text-red-500",
    badge: "Simulator",
  },
  {
    href: "/commands",
    icon: Terminal,
    title: "Command Recall Trainer",
    description: "Operational scenarios requiring db2pd, MON_GET, backup, HADR, and administration command recall. Progressive hints available.",
    stats: `${DB2_COMMANDS.length} commands · fuzzy matching`,
    accent: "border-green-900 hover:border-green-700",
    iconColor: "text-green-500",
    badge: "Commands",
  },
];

export default function HomePage() {
  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10">

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              <Database size={18} className="text-blue-500" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                Expert Recall Platform
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3 leading-tight">
              IBM DB2 LUW 11.5 / 12
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
              This platform reconnects your existing DB2 expertise — it does not teach from scratch.
              Each module is designed to surface knowledge that is dormant, not absent.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-10">
            {[
              { label: "Concepts",   value: DB2_CONCEPTS.length,  icon: Map },
              { label: "Categories", value: Object.keys(CATEGORY_LABELS).length, icon: Activity },
              { label: "Incidents",  value: DB2_INCIDENTS.length,  icon: AlertTriangle },
              { label: "Commands",   value: DB2_COMMANDS.length,   icon: Terminal },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4">
                <Icon size={14} className="text-[var(--color-text-muted)] mb-2" />
                <div className="text-xl font-bold text-[var(--color-text-primary)]">{value}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Module cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {MODULES.map(mod => (
              <Link
                key={mod.href}
                href={mod.href}
                className={`group block bg-[var(--color-surface-panel)] border rounded-xl p-5 ${mod.accent}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <mod.icon size={18} className={mod.iconColor} />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
                    {mod.badge}
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{mod.title}</h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">{mod.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{mod.stats}</span>
                  <ArrowRight size={12} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
                </div>
              </Link>
            ))}
          </div>

          {/* Coverage areas */}
          <div className="bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-5 mb-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
              Coverage Areas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const count = DB2_CONCEPTS.filter(c => c.category === key).length;
                return (
                  <Link
                    key={key}
                    href={`/atlas`}
                    className="p-3 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]"
                  >
                    <div className="text-xs font-medium text-[var(--color-text-primary)]">{label}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{count} concepts</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Design principle note */}
          <div className="px-4 py-3 border border-[var(--color-border-subtle)] rounded-lg">
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              <span className="text-[var(--color-text-secondary)]">Design principle: </span>
              this platform assumes your DB2 knowledge is encoded but temporarily inaccessible — not lost.
              The goal is retrieval restoration, not re-learning. No streaks, no scores, no timers.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
