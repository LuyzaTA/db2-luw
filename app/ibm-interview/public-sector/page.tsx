"use client";

import { AppShell } from "@/components/layout/AppShell";
import { InterviewSubNav } from "@/components/interview/InterviewSubNav";
import { DutchInterview } from "@/components/dutch/DutchInterview";

export default function PublicSectorPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <InterviewSubNav />
        <div className="flex-1 overflow-hidden">
          <DutchInterview />
        </div>
      </div>
    </AppShell>
  );
}
