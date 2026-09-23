"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionState, ConceptProgress, FamiliarityLevel } from "@/types/db2";

export type ThemePreference = "system" | "light" | "dark";
import { computeNextReview, defaultProgress } from "./spaced-repetition";

interface SessionStore extends SessionState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

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

const defaultState: SessionState & { theme: ThemePreference } = {
  theme: "dark",           // dark-first by design; light is opt-in
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

      setTheme: (theme) => set({ theme }),

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
        theme: state.theme,
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
