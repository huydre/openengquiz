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

  it("accepts every learn recognition and recall form in order", () => {
    for (const recognition of ["multiple_choice", "match"] as const) {
      for (const recall of ["learn_type", "fill", "dictation_term"] as const) {
        const recognitionAnswer = recognition === "match" ? "apple" : "quả táo";
        const result = gradeStudySession("learn", cards, [
          { card_id: "a", question_type: recognition, answer: recognitionAnswer },
          { card_id: "a", question_type: recall, answer: "apple" },
          { card_id: "b", question_type: recognition, answer: recognition === "match" ? "orange" : "quả cam" },
          { card_id: "b", question_type: recall, answer: "orange" },
        ]);
        expect(result.score).toBe(4);
      }
    }
  });

  it("rejects learn attempts outside the learn question forms", () => {
    expect(() => gradeStudySession("learn", cards, [
      { card_id: "a", question_type: "true_false", answer: "true", statement: "quả táo" },
      { card_id: "b", question_type: "multiple_choice", answer: "quả cam" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ])).toThrow();
  });

  it("requires recognition again after a wrong recognition answer", () => {
    expect(() => gradeStudySession("learn", cards, [
      { card_id: "a", question_type: "multiple_choice", answer: "quả táo" },
      { card_id: "a", question_type: "match", answer: "orange" },
      { card_id: "a", question_type: "learn_type", answer: "apple" },
      { card_id: "b", question_type: "multiple_choice", answer: "quả cam" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ])).toThrow("Chưa hoàn thành");
  });

  it("keeps mastery after a correct review and demotes after a wrong one", () => {
    const mastered = [
      { card_id: "a", question_type: "multiple_choice", answer: "quả táo" },
      { card_id: "a", question_type: "learn_type", answer: "apple" },
      { card_id: "b", question_type: "multiple_choice", answer: "quả cam" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ] as const;
    // A correct review (match is a recognition form) changes nothing.
    expect(gradeStudySession("learn", cards, [
      ...mastered,
      { card_id: "a", question_type: "match", answer: "apple" },
    ]).score).toBe(5);
    // A wrong review demotes the card: the session is rejected unless it learns again.
    expect(() => gradeStudySession("learn", cards, [
      ...mastered,
      { card_id: "a", question_type: "match", answer: "orange" },
    ])).toThrow("Chưa hoàn thành");
    // Recognition then recall again restores mastery.
    const result = gradeStudySession("learn", cards, [
      ...mastered,
      { card_id: "a", question_type: "match", answer: "orange" },
      { card_id: "a", question_type: "multiple_choice", answer: "quả táo" },
      { card_id: "a", question_type: "fill", answer: "apple" },
    ]);
    expect(result.score).toBe(6);
  });

  it("does not let a recall answer master a card before recognition", () => {
    expect(() => gradeStudySession("learn", cards, [
      { card_id: "a", question_type: "dictation_term", answer: "apple" },
      { card_id: "a", question_type: "multiple_choice", answer: "quả táo" },
      { card_id: "a", question_type: "learn_type", answer: "apple" },
      { card_id: "b", question_type: "multiple_choice", answer: "quả cam" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ])).not.toThrow();
    // But recall alone, with no later recognition, is not enough.
    expect(() => gradeStudySession("learn", cards, [
      { card_id: "a", question_type: "fill", answer: "apple" },
      { card_id: "b", question_type: "multiple_choice", answer: "quả cam" },
      { card_id: "b", question_type: "learn_type", answer: "orange" },
    ])).toThrow("Chưa hoàn thành");
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
