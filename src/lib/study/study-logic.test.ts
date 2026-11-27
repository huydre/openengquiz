import { describe, expect, it } from "vitest";
import { matchesAnswer, gradeAttempt } from "./answer-matcher";
import { advanceLearn, createLearnState } from "./learn-algorithm";
import { choiceOptions, falseStatement } from "./question-generator";
import type { StudyCard } from "./study-types";

const cards: StudyCard[] = [
  { id: "a", term: "apple", definition_vi: "quả táo", definition_en: null, example_en: "An apple a day." },
  { id: "b", term: "orange", definition_vi: "quả cam", definition_en: null, example_en: null },
  { id: "c", term: "pear", definition_vi: "quả lê", definition_en: null, example_en: null },
  { id: "d", term: "fruit", definition_vi: "quả táo", definition_en: null, example_en: null },
];

describe("study answers", () => {
  it("ignores case, extra whitespace and terminal punctuation", () => {
    expect(matchesAnswer("  AN   Apple ! ", "an apple")).toBe(true);
    expect(matchesAnswer("quả cam", "quả táo")).toBe(false);
  });

  it("grades a false statement from the canonical card", () => {
    expect(gradeAttempt({ card_id: "a", question_type: "true_false", answer: "false", statement: "quả cam" }, cards[0])).toBe(true);
  });
});

describe("question options", () => {
  it("has unique labels and works with fewer than four cards", () => {
    const options = choiceOptions(cards[0], cards);
    expect(new Set(options.map((option) => option.label)).size).toBe(options.length);
    expect(options.filter((option) => option.label === "quả táo")).toHaveLength(1);
    expect(choiceOptions(cards[0], cards.slice(0, 2))).toHaveLength(2);
    expect(choiceOptions(cards[0], cards.slice(0, 1))).toHaveLength(1);
    expect(falseStatement(cards[0], cards.slice(0, 1))).toBeNull();
  });
});

describe("Learn queue", () => {
  it("repeats wrong cards and finishes after typed recall", () => {
    let state = createLearnState(["a"], 5);
    state = advanceLearn(state, false);
    expect(state.queue[0]).toEqual({ cardId: "a", stage: "choice" });
    state = advanceLearn(state, true);
    expect(state.queue[0]).toEqual({ cardId: "a", stage: "type" });
    state = advanceLearn(state, false);
    expect(state.queue[0]).toEqual({ cardId: "a", stage: "type" });
    state = advanceLearn(state, true);
    expect(state.queue).toHaveLength(0);
    expect(state.mastered).toEqual(["a"]);
  });

  it("moves to the next batch only after current batch is mastered", () => {
    let state = createLearnState(["a", "b"], 1);
    state = advanceLearn(state, true);
    state = advanceLearn(state, true);
    expect(state.batch).toBe(2);
    expect(state.queue[0].cardId).toBe("b");
  });
});
