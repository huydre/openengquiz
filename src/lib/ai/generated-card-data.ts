import type { SupabaseClient } from "@supabase/supabase-js";
import type { infer as Infer } from "zod";
import { cardSchema } from "../vocab/card-schema";
import { lookupResultSchema, normalizeLookupTerm } from "../vocab/lookup-term";

export const MAX_GENERATED_CARDS = 50;
export const generatedCardSchema = cardSchema.extend({
  definition_vi: cardSchema.shape.definition_vi.unwrap().unwrap().min(1),
  definition_en: cardSchema.shape.definition_en.unwrap(),
  part_of_speech: cardSchema.shape.part_of_speech.unwrap(),
  ipa: cardSchema.shape.ipa.unwrap(),
  example_en: cardSchema.shape.example_en.unwrap(),
  example_vi: cardSchema.shape.example_vi.unwrap(),
  synonyms: cardSchema.shape.synonyms.removeDefault(),
});
export type GeneratedCard = Infer<typeof generatedCardSchema>;

export function cardTermKey(term: string) {
  return term.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function uniqueCards<T extends { term: string }>(cards: T[], existingTerms: string[]): T[] {
  const seen = new Set(existingTerms.map(cardTermKey));
  const result: T[] = [];
  for (const card of cards) {
    const key = cardTermKey(card.term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(card);
    if (result.length === MAX_GENERATED_CARDS) break;
  }
  return result;
}

export function wordsToGenerate(words: string[], existingTerms: string[]) {
  const existing = new Set(existingTerms.map(cardTermKey));
  const unique = new Set<string>();
  for (const word of words) {
    const term = normalizeLookupTerm(word);
    if (!term || existing.has(term)) continue;
    unique.add(term);
    if (unique.size === MAX_GENERATED_CARDS) break;
  }
  return [...unique];
}

interface CachedCards {
  cache: Map<string, GeneratedCard>;
  ipaByTerm: Map<string, string>;
  missing: string[];
}

export function readCachedCards(words: string[], rows: { term: string; data: unknown }[]): CachedCards {
  const ipaByTerm = new Map<string, string>();
  const cache = new Map<string, GeneratedCard>();
  for (const row of rows) {
    const lookup = lookupResultSchema.safeParse(row.data);
    if (!lookup.success || lookup.data.term !== row.term) continue;
    if (lookup.data.ipa) ipaByTerm.set(row.term, lookup.data.ipa);
    const card = generatedCardSchema.safeParse(lookup.data);
    if (card.success) cache.set(row.term, card.data);
  }
  return { cache, ipaByTerm, missing: words.filter((word) => !cache.has(word)) };
}

export function mergeWordCards(
  words: string[],
  cached: CachedCards,
  generated: GeneratedCard[],
) {
  const byTerm = new Map(uniqueCards(generated, []).map((card) => [cardTermKey(card.term), card]));
  return words.flatMap((word) => {
    const fromCache = cached.cache.get(word);
    if (fromCache) return [fromCache];
    const card = byTerm.get(word);
    if (!card) return [];
    const ipa = cached.ipaByTerm.get(word);
    return [ipa ? { ...card, ipa } : card];
  });
}

export async function readSetTerms(supabase: SupabaseClient, setId: string): Promise<string[]> {
  const terms: string[] = [];
  let cursor: string | undefined;
  const pageSize = 500;
  do {
    let query = supabase.from("cards").select("id, term").eq("set_id", setId).order("id").limit(pageSize);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data) terms.push(row.term);
    cursor = data.length === pageSize ? data.at(-1)?.id : undefined;
  } while (cursor);
  return terms;
}
