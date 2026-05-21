"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionState, ConceptProgress, FamiliarityLevel } from "@/types/db2";
import { computeNextReview, defaultProgress } from "./spaced-repetition";

interface SessionStore extends SessionState {
  // Actions
  setLastModule: (module: string) => void;
  setLastConceptId: (id: string | null) => void;
  setLastIncidentId: (id: string | null) => void;
  toggleFocusMode: () => void;
  toggleSidebar: () => void;
  updateProgress: (conceptId: string, rating: FamiliarityLevel) => void;
  toggleBookmark: (conceptId: string) => void;
  getProgress: (conceptId: string) => ConceptProgress;
  resetSession: () => void;
}

const defaultState: SessionState = {
  lastModule: "/",
  lastConceptId: null,
  lastIncidentId: null,
  focusMode: false,
  reducedMotion: false,
  sidebarCollapsed: false,
  progress: {},
  sessionStarted: Date.now(),
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setLastModule: (module) => set({ lastModule: module }),
      setLastConceptId: (id) => set({ lastConceptId: id }),
      setLastIncidentId: (id) => set({ lastIncidentId: id }),

      toggleFocusMode: () => set(s => ({ focusMode: !s.focusMode })),
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      updateProgress: (conceptId, rating) => {
        const current = get().progress[conceptId] ?? defaultProgress(conceptId);
        const updated = computeNextReview(current, rating);
        set(s => ({
          progress: { ...s.progress, [conceptId]: updated },
        }));
      },

      toggleBookmark: (conceptId) => {
        const current = get().progress[conceptId] ?? defaultProgress(conceptId);
        set(s => ({
          progress: {
            ...s.progress,
            [conceptId]: { ...current, bookmarked: !current.bookmarked },
          },
        }));
      },

      getProgress: (conceptId) => {
        return get().progress[conceptId] ?? defaultProgress(conceptId);
      },

      resetSession: () => set({ sessionStarted: Date.now() }),
    }),
    {
      name: "db2-recall-session",
      // Only persist these fields
      partialize: (state) => ({
        lastModule: state.lastModule,
        lastConceptId: state.lastConceptId,
        lastIncidentId: state.lastIncidentId,
        focusMode: state.focusMode,
        reducedMotion: state.reducedMotion,
        sidebarCollapsed: state.sidebarCollapsed,
        progress: state.progress,
        sessionStarted: state.sessionStarted,
      }),
    }
  )
);
