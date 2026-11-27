import { describe, expect, it } from "vitest";
import { gradeStudySession } from "./grade-session";
import type { StudyCard } from "./study-types";

const cards: StudyCard[] = [
  { id: "a", term: "apple", definition_vi: "quả táo", definition_en: null, example_en: "An apple a day." },
  { id: "b", term: "orange", definition_vi: "quả cam", definition_en: null, example_en: null },
];

describe("server session grading", () => {
  it("computes correctness and score without a client correct flag", () => {
    const result = gradeStudySession("quiz", cards, [
      { card_id: "a", question_type: "multiple_choice", answer: "quả táo" },
      { card_id: "b", question_type: "fill", answer: "apple" },
    ]);
    expect(result.score).toBe(1);
    expect(result.attempts.map((item) => item.correct)).toEqual([true, false]);
  });

  it("rejects cards outside the set and mode", () => {
    expect(() => gradeStudySession("quiz", cards, [
      { card_id: "other", question_type: "fill", answer: "apple" },
    ])).toThrow();
    expect(() => gradeStudySession("writing", cards, [
      { card_id: "a", question_type: "game", answer: "quả táo" },
    ])).toThrow();
  });

  it("requires Learn choice before typed recall for every card", () => {
    expect(() => gradeStudySession("learn", cards, [
      { card_id: "a", question_type: "learn_type", answer: "apple" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ])).toThrow("Chưa hoàn thành");
    const result = gradeStudySession("learn", cards, [
      { card_id: "a", question_type: "multiple_choice", answer: "quả táo" },
      { card_id: "a", question_type: "learn_type", answer: "apple" },
      { card_id: "b", question_type: "multiple_choice", answer: "quả cam" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ]);
    expect(result.score).toBe(4);
  });

  it("calculates combo game points on the server", () => {
    const result = gradeStudySession("game", cards, [
      { card_id: "a", question_type: "game", answer: "quả táo" },
      { card_id: "b", question_type: "game", answer: "quả cam" },
    ]);
    expect(result.score).toBe(220);
    expect(result.total).toBe(400);
  });
});
