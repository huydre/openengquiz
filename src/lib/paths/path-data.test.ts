import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generatedCardSchema } from "../ai/generated-card-data";
import { pathCards } from "./path-cards";
import { parsePathCatalog } from "./path-catalog";
import { recommendPaths, summarizeProgress } from "./path-data";

const yaml = readFileSync(new URL("../../../content/paths.yaml", import.meta.url), "utf8");

describe("learning paths", () => {
  it("loads the catalog and ranks the B1 IELTS path before other levels and goals", () => {
    const catalog = parsePathCatalog(yaml);
    const ielts = catalog.find((path) => path.slug === "ielts-vocabulary");
    expect(ielts?.sets).toHaveLength(20);
    for (const [slug, first, second] of [["everyday-a1-a2", "A1", "A2"], ["everyday-b1-b2", "B1", "B2"], ["everyday-c1-c2", "C1", "C2"]]) {
      const path = catalog.find((path) => path.slug === slug);
      expect(path?.sets.map(({ level }) => level)).toEqual([...Array(10).fill(first), ...Array(10).fill(second)]);
    }
    const recommendations = recommendPaths(catalog.map((path) => ({ ...path, id: path.slug })), "ielts", "B1");
    expect(recommendations.slice(0, 2).map(({ id }) => id)).toEqual(["ielts-vocabulary", "ielts-linking-words"]);
    expect(() => parsePathCatalog(yaml + "\n" + yaml)).toThrow("Duplicate path slug");
  });

  it("skips empty and completed sets and weights progress by card count", () => {
    expect(summarizeProgress([
      { set_id: "empty", total: 0, mastered: 0 }, { set_id: "done", total: 2, mastered: 2 },
      { set_id: "next", total: 6, mastered: 1 },
    ])).toEqual({ total: 8, mastered: 3, percent: 38, next: "next" });
    expect(summarizeProgress([])).toEqual({ total: 0, mastered: 0, percent: 0, next: undefined });
  });

  it("does not consume incomplete terms and deduplicates normalized terms across sets", () => {
    const card = generatedCardSchema.parse({ term: "Check In", ipa: "/tʃɛk ɪn/", definition_vi: "làm thủ tục", example_en: "Check in here.",
      definition_en: null, part_of_speech: null, example_vi: null, synonyms: [] });
    const seen = new Set<string>();
    expect(pathCards([{ ...card, ipa: null }], seen, 30)).toEqual([]);
    expect(pathCards([card], seen, 30)).toEqual([card]);
    expect(pathCards([{ ...card, term: "ＣＨＥＣＫ  in" }], seen, 30)).toEqual([]);
  });
});
