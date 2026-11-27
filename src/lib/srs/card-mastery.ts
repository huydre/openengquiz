/** Where a learner stands with one card, for set progress and flashcard filters. */
export type CardMastery = "new" | "learning" | "mastered";

/**
 * No review state yet means not studied. A card counts as mastered once it is in the review
 * phase with at least 3 successful repetitions (the same rule as the stats page); anything
 * else in the schedule is still being learned.
 */
export function cardMastery(state: { state: string; reps: number } | null | undefined): CardMastery {
  if (!state) return "new";
  return state.state === "review" && state.reps >= 3 ? "mastered" : "learning";
}

export const MASTERY_LABELS: Record<CardMastery, string> = {
  new: "Chưa học",
  learning: "Đang học",
  mastered: "Thành thạo",
};
