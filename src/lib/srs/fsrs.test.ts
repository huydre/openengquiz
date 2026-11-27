import { describe, expect, it } from "vitest";
import { applyRating, previewIntervals, type StoredReviewState } from "./fsrs";

const now = new Date("2026-11-27T02:00:00.000Z");
const empty: StoredReviewState = {
  state: "new", fsrs: {}, due_at: now.toISOString(), reps: 0, lapses: 0,
  last_review_at: null, version: 0,
};

describe("FSRS scheduling", () => {
  it("schedules Again within minutes", () => {
    const result = applyRating(empty, 1, now);
    const minutes = (new Date(result.next.due_at).getTime() - now.getTime()) / 60000;
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThanOrEqual(15);
  });

  it("schedules Easy beyond Good and Good beyond Hard", () => {
    const preview = previewIntervals(empty, now);
    expect(preview[4].dueAt > preview[3].dueAt).toBe(true);
    expect(preview[3].dueAt > preview[2].dueAt).toBe(true);
  });

  it("increments the version and preserves the scheduled due date", () => {
    const result = applyRating(empty, 3, now);
    expect(result.next.version).toBe(1);
    expect(result.next.due_at).toBe(result.intervals[3].dueAt);
  });
});
