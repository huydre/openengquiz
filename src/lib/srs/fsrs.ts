import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";

export type ReviewRating = 1 | 2 | 3 | 4;
export type StoredReviewState = {
  state: "new" | "learning" | "review" | "relearning";
  fsrs: Record<string, unknown>;
  due_at: string;
  reps: number;
  lapses: number;
  last_review_at: string | null;
  version: number;
};

export type IntervalPreview = { dueAt: string; label: string };
export type ReviewIntervals = Record<ReviewRating, IntervalPreview>;

const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

const stateNumber = { new: 0, learning: 1, review: 2, relearning: 3 } as const;
const stateName = ["new", "learning", "review", "relearning"] as const;

function numeric(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hydrate(state: StoredReviewState, now: Date): Card {
  if (state.state === "new" && !state.fsrs.model_version) return createEmptyCard(now);
  if (state.fsrs.model_version !== "FSRS-6") throw new Error("Unsupported FSRS model version");
  const due = new Date(state.due_at);
  const lastReview = state.last_review_at ? new Date(state.last_review_at) : undefined;
  if (Number.isNaN(due.getTime()) || (lastReview && Number.isNaN(lastReview.getTime()))) {
    throw new Error("Invalid FSRS dates");
  }
  return {
    due,
    stability: numeric(state.fsrs.stability, 0),
    difficulty: numeric(state.fsrs.difficulty, 0),
    elapsed_days: numeric(state.fsrs.elapsed_days, 0),
    scheduled_days: numeric(state.fsrs.scheduled_days, 0),
    learning_steps: numeric(state.fsrs.learning_steps, 0),
    reps: state.reps,
    lapses: state.lapses,
    state: stateNumber[state.state],
    last_review: lastReview,
  } as Card;
}

function persist(card: Card, version: number): StoredReviewState {
  return {
    state: stateName[card.state] ?? "new",
    fsrs: {
      model_version: "FSRS-6",
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
    },
    due_at: card.due.toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    last_review_at: card.last_review?.toISOString() ?? null,
    version,
  };
}

function intervalLabel(due: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}

export function previewIntervals(state: StoredReviewState, now = new Date()): ReviewIntervals {
  const previews = scheduler.repeat(hydrate(state, now), now);
  return {
    1: { dueAt: previews[Rating.Again].card.due.toISOString(), label: intervalLabel(previews[Rating.Again].card.due, now) },
    2: { dueAt: previews[Rating.Hard].card.due.toISOString(), label: intervalLabel(previews[Rating.Hard].card.due, now) },
    3: { dueAt: previews[Rating.Good].card.due.toISOString(), label: intervalLabel(previews[Rating.Good].card.due, now) },
    4: { dueAt: previews[Rating.Easy].card.due.toISOString(), label: intervalLabel(previews[Rating.Easy].card.due, now) },
  };
}

export function applyRating(state: StoredReviewState, rating: ReviewRating, now = new Date()) {
  const current = hydrate(state, now);
  const result = scheduler.next(current, now, rating);
  return {
    next: persist(result.card, state.version + 1),
    log: { elapsedDays: result.log.elapsed_days, scheduledDays: result.log.scheduled_days },
    intervals: previewIntervals(state, now),
  };
}
