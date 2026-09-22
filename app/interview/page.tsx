"use client";

import { AppShell } from "@/components/layout/AppShell";
import { InterviewPrep } from "@/components/interview/InterviewPrep";

export default function InterviewPage() {
  return (
    <AppShell>
      <div className="h-full">
        <InterviewPrep />
      </div>
    </AppShell>
  );
}
