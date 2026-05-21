"use client";

import { AppShell } from "@/components/layout/AppShell";
import { CommandTrainer } from "@/components/commands/CommandTrainer";

export default function CommandsPage() {
  return (
    <AppShell>
      <div className="h-full">
        <CommandTrainer />
      </div>
    </AppShell>
  );
}
