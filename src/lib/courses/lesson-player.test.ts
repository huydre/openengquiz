import { describe, expect, it } from "vitest";
import { buildLessonComparison, canActOnLesson } from "./course-progress";
import { cefrForScore, feedbackCefrs, type LessonAttempt } from "./lesson-player-types";

const attempt = (phase: "first" | "second", transcript: string, score?: number, used: string[] = []): LessonAttempt => ({
  id: `${phase}-${transcript}`,
  phase,
  transcript,
  pron: null,
  feedback: score == null ? null : {
    score, grammar: score, vocabulary: score, coherence: score,
    cefr: "B1", grammarCefr: "B1", vocabularyCefr: "B1", coherenceCefr: "B1", exampleCefr: "B2",
    comment_vi: "", example: "", example_vi: "", highlights: [], corrections: [],
    used, newTerms: [], delta: null,
  },
  createdAt: "2026-11-27T00:00:00Z",
});

describe("cefrForScore", () => {
  it("maps score bands to CEFR labels including C2", () => {
    expect(cefrForScore(0.95)).toBe("C2");
    expect(cefrForScore(0.85)).toBe("C1");
    expect(cefrForScore(0.7)).toBe("B2");
    expect(cefrForScore(0.55)).toBe("B1");
    expect(cefrForScore(0.4)).toBe("A2");
    expect(cefrForScore(0.1)).toBe("A1");
  });

  it("fills all five cefr fields via feedbackCefrs", () => {
    const cefrs = feedbackCefrs({ score: 0.9, grammar: 0.6, vocabulary: 0.75, coherence: 0.5, example: 0.95 });
    expect(cefrs).toEqual({ cefr: "C2", grammarCefr: "B1", vocabularyCefr: "B2", coherenceCefr: "B1", exampleCefr: "C2" });
  });
});

describe("buildLessonComparison", () => {
  const terms = ["check in", "take a break", "neighbor"];

  it("returns null until both attempts exist", () => {
    expect(buildLessonComparison(null, attempt("second", "I check in."), terms)).toBeNull();
    expect(buildLessonComparison(attempt("first", "I check in."), null, terms)).toBeNull();
  });

  it("computes delta and new terms from transcripts", () => {
    const first = attempt("first", "I check in early.", 0.5);
    const second = attempt("second", "I check in early and take a break with my neighbor.", 0.7);
    const result = buildLessonComparison(first, second, terms);
    expect(result?.delta).toBeCloseTo(0.2);
    expect(result?.usedFirst).toEqual(["check in"]);
    expect(result?.usedSecond).toEqual(["check in", "take a break", "neighbor"]);
    expect(result?.newTerms).toEqual(["take a break", "neighbor"]);
  });

  it("prefers stored feedback.used over transcript matching", () => {
    const first = attempt("first", "nothing relevant", 0.5, ["check in"]);
    const second = attempt("second", "also nothing", 0.6, ["check in", "neighbor"]);
    const result = buildLessonComparison(first, second, terms);
    expect(result?.newTerms).toEqual(["neighbor"]);
  });

  it("handles missing feedback scores", () => {
    const first = attempt("first", "I check in.");
    const second = attempt("second", "I check in and take a break.", 0.6);
    const result = buildLessonComparison(first, second, terms);
    expect(result?.delta).toBeNull();
    expect(result?.newTerms).toEqual(["take a break"]);
  });
});

describe("lesson step navigation", () => {
  it("requires an answer instead of skipping warmup", () => {
    expect(canActOnLesson(2, "advance", false, false)).toBe(false);
    expect(canActOnLesson(2, "answer", false, false)).toBe(true);
    expect(canActOnLesson(3, "retry", false, false)).toBe(true);
    expect(canActOnLesson(4, "answer", false, false)).toBe(false);
  });

  it("requires the second answer before starting the call and disallows edits during it", () => {
    expect(canActOnLesson(7, "advance", false, false)).toBe(false);
    expect(canActOnLesson(7, "answer", false, false)).toBe(true);
    expect(canActOnLesson(7, "answer", false, true)).toBe(false);
    expect(canActOnLesson(7, "advance", false, true)).toBe(true);
    expect(canActOnLesson(7, "retry", true, true)).toBe(false);
    expect(canActOnLesson(7, "advance", true, true)).toBe(true);
  });
});
