import { readFileSync } from "node:fs";
import { stringify } from "yaml";
import { expect, it } from "vitest";
import { parseCourseCatalog } from "./course-catalog";
import { courseCards, levelProgress, usedCourseTerms } from "./course-progress";

const source = readFileSync(new URL("../../../content/courses/ielts.yaml", import.meta.url), "utf8");

it("rejects shortened levels and repeated prompts across levels", () => {
  const catalog = parseCourseCatalog(source);
  expect(catalog.levels.map(({ parts }) => parts.map(({ lessons }) => lessons.length))).toEqual(Array.from({ length: 7 }, () => Array(6).fill(5)));
  catalog.levels[1].parts[0].lessons[0].question = catalog.levels[0].parts[0].lessons[0].question;
  expect(() => parseCourseCatalog(stringify(catalog))).toThrow(/Duplicate question/);
  catalog.levels.pop();
  expect(() => parseCourseCatalog(stringify(catalog))).toThrow(/seven levels/);
});

it("unlocks the first unfinished lesson and ignores completion in other levels", () => {
  expect(levelProgress(["first", "second", "third"], new Set(["other", "first"]))).toEqual({ next: "second", done: 1, total: 3 });
  expect(levelProgress(["first"], new Set(["first"]))).toEqual({ next: undefined, done: 1, total: 1 });
});

it("only consumes complete terms and rejects normalized duplicates across lessons", () => {
  const seen = new Set<string>();
  const card = { term: "Check in", ipa: "/tʃɛk ɪn/", definition_vi: "làm thủ tục", definition_en: null,
    example_en: "Check in here.", example_vi: null, part_of_speech: null, synonyms: [] };
  expect(courseCards([{ ...card, example_en: null }, card], seen, 1)).toEqual([card]);
  expect(courseCards([{ ...card, term: "ＣＨＥＣＫ   IN" }], seen, 1)).toEqual([]);
});

it("counts complete lesson phrases without matching substrings or repetitions", () => {
  expect(usedCourseTerms("Check-in? I check in. I took part in a workshop.", ["check in", "art", "took part"])).toEqual(["check in", "took part"]);
});
