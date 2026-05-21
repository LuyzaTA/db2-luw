import type { ConceptProgress, FamiliarityLevel } from "@/types/db2";

/* ─────────────────────────────────────────────────────────
   Adapted SM-2 algorithm for expert memory reconstruction.

   Key differences from standard SM-2:
   - No "failure" concept — all ratings are progress
   - Familiarity scale (1-5) framed as recognition, not score
   - Conservative intervals at low familiarity (less pressure)
   - No streak mechanics — each session is a fresh start
   ───────────────────────────────────────────────────────── */

const MS_PER_DAY = 86_400_000;

/** Compute the next review timestamp given a familiarity rating. */
export function computeNextReview(
  current: ConceptProgress,
  rating: FamiliarityLevel
): ConceptProgress {
  const now = Date.now();
  const reviewCount = current.reviewCount + 1;

  // Interval in days based on familiarity and review history
  let intervalDays: number;

  if (rating <= 2) {
    // Low familiarity: review again soon, but no punishment
    intervalDays = rating === 1 ? 1 : 2;
  } else if (rating === 3) {
    // Emerging recall: 3-4 days
    intervalDays = reviewCount <= 1 ? 3 : 4;
  } else if (rating === 4) {
    // Clear recall: use exponential spacing
    const previousInterval = current.nextReview > 0
      ? Math.max(1, Math.round((current.nextReview - current.lastReviewed) / MS_PER_DAY))
      : 1;
    intervalDays = Math.round(previousInterval * 2.1);
  } else {
    // Full active recall (5): aggressive spacing
    const previousInterval = current.nextReview > 0
      ? Math.max(1, Math.round((current.nextReview - current.lastReviewed) / MS_PER_DAY))
      : 1;
    intervalDays = Math.round(previousInterval * 3.0);
  }

  // Cap at 60 days — expert recall maintenance, not disappearance
  intervalDays = Math.min(intervalDays, 60);

  return {
    ...current,
    familiarity: rating,
    reviewCount,
    lastReviewed: now,
    nextReview: now + intervalDays * MS_PER_DAY,
  };
}

/** Select concepts due for review. */
export function getDueConcepts(
  progress: Record<string, ConceptProgress>,
  allConceptIds: string[],
  limit = 10
): string[] {
  const now = Date.now();

  const due = allConceptIds.filter(id => {
    const p = progress[id];
    if (!p) return true; // Never reviewed — include
    return p.nextReview <= now;
  });

  // Sort: never-reviewed first, then by nextReview ascending (most overdue first)
  due.sort((a, b) => {
    const pa = progress[a];
    const pb = progress[b];
    if (!pa && !pb) return 0;
    if (!pa) return -1;
    if (!pb) return 1;
    return pa.nextReview - pb.nextReview;
  });

  return due.slice(0, limit);
}

/** Session summary statistics. */
export function computeSessionStats(reviewed: Array<{ id: string; rating: FamiliarityLevel }>) {
  const total = reviewed.length;
  const avgRating = total > 0
    ? reviewed.reduce((sum, r) => sum + r.rating, 0) / total
    : 0;
  const strong = reviewed.filter(r => r.rating >= 4).length;
  const emerging = reviewed.filter(r => r.rating === 3).length;
  const reconnecting = reviewed.filter(r => r.rating <= 2).length;

  return { total, avgRating: Math.round(avgRating * 10) / 10, strong, emerging, reconnecting };
}

/** Default progress record for a concept never reviewed. */
export function defaultProgress(conceptId: string): ConceptProgress {
  return {
    conceptId,
    familiarity: 1,
    reviewCount: 0,
    lastReviewed: 0,
    nextReview: 0,
    bookmarked: false,
  };
}

/** Familiarity level labels — framed as reconnection, not scoring. */
export const FAMILIARITY_LABELS: Record<FamiliarityLevel, string> = {
  1: "Not yet connecting",
  2: "Vaguely familiar",
  3: "Recall emerging",
  4: "Clear recall",
  5: "Fully active",
};

export const FAMILIARITY_DESCRIPTIONS: Record<FamiliarityLevel, string> = {
  1: "The concept doesn't surface yet — review it again soon",
  2: "Something is there — the connection is forming",
  3: "The concept is coming back — review in a few days",
  4: "Clear and accessible — review next week",
  5: "Production-confident — this is back",
};
