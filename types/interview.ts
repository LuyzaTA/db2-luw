/* ─────────────────────────────────────────────────────────
   Interview Readiness + Dutch Interview — Type Definitions
   ───────────────────────────────────────────────────────── */

export type InterviewDomain =
  | "tuning"       // Query tuning, EXPLAIN, memory, SQL rewrite
  | "dpf"          // DPF / MPP, distribution, co-location, table partitioning
  | "wlm"          // Workload management
  | "openshift"    // Db2 on OpenShift / Kubernetes (Db2U operator, Helm)
  | "diagnostics"  // db2diag, db2pd, MON_GET, event monitors
  | "automation"   // Linux, shell, Python, Ansible
  | "versions";    // v10.5 → v12.1 lifecycle, upgrades

export interface QuizQuestion {
  id: string;
  domain: InterviewDomain;
  difficulty: 3 | 4 | 5;
  question: string;
  code?: string;                 // Optional EXPLAIN / SQL / output fragment
  options: string[];
  correct: number[];             // One or more correct option indexes
  explanation: string;           // Why the correct answer is correct
  trap?: string;                 // Why the most attractive wrong answer is wrong
}

export interface ScenarioEvidence {
  title: string;
  content: string;               // Rendered monospace
}

export interface ProblemScenario {
  id: string;
  title: string;
  domain: InterviewDomain;
  difficulty: 3 | 4 | 5;
  environment: string;           // One-line estate description
  context: string;               // The situation, as a manager would brief you
  evidence: ScenarioEvidence[];
  tasks: string[];               // What you must answer
  hints: string[];               // Progressive, optional
  solution: {
    analysis: string;            // Diagnosis / reasoning
    actions: string[];           // Ordered proposal
    commands?: string;           // Key commands / SQL
    pitfalls: string[];          // What a weak candidate would do
    keyPoints: string[];         // Rubric: what the interviewer listens for
  };
}

export type DutchCategory =
  | "technical"
  | "behavioural"
  | "personal"
  | "public-sector"
  | "culture";

export interface DutchQuestion {
  id: string;
  category: DutchCategory;
  question: string;
  whyAsked: string;              // What the panel is really testing
  approach: string[];            // Structure of a strong answer
  modelAnswer: string;           // Example answer (first person)
  avoid?: string[];
  followUps?: string[];
}

/* ─── Concept Library (IBM Interview) ──────────────────── */

export type ConceptArea =
  | "core"
  | "dpf"
  | "wlm"
  | "openshift"
  | "tuning"
  | "diagnostics"
  | "automation";

export interface ConceptBlock {
  heading: string;
  body?: string;                 // Paragraphs separated by a blank line
  bullets?: string[];
  code?: { label?: string; content: string };
  diagram?: string;              // DiagramKey
}

export interface TechConcept {
  id: string;
  area: ConceptArea;
  title: string;
  summary: string;
  blocks: ConceptBlock[];
  mustKnow: string[];            // Facts you must be able to state without hesitation
  interviewAngle: string;        // How a panel turns this into a question
  relatedQuizIds?: string[];
  relatedScenarioIds?: string[];
}
