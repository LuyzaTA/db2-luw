"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { InterviewDomain } from "@/types/interview";

export interface ExamResult {
  takenAt: number;
  total: number;
  correct: number;
  byDomain: Partial<Record<InterviewDomain, { total: number; correct: number }>>;
  missedIds: string[];
}

export type AnswerReadiness = "rough" | "ok" | "ready";

interface InterviewStore {
  examHistory: ExamResult[];
  missedQuestionIds: string[];                         // Wrong at least once, not yet answered right since
  scenarioNotes: Record<string, string>;               // Your written proposal per scenario
  scenarioChecks: Record<string, number[]>;            // Rubric key points you covered
  answerReadiness: Record<string, AnswerReadiness>;    // Dutch interview question practice

  recordExam: (result: ExamResult) => void;
  recordAnswer: (questionId: string, isCorrect: boolean) => void;
  setScenarioNote: (id: string, note: string) => void;
  toggleScenarioCheck: (id: string, index: number) => void;
  setAnswerReadiness: (id: string, value: AnswerReadiness) => void;
  clearExamHistory: () => void;
}

export const useInterviewStore = create<InterviewStore>()(
  persist(
    (set) => ({
      examHistory: [],
      missedQuestionIds: [],
      scenarioNotes: {},
      scenarioChecks: {},
      answerReadiness: {},

      recordExam: (result) =>
        set(s => ({ examHistory: [result, ...s.examHistory].slice(0, 20) })),

      recordAnswer: (questionId, isCorrect) =>
        set(s => {
          const missed = new Set(s.missedQuestionIds);
          if (isCorrect) missed.delete(questionId);
          else missed.add(questionId);
          return { missedQuestionIds: [...missed] };
        }),

      setScenarioNote: (id, note) =>
        set(s => ({ scenarioNotes: { ...s.scenarioNotes, [id]: note } })),

      toggleScenarioCheck: (id, index) =>
        set(s => {
          const current = new Set(s.scenarioChecks[id] ?? []);
          if (current.has(index)) current.delete(index);
          else current.add(index);
          return { scenarioChecks: { ...s.scenarioChecks, [id]: [...current] } };
        }),

      setAnswerReadiness: (id, value) =>
        set(s => ({ answerReadiness: { ...s.answerReadiness, [id]: value } })),

      clearExamHistory: () => set({ examHistory: [] }),
    }),
    { name: "db2-interview-readiness" }
  )
);
