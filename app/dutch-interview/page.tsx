"use client";

import { AppShell } from "@/components/layout/AppShell";
import { DutchInterview } from "@/components/dutch/DutchInterview";

export default function DutchInterviewPage() {
  return (
    <AppShell>
      <div className="h-full">
        <DutchInterview />
      </div>
    </AppShell>
  );
}
