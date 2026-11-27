import { describe, expect, it } from "vitest";
import type { PronunciationResult } from "./client";
import { pronunciationHint } from "./pronunciation-hints";

const issue: PronunciationResult["issues"][number] = {
  kind: "substitution", word: "think", word_index: 0, expected: null, heard: null, error_prob: null, features: [],
};

describe("Vietnamese pronunciation guidance", () => {
  it.each([
    ["/θ/", "t", "không rung"],
    ["ð", "d", "rung cổ họng"],
    ["ʃ", "s", "tròn môi"],
    ["iː", "ɪ", "lâu hơn"],
    ["ɪ", "iː", "Rút ngắn"],
  ])("gives a specific hint for %s heard as %s", (expected, heard, hint) => {
    expect(pronunciationHint({ ...issue, expected, heard })).toContain(hint);
  });

  it("names the word when reminding a learner to finish it", () => {
    expect(pronunciationHint({ ...issue, kind: "deletion", word: "desk", expected: "k" })).toContain("âm cuối của từ desk");
  });

  it("uses feature direction without guessing an unknown issue", () => {
    expect(pronunciationHint({ ...issue, features: [{ feature: "backness", expected: "front", heard: "back" }] })).toContain("phía trước");
    expect(pronunciationHint(issue)).toBeNull();
  });
});
