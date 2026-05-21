"use client";

import { AppShell } from "@/components/layout/AppShell";
import { ConceptAtlas } from "@/components/atlas/ConceptAtlas";

export default function AtlasPage() {
  return (
    <AppShell>
      <div className="h-full">
        <ConceptAtlas />
      </div>
    </AppShell>
  );
}
