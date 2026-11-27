import { expect, it } from "vitest";
import { highlightPhrases, splitQuestion } from "./course-question";

it("keeps punctuation and whitespace while making contractions and compounds clickable", () => {
  const question = "What’s your go-to? (At 7:30.)";
  const tokens = splitQuestion(question);
  expect(tokens.map(({ value }) => value).join("")).toBe(question);
  expect(tokens.flatMap(({ term }) => term ?? [])).toEqual(["What's", "your", "go-to", "At"]);
});

it("prefers whole phrases and does not highlight a substring inside another word", () => {
  const text = "I wake up, drink water, then head upstairs.";
  const parts = highlightPhrases(text, ["wake up", "up", "WATER"]);
  expect(parts.filter(({ highlighted }) => highlighted).map(({ text }) => text)).toEqual(["wake up", "water"]);
  expect(parts.map(({ text }) => text).join("")).toBe(text);
});
