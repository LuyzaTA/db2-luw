"use client";

import { AppShell } from "@/components/layout/AppShell";
import { InterviewSubNav } from "@/components/interview/InterviewSubNav";
import { ConceptLibrary } from "@/components/interview/ConceptLibrary";

export default function ConceptsPage() {
  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <InterviewSubNav />
        <div className="flex-1 overflow-hidden">
          <ConceptLibrary />
        </div>
      </div>
    </AppShell>
  );
}
