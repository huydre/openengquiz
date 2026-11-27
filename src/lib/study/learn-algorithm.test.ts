import { describe, expect, it } from "vitest";
import { advanceLearn, createLearnState, pickLearnType, type LearnState } from "./learn-algorithm";
import type { StudyCard } from "./study-types";

const cards: StudyCard[] = [
  { id: "a", term: "apple", definition_vi: "quả táo", definition_en: null, example_en: "An apple a day." },
  { id: "b", term: "orange", definition_vi: "quả cam", definition_en: null, example_en: null },
  { id: "c", term: "game!", definition_vi: "trò chơi", definition_en: null, example_en: "Let's play a game." },
  { id: "d", term: "zebra", definition_vi: "ngựa vằn", definition_en: null, example_en: "A horse runs fast." },
];

const manyCards: StudyCard[] = Array.from({ length: 10 }, (_, index) => ({
  id: `c${index}`,
  term: `word${index}`,
  definition_vi: `nghia ${index}`,
  definition_en: null,
  example_en: null,
}));

const mid = () => 0.5;
function runUntilReview(state: LearnState): { state: LearnState; reviewCardId: string } {
  let current = state;
  for (let guard = 0; guard < 1000; guard++) {
    const head = current.queue[0];
    if (!head) throw new Error("queue drained before a review step appeared");
    if (head.stage === "review") return { state: current, reviewCardId: head.cardId };
    current = advanceLearn(current, true, mid);
  }
  throw new Error("no review step appeared");
}

describe("pickLearnType", () => {
  it("only picks recognition forms for the recognition stage", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      seen.add(pickLearnType("recognition", cards[0], () => seed / 20));
    }
    expect([...seen].every((type) => ["multiple_choice", "match"].includes(type))).toBe(true);
    expect(seen.size).toBe(2);
  });

  it("only offers fill when the example contains the term", () => {
    // No example at all: fill is never eligible.
    for (let seed = 0; seed < 30; seed++) {
      expect(pickLearnType("recall", cards[1], () => seed / 30)).not.toBe("fill");
    }
    // Example without the term: fill is never eligible.
    for (let seed = 0; seed < 30; seed++) {
      expect(pickLearnType("recall", cards[3], () => seed / 30)).not.toBe("fill");
    }
    // Example containing the term: fill shows up.
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      seen.add(pickLearnType("recall", cards[0], () => seed / 60));
    }
    expect(seen.has("fill")).toBe(true);
    expect([...seen].every((type) => ["learn_type", "fill", "dictation_term"].includes(type))).toBe(true);
  });

  it("matches the term inside the example ignoring trailing punctuation", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      seen.add(pickLearnType("recall", cards[2], () => seed / 60));
    }
    expect(seen.has("fill")).toBe(true);
  });
});

describe("Learn queue", () => {
  it("stores a concrete question type on every step", () => {
    const state = createLearnState(cards, 6, mid);
    expect(state.queue).toHaveLength(4);
    for (const step of state.queue) {
      expect(step.stage).toBe("recognition");
      expect(["multiple_choice", "match"]).toContain(step.type);
    }
    expect(state.remaining).toHaveLength(0);
    expect(state.mastered).toEqual([]);
  });

  it("walks recognition then recall and masters the card", () => {
    let state = createLearnState([cards[0]], 5, mid);
    state = advanceLearn(state, false, mid);
    expect(state.queue[0].stage).toBe("recognition");
    state = advanceLearn(state, true, mid);
    expect(state.queue[0].stage).toBe("recall");
    state = advanceLearn(state, false, mid);
    expect(state.queue[0].stage).toBe("recall");
    state = advanceLearn(state, true, mid);
    expect(state.queue).toHaveLength(0);
    expect(state.mastered).toEqual(["a"]);
  });

  it("moves to the next batch only after the current batch is mastered", () => {
    let state = createLearnState(cards.slice(0, 2), 1, mid);
    state = advanceLearn(state, true, mid);
    state = advanceLearn(state, true, mid);
    expect(state.batch).toBe(2);
    expect(state.queue[0].cardId).toBe("b");
  });

  it("interleaves mastered cards as review steps in later batches", () => {
    let state = createLearnState(manyCards, 3, mid);
    const reviews: string[] = [];
    for (let guard = 0; guard < 500 && state.queue.length; guard++) {
      const head = state.queue[0];
      if (head.stage === "review") {
        reviews.push(head.cardId);
        expect(["multiple_choice", "match"]).toContain(head.type);
        expect(state.mastered).toContain(head.cardId);
      }
      state = advanceLearn(state, true, mid);
    }
    expect(reviews.length).toBeGreaterThan(0);
    expect(state.mastered).toHaveLength(manyCards.length);
    expect(state.queue).toHaveLength(0);
  });

  it("keeps a card mastered after a correct review", () => {
    const { state, reviewCardId } = runUntilReview(createLearnState(manyCards, 3, mid));
    const masteredBefore = state.mastered.length;
    const next = advanceLearn(state, true, mid);
    expect(next.mastered).toContain(reviewCardId);
    expect(next.mastered).toHaveLength(masteredBefore);
    expect(next.queue.some((step) => step.cardId === reviewCardId)).toBe(false);
  });

  it("demotes a card after a wrong review and makes it learn again", () => {
    const { state, reviewCardId } = runUntilReview(createLearnState(manyCards, 3, mid));
    let current = advanceLearn(state, false, mid);
    expect(current.mastered).not.toContain(reviewCardId);
    // The relearn recognition step is queued behind the remaining batch steps.
    expect(current.queue.some((step) => step.cardId === reviewCardId && step.stage === "recognition")).toBe(true);
    for (let guard = 0; guard < 500; guard++) {
      const head = current.queue[0];
      if (!head) throw new Error("queue drained before relearn finished");
      if (head.cardId === reviewCardId && head.stage === "recognition") break;
      current = advanceLearn(current, true, mid);
    }
    current = advanceLearn(current, true, mid);
    // The recall step lands at the end of the queue; answer everything correctly
    // until it reaches the head.
    for (let guard = 0; guard < 500; guard++) {
      const head = current.queue[0];
      if (!head) throw new Error("queue drained before relearn finished");
      if (head.cardId === reviewCardId && head.stage === "recall") break;
      current = advanceLearn(current, true, mid);
    }
    current = advanceLearn(current, true, mid);
    expect(current.mastered).toContain(reviewCardId);
  });
});
