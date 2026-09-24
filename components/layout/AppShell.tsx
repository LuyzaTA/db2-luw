"use client";

import { useSessionStore } from "@/lib/session-store";
import { useTheme } from "@/lib/use-theme";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { focusMode } = useSessionStore();
  useTheme();   // keeps <html data-theme> in sync with the stored preference

  return (
    <div
      className="flex flex-col h-[100dvh]"
      data-focus-mode={focusMode}
    >
      <Header />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
