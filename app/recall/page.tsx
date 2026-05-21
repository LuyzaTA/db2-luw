"use client";

import { AppShell } from "@/components/layout/AppShell";
import { RecallSession } from "@/components/recall/RecallSession";

export default function RecallPage() {
  return (
    <AppShell>
      <div className="h-full">
        <RecallSession />
      </div>
    </AppShell>
  );
}
