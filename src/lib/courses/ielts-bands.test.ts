import { describe, expect, it } from "vitest";
import { calibrateBands } from "./ielts-bands";

describe("calibrateBands", () => {
  it("caps short answers and recomputes overall from the criteria", () => {
    expect(calibrateBands({ overall: 9, grammar: 9, vocabulary: 9, coherence: 9 }, "I brush my teeth after breakfast every day."))
      .toEqual({ grammar: 5.5, vocabulary: 5.5, coherence: 5.5, overall: 5.5 });
  });

  it("allows up to 6.5 for medium answers", () => {
    const twenty = Array.from({ length: 20 }, () => "word").join(" ");
    expect(calibrateBands({ overall: 8, grammar: 7, vocabulary: 6, coherence: 8 }, twenty).overall).toBe(6.5);
  });

  it("keeps the model bands for developed answers", () => {
    const long = Array.from({ length: 40 }, () => "word").join(" ");
    expect(calibrateBands({ overall: 9, grammar: 7, vocabulary: 6.5, coherence: 7 }, long))
      .toEqual({ grammar: 7, vocabulary: 6.5, coherence: 7, overall: 7 });
  });
});
