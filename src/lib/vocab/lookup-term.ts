import { z } from "zod";

export const lookupResultSchema = z.object({
  term: z.string().min(1).max(100),
  ipa: z.string().max(100).nullable(),
  part_of_speech: z.string().max(100).nullable(),
  definition_en: z.string().max(1000).nullable(),
  definition_vi: z.string().max(1000).nullable(),
  example_en: z.string().max(1000).nullable(),
  example_vi: z.string().max(1000).nullable(),
  synonyms: z.array(z.string().max(100)).max(12),
  /** Every sense of the word (AI lookups). The flat fields above mirror the first sense. */
  meanings: z.array(z.object({
    part_of_speech: z.string().max(60),
    definition_vi: z.string().max(400),
    definition_en: z.string().max(400).nullable(),
    example_en: z.string().max(400).nullable(),
    example_vi: z.string().max(400).nullable(),
    synonyms: z.array(z.string().max(60)).max(6),
  })).max(6).optional(),
  /** Related words and phrases built on the term. */
  compound_words: z.array(z.string().max(80)).max(8).optional(),
  /** Set when the query looked misspelled and the result is for this spelling instead. */
  corrected_term: z.string().max(100).nullable().optional(),
  /** Language the learner typed: Vietnamese queries return the matching English word. */
  source_lang: z.enum(["en", "vi"]).optional(),
});

export type LookupResult = z.infer<typeof lookupResultSchema>;
export type LookupMeaning = NonNullable<LookupResult["meanings"]>[number];

export function normalizeLookupTerm(value: string): string | null {
  const term = value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  if (!term || term.length > 100 || /[\x00-\x1f\x7f]/.test(term)) return null;
  return term;
}
