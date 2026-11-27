import { parseArgs } from "node:util";
import { createAdminClient } from "../src/lib/supabase/admin";
import { GiphyRateLimitError, searchGiphy } from "../src/lib/media/giphy";

/**
 * Gives course vocabulary cards a GIF, like OpenQuiz shows an illustration with every lesson word.
 * Only cards without an image are touched, so it is safe to rerun and never overwrites a
 * learner's or editor's choice. Nouns get a Giphy sticker (a literal drawing of the thing; a noun
 * GIF often hits a film meme, "notebook" returns The Notebook), phrases and verbs get a reaction
 * GIF with a sticker as fallback. Cards sharing a term reuse one search. Requests are paced for
 * Giphy's beta key (about 100 per hour); on a rate-limit reply it stops and reports what is left.
 *
 *   bun scripts/seed-card-gifs.ts --dry-run            count what would be searched
 *   bun scripts/seed-card-gifs.ts --limit 90 --delay 37000
 */
async function main() {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean" }, limit: { type: "string", default: "90" }, delay: { type: "string", default: "37000" } },
  });
  const limit = Number(values.limit);
  const delayMs = Number(values.delay);
  const apiKey = process.env.GIPHY_API_KEY;
  const supabase = createAdminClient();
  if (!supabase || !apiKey) throw new Error("Configure Supabase and GIPHY_API_KEY.");

  const lessons = await supabase.from("course_lessons").select("set_id");
  if (lessons.error) throw new Error(lessons.error.message);
  const setIds = lessons.data.map((lesson) => lesson.set_id);

  const cards: { id: string; term: string; part_of_speech: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await supabase.from("cards").select("id, term, part_of_speech").in("set_id", setIds).is("image_url", null).order("id").range(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    cards.push(...page.data);
    if (page.data.length < 1000) break;
  }

  // One search per distinct term; punctuation does not help the search.
  const byQuery = new Map<string, { noun: boolean; ids: string[] }>();
  for (const card of cards) {
    const query = card.term.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
    if (!query) continue;
    const entry = byQuery.get(query) ?? { noun: /noun|danh từ/i.test(card.part_of_speech ?? ""), ids: [] };
    entry.ids.push(card.id);
    byQuery.set(query, entry);
  }
  console.log(`${setIds.length} course sets, ${cards.length} cards without an image, ${byQuery.size} distinct terms.`);
  if (values["dry-run"]) return;

  let searched = 0;
  let updated = 0;
  let missing = 0;
  const search = async (query: string, kind: "gifs" | "stickers") => {
    if (searched >= limit) return undefined;
    if (searched > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    searched += 1;
    const rating = kind === "stickers" ? "g" : "pg";
    return (await searchGiphy(query, apiKey, { kind, rating, limit: 1, init: { signal: AbortSignal.timeout(15_000) } }))[0]?.url;
  };
  for (const [query, { noun, ids }] of byQuery) {
    if (searched >= limit) break;
    let url: string | undefined;
    try {
      url = noun ? await search(query, "stickers") : (await search(query, "gifs")) ?? (await search(query, "stickers"));
    } catch (error) {
      if (error instanceof GiphyRateLimitError) {
        console.log("Giphy rate limit reached; rerun later to continue.");
        break;
      }
      console.error(`Search failed for "${query}":`, error instanceof Error ? error.message : error);
      continue;
    }
    if (!url) { missing += 1; console.log(`[${searched}] ${query} -> no GIF`); continue; }
    const { error } = await supabase.from("cards").update({ image_url: url }).in("id", ids).is("image_url", null);
    if (error) console.error(`Update failed for "${query}":`, error.message);
    else updated += ids.length;
    console.log(`[${searched}] ${query} -> ${ids.length} card(s)`);
  }
  console.log(`Done: ${searched} searches, ${updated} cards updated, ${missing} terms without a GIF, rerun to continue with the terms left.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
