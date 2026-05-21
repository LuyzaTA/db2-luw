"use client";

import { AppShell } from "@/components/layout/AppShell";
import { IncidentSimulator } from "@/components/simulator/IncidentSimulator";

export default function SimulatorPage() {
  return (
    <AppShell>
      <div className="h-full">
        <IncidentSimulator />
      </div>
    </AppShell>
  );
}
