export type LearnStep = { cardId: string; stage: "choice" | "type" };

export type LearnState = {
  queue: LearnStep[];
  remaining: string[];
  mastered: string[];
  batch: number;
  batchSize: number;
};

export function createLearnState(cardIds: string[], batchSize = 6): LearnState {
  const unique = [...new Set(cardIds)];
  const size = Math.max(1, Math.min(7, batchSize));
  return {
    queue: unique.slice(0, size).map((cardId) => ({ cardId, stage: "choice" })),
    remaining: unique.slice(size),
    mastered: [],
    batch: unique.length ? 1 : 0,
    batchSize: size,
  };
}

export function advanceLearn(state: LearnState, correct: boolean): LearnState {
  const [current, ...queue] = state.queue;
  if (!current) return state;
  const mastered = [...state.mastered];
  if (current.stage === "choice") {
    queue.push({ cardId: current.cardId, stage: correct ? "type" : "choice" });
  } else if (correct) {
    mastered.push(current.cardId);
  } else {
    queue.push(current);
  }
  if (queue.length || !state.remaining.length) {
    return { ...state, queue, mastered };
  }
  const next = state.remaining.slice(0, state.batchSize);
  return {
    ...state,
    queue: next.map((cardId) => ({ cardId, stage: "choice" })),
    remaining: state.remaining.slice(state.batchSize),
    mastered,
    batch: state.batch + 1,
  };
}
