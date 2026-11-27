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
});

export type LookupResult = z.infer<typeof lookupResultSchema>;

export function normalizeLookupTerm(value: string): string | null {
  const term = value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  if (!term || term.length > 100 || /[\x00-\x1f\x7f]/.test(term)) return null;
  return term;
}
