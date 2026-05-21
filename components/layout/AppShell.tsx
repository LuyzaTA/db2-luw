"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/session-store";
import { Header } from "./Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { focusMode } = useSessionStore();

  return (
    <div
      className="flex flex-col h-full"
      data-focus-mode={focusMode}
    >
      <Header />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
