import "server-only";
import { z } from "zod";
import type { LookupResult } from "./lookup-term";

const dictionaryEntrySchema = z.array(z.object({
  phonetic: z.string().optional(),
  phonetics: z.array(z.object({ text: z.string().optional() }).passthrough()).optional(),
  meanings: z.array(z.object({
    partOfSpeech: z.string().optional(),
    synonyms: z.array(z.string()).optional(),
    definitions: z.array(z.object({
      definition: z.string(),
      example: z.string().optional(),
      synonyms: z.array(z.string()).optional(),
    }).passthrough()),
  }).passthrough()).optional(),
}).passthrough()).min(1);

export class DictionaryNotFoundError extends Error {}

export async function lookupDictionary(term: string): Promise<LookupResult> {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
    { signal: AbortSignal.timeout(8000), cache: "no-store" },
  );
  if (response.status === 404) throw new DictionaryNotFoundError(term);
  if (!response.ok) throw new Error(`Dictionary request failed: ${response.status}`);

  const parsed = dictionaryEntrySchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Dictionary response has an unexpected shape");

  const entries = parsed.data;
  const meanings = entries.flatMap((entry) => entry.meanings ?? []);
  const firstMeaning = meanings.find((meaning) => meaning.definitions.length > 0);
  const firstDefinition = firstMeaning?.definitions[0];
  const synonyms = [...new Set(meanings.flatMap((meaning) => [
    ...(meaning.synonyms ?? []),
    ...meaning.definitions.flatMap((definition) => definition.synonyms ?? []),
  ]))].filter(Boolean).slice(0, 12);

  return {
    term,
    ipa: (entries.find((entry) => entry.phonetic)?.phonetic
      ?? entries.flatMap((entry) => entry.phonetics ?? []).find((item) => item.text)?.text
      ?? null)?.slice(0, 100) ?? null,
    part_of_speech: firstMeaning?.partOfSpeech?.slice(0, 100) ?? null,
    definition_en: firstDefinition?.definition.slice(0, 1000) ?? null,
    definition_vi: null,
    example_en: firstDefinition?.example?.slice(0, 1000) ?? null,
    example_vi: null,
    synonyms: synonyms.map((synonym) => synonym.slice(0, 100)),
  };
}
