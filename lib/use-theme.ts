"use client";

import { useEffect, useState } from "react";
import { useSessionStore, type ThemePreference } from "./session-store";

export type ResolvedTheme = "light" | "dark";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

/**
 * Keeps <html data-theme> in sync with the stored preference.
 * The initial value is set by an inline script in the layout, so there is no
 * flash on first paint; this hook takes over once React has hydrated.
 */
export function useTheme() {
  const { theme, setTheme } = useSessionStore();
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(theme);
      document.documentElement.setAttribute("data-theme", next);
      setResolved(next);
    };
    apply();

    // Follow the OS while the preference is "system"
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return {
    preference: theme,
    resolved,
    setTheme,
    toggle: () => setTheme(resolved === "dark" ? "light" : "dark"),
  };
}
