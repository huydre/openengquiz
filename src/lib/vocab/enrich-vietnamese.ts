import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getModel, isAiConfigured } from "@/lib/ai/client";
import type { LookupResult } from "./lookup-term";

const vietnameseSchema = z.object({
  definition_vi: z.string().min(1).max(300),
  example_vi: z.string().max(500).nullable(),
});

/** Adds a Vietnamese meaning (and a translated example) to a dictionary result using the LLM. */
export async function enrichVietnamese(result: LookupResult): Promise<LookupResult> {
  if (!isAiConfigured()) return result;

  const { output } = await generateText({
    model: getModel(),
    output: Output.object({ schema: vietnameseSchema }),
    system:
      "You are a concise English-Vietnamese dictionary for Vietnamese learners. " +
      "Give the most common Vietnamese meaning matching the part of speech, in a few words. " +
      "Translate the example sentence naturally if one is given, otherwise return null.",
    prompt: JSON.stringify({
      term: result.term,
      part_of_speech: result.part_of_speech,
      definition_en: result.definition_en,
      example_en: result.example_en,
    }),
  });

  return {
    ...result,
    definition_vi: output.definition_vi.slice(0, 1000),
    example_vi: result.example_en ? (output.example_vi?.slice(0, 1000) ?? null) : null,
  };
}
