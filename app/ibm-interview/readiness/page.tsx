"use client";

import { AppShell } from "@/components/layout/AppShell";
import { InterviewSubNav } from "@/components/interview/InterviewSubNav";
import { InterviewPrep } from "@/components/interview/InterviewPrep";

export default function ReadinessPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <InterviewSubNav />
        <div className="flex-1 overflow-hidden">
          <InterviewPrep />
        </div>
      </div>
    </AppShell>
  );
}
