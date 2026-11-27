import { NoObjectGeneratedError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { mergeWordCards, readCachedCards, uniqueCards, wordsToGenerate, type GeneratedCard } from "./generated-card-data";
import { generateCards } from "./generate-cards";

const { getModel, assertQuota, recordUsage } = vi.hoisted(() => ({
  getModel: vi.fn<() => MockLanguageModelV4>(),
  assertQuota: vi.fn(),
  recordUsage: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ getModel, isAiConfigured: () => true }));
vi.mock("./quota", () => ({ assertQuota, recordUsage }));

const apple: GeneratedCard = {
  term: "apple",
  definition_vi: "quả táo",
  definition_en: null,
  part_of_speech: "noun",
  ipa: "/ˈæp.əl/",
  example_en: null,
  example_vi: null,
  synonyms: [],
};

describe("AI card generation data", () => {
  it("normalizes and deduplicates input before applying the word limit", () => {
    const words = Array.from({ length: 55 }, (_, index) => `word${index}`);
    expect(wordsToGenerate([...Array<string>(51).fill(" ＡppLE "), "ice cream", "\0", ...words], [" ICE   CREAM "]))
      .toEqual(["apple", ...words.slice(0, 49)]);
  });

  it("filters normalized destination and generated duplicates before capping output", () => {
    const extra = Array.from({ length: 55 }, (_, index) => ({ term: `word${index}` }));
    expect(uniqueCards([{ term: "Ice cream" }, apple, { term: " ＡPPLE " }, ...extra], [" ICE  CREAM "]))
      .toEqual([apple, ...extra.slice(0, 49)]);
  });

  it("keeps valid cache entries and merges only requested terms in input order", () => {
    const words = ["banana", "apple", "pear", "lime"];
    const cached = readCachedCards(words, [
      { term: "apple", data: apple },
      { term: "banana", data: { ...apple, term: "banana", definition_vi: null, ipa: "/bəˈnɑː.nə/" } },
      { term: "pear", data: { term: "pear" } },
    ]);
    const banana = { ...apple, term: "Banana", definition_vi: "quả chuối" };
    expect(cached.missing).toEqual(["banana", "pear", "lime"]);
    expect(mergeWordCards(words, cached, [
      { ...apple, term: "orange" },
      { ...apple, definition_vi: "must not overwrite cache" },
      banana,
      { ...banana, term: "BANANA" },
    ])).toEqual([{ ...banana, ipa: "/bəˈnɑː.nə/" }, apple]);
  });
});

describe("AI card structured output", () => {
  const options = {
    source: { type: "topic", topic: "fruit", level: "B1" } as const,
    existingTerms: [],
    userId: "learner",
    supabase: {} as SupabaseClient,
  };

  it("does not start generation when quota is exhausted", async () => {
    const quotaError = new Error("Quota exhausted");
    getModel.mockClear();
    assertQuota.mockRejectedValueOnce(quotaError);
    await expect(generateCards(options)).rejects.toBe(quotaError);
    expect(getModel).not.toHaveBeenCalled();
  });

  it.each([true, false])("retries invalid output once (valid second response: %s)", async (validSecondResponse) => {
    recordUsage.mockClear();
    const model = new MockLanguageModelV4({
      doGenerate: ["{\"cards\":[{}]}", validSecondResponse ? JSON.stringify({ cards: [apple] }) : "not JSON"].map((text) => ({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      })),
    });
    getModel.mockReturnValue(model);

    if (validSecondResponse) {
      await expect(generateCards(options)).resolves.toEqual([apple]);
      expect(recordUsage).toHaveBeenCalledTimes(1);
    } else {
      await expect(generateCards(options)).rejects.toBeInstanceOf(NoObjectGeneratedError);
      expect(recordUsage).not.toHaveBeenCalled();
    }
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});