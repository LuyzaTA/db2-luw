"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, EyeOff, Menu, Database, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/",          label: "Home",      short: "Home" },
  { href: "/atlas",     label: "Concept Atlas",  short: "Atlas" },
  { href: "/recall",    label: "Recall",    short: "Recall" },
  { href: "/simulator", label: "Simulator", short: "Sim" },
  { href: "/commands",  label: "Commands",  short: "CMD" },
  { href: "/ibm-interview", label: "IBM Interview", short: "IBM" },
];

export function Header() {
  const pathname = usePathname();
  const { focusMode, toggleFocusMode, toggleSidebar } = useSessionStore();
  const { preference, resolved, setTheme, toggle } = useTheme();

  return (
    <header className="flex items-center h-12 px-3 sm:px-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-panel)] shrink-0 z-10 gap-1">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-2 sm:mr-6 hover:opacity-80 shrink-0">
        <Database size={16} className="text-blue-500" />
        <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
          DB2 LUW
          <span className="ml-1.5 text-[10px] font-mono text-[var(--color-text-muted)] tracking-widest hidden sm:inline">11.5 / 12</span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap",
              pathname === item.href
                ? "bg-[var(--color-surface-active)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sm:hidden">{item.short}</span>
          </Link>
        ))}
      </nav>

      {/* Controls */}
      <div className="flex items-center gap-1 ml-2 sm:ml-4 shrink-0">
        <button
          onClick={toggle}
          onDoubleClick={() => setTheme("system")}
          title={
            preference === "system"
              ? `Theme: following your system (${resolved}). Click to switch.`
              : `Theme: ${preference}. Click to switch, double-click to follow your system.`
          }
          aria-label="Toggle light or dark theme"
          className="p-2 sm:p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] relative"
        >
          {resolved === "dark" ? <Moon size={14} /> : <Sun size={14} />}
          {preference === "system" && (
            <MonitorSmartphone size={8} className="absolute bottom-0.5 right-0.5 opacity-70" />
          )}
        </button>
        <button
          onClick={toggleFocusMode}
          title={focusMode ? "Exit focus mode" : "Enter focus mode"}
          className={cn(
            "p-2 sm:p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]",
            focusMode && "text-blue-400 hover:text-blue-300"
          )}
        >
          {focusMode ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </header>
  );
}
