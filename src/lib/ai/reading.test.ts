import { describe, expect, it } from "vitest";
import { checkTargetTerms, hasEnoughTargetTerms, shuffleQuestionOptions, splitHighlightedContent, type ReadingTerm } from "./reading";

const terms: ReadingTerm[] = [
  { term: "apple", definition_vi: "quả táo" },
  { term: "run quickly", definition_vi: "chạy nhanh" },
  { term: "decision", definition_vi: "quyết định" },
  { term: "environment", definition_vi: "môi trường" },
  { term: "achievement", definition_vi: "thành tựu" },
  { term: "beautiful", definition_vi: "đẹp" },
];

describe("checkTargetTerms", () => {
  it("matches whole words case-insensitively and allows simple inflections", () => {
    const content = "She made a DECISION to run quickly. The apples were beautiful.";
    const { matched, missing } = checkTargetTerms(content, terms);
    expect(matched.map((t) => t.term)).toEqual(["apple", "run quickly", "decision", "beautiful"]);
    expect(missing.map((t) => t.term)).toEqual(["environment", "achievement"]);
  });

  it("does not match substrings inside other words", () => {
    const { matched, missing } = checkTargetTerms(
      "The pineapple ran quickly but the runner was environmental.",
      [{ term: "apple", definition_vi: null }, { term: "run", definition_vi: null }, { term: "environment", definition_vi: null }],
    );
    // "environmental" is not "environment"; "ran"/"runner" are not "run".
    expect(matched).toEqual([]);
    expect(missing).toHaveLength(3);
  });

  it("matches phrases across whitespace and plural forms", () => {
    const { matched } = checkTargetTerms(
      "They run\n  quickly every morning.",
      [{ term: "run quickly", definition_vi: null }],
    );
    expect(matched).toHaveLength(1);
  });

  it("deduplicates repeated target terms", () => {
    const dupes = [
      { term: "apple", definition_vi: "a" },
      { term: " APPLE ", definition_vi: "b" },
    ];
    const { matched, missing } = checkTargetTerms("an apple", dupes);
    expect(matched).toHaveLength(1);
    expect(missing).toHaveLength(0);
  });

  it("matches phrase terms that end in punctuation the passage may not repeat", () => {
    const content = "Mia smiled. Do you want to play? Then she said, let's play a game while we wait.";
    const { matched, missing } = checkTargetTerms(content, [
      { term: "do you want to play?", definition_vi: "bạn có muốn chơi không?" },
      { term: "let's play a game!", definition_vi: "cùng chơi một trò nhé!" },
    ]);
    expect(matched.map((term) => term.term)).toEqual(["do you want to play?", "let's play a game!"]);
    expect(missing).toEqual([]);
  });

  it("skips empty terms", () => {
    const { matched, missing } = checkTargetTerms("hello", [{ term: "  ", definition_vi: null }]);
    expect(matched).toEqual([]);
    expect(missing).toEqual([]);
  });
});

describe("hasEnoughTargetTerms", () => {
  it("requires between 5 and 10 matched terms", () => {
    expect(hasEnoughTargetTerms(4)).toBe(false);
    expect(hasEnoughTargetTerms(5)).toBe(true);
    expect(hasEnoughTargetTerms(10)).toBe(true);
    expect(hasEnoughTargetTerms(11)).toBe(false);
  });
});

describe("splitHighlightedContent", () => {
  it("marks every occurrence of target terms and keeps plain text around them", () => {
    const segments = splitHighlightedContent("An apple a day. Apples are nice.", [
      { term: "apple", definition_vi: "quả táo" },
    ]);
    expect(segments).toEqual([
      { text: "An ", term: null },
      { text: "apple", term: terms[0] },
      { text: " a day. ", term: null },
      { text: "Apples", term: terms[0] },
      { text: " are nice.", term: null },
    ]);
  });

  it("prefers the longest match on overlaps and skips duplicate terms", () => {
    const segments = splitHighlightedContent("run quickly now", [
      { term: "run", definition_vi: null },
      { term: "run quickly", definition_vi: null },
      { term: "RUN QUICKLY", definition_vi: null },
    ]);
    expect(segments).toEqual([
      { text: "", term: null },
    ].slice(1).concat([{ text: "run quickly", term: expect.objectContaining({ term: "run quickly" }) }, { text: " now", term: null }]));
  });

  it("returns a single plain segment when nothing matches", () => {
    expect(splitHighlightedContent("hello world", [{ term: "absent", definition_vi: null }]))
      .toEqual([{ text: "hello world", term: null }]);
  });
});

describe("shuffleQuestionOptions", () => {
  const question = { question: "Where?", options: ["At home", "At school", "At work", "At the park"], answer_index: 0, explanation: "Ở nhà." };

  it("keeps answer_index pointing at the same option after shuffling", () => {
    const shuffled = shuffleQuestionOptions(question, () => 0);
    expect(shuffled.options).toHaveLength(4);
    expect([...shuffled.options].sort()).toEqual([...question.options].sort());
    expect(shuffled.options[shuffled.answer_index]).toBe("At home");
  });

  it("moves a first-position answer elsewhere for some random sequences", () => {
    const positions = new Set([0, 0.3, 0.6, 0.99].map((value) => shuffleQuestionOptions(question, () => value).answer_index));
    expect(positions.size).toBeGreaterThan(1);
  });
});
