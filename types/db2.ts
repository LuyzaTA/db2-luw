/* ─────────────────────────────────────────────────────────
   DB2 LUW Expert Recall — Core Type Definitions
   ───────────────────────────────────────────────────────── */

export type ConceptCategory =
  | "architecture"
  | "memory"
  | "logging"
  | "hadr"
  | "performance"
  | "monitoring"
  | "locking"
  | "admin";

export type RelationshipType =
  | "feeds-into"
  | "depends-on"
  | "monitors"
  | "controls"
  | "impacts"
  | "component-of"
  | "triggers"
  | "configures";

export interface Db2Concept {
  id: string;
  slug: string;
  title: string;
  category: ConceptCategory;
  version: string[];                    // ["11.5", "12"]
  shortDescription: string;            // 1-2 sentences, for graph node
  overview: string;                     // Rich expert-level explanation
  keyParameters: Db2Parameter[];
  commands: Db2Command[];
  expertNotes: string[];                // Non-obvious insights, gotchas
  connections: ConceptConnection[];
  recallPrompt: string;                 // Recognition-first question for recall mode
  recallHint?: string;                  // Available after "I need a hint"
  difficulty: 1 | 2 | 3 | 4 | 5;      // Expert depth, not complexity
  position: { x: number; y: number };  // React Flow canvas position
}

export interface Db2Parameter {
  name: string;
  scope: "instance" | "database" | "session" | "registry";
  unit?: string;
  defaultValue?: string;
  description: string;
  tuningNote?: string;
}

export interface Db2Command {
  syntax: string;
  description: string;
  example?: string;
}

export interface ConceptConnection {
  targetId: string;
  type: RelationshipType;
  label: string;
}

/* ─── Incident Simulator ───────────────────────────────── */

export type IncidentSeverity = "critical" | "high" | "medium";
export type IncidentCategory =
  | "hadr"
  | "logging"
  | "locking"
  | "performance"
  | "recovery"
  | "memory"
  | "backup";

export interface Incident {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  affectedSystem: string;
  timestamp: string;                // Simulated alert timestamp
  synopsis: string;                 // Brief alert description
  symptoms: string[];               // Observable symptoms list
  initialDiag: LogEntry[];          // Initial db2diag.log or syslog excerpts
  investigationSteps: InvestigationStep[];
  rootCause: string;                // Full root cause explanation
  resolution: string;               // Step-by-step resolution
  preventionNotes: string[];        // How to prevent recurrence
  relatedConceptIds: string[];
}

export interface LogEntry {
  timestamp: string;
  level: "SEVERE" | "ERROR" | "WARNING" | "INFO" | "EVENT";
  pid: string;
  message: string;
  raw?: string;                     // Full raw log line
}

export interface InvestigationStep {
  id: string;
  prompt: string;                   // "What would you check first?"
  command: string;                  // The command to run
  outputSummary: string;            // What you'd see
  interpretation: string;           // What it means
  isKeyStep: boolean;               // Is this the critical diagnostic?
}

/* ─── Command Recall Trainer ───────────────────────────── */

export interface CommandEntry {
  id: string;
  name: string;
  fullSyntax: string;
  description: string;
  category: string;
  flags: CommandFlag[];
  examples: CommandExample[];
  relatedConceptIds: string[];
  recallScenario: string;           // Operational prompt ("You need to check lock waits...")
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface CommandFlag {
  flag: string;
  description: string;
  example?: string;
}

export interface CommandExample {
  command: string;
  description: string;
  output?: string;
}

/* ─── Session & Progress ───────────────────────────────── */

export type FamiliarityLevel = 1 | 2 | 3 | 4 | 5;
// 1 = "I don't recognise this yet"
// 2 = "Vaguely familiar — I've seen this"
// 3 = "I recall the concept"
// 4 = "Clear recall — I know how to use this"
// 5 = "Fully active — production-confident"

export interface ConceptProgress {
  conceptId: string;
  familiarity: FamiliarityLevel;
  reviewCount: number;
  lastReviewed: number;             // Unix timestamp ms
  nextReview: number;               // Next scheduled review
  bookmarked: boolean;
}

export interface SessionState {
  lastModule: string;
  lastConceptId: string | null;
  lastIncidentId: string | null;
  focusMode: boolean;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  progress: Record<string, ConceptProgress>;
  sessionStarted: number;
}
