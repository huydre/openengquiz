import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createAdminClient } from "../src/lib/supabase/admin";
import { GiphyRateLimitError, searchGiphy } from "../src/lib/media/giphy";

/**
 * Adds GIFs to course and curated path vocabulary. Existing images stay untouched, including
 * learner and editor choices. Searches share a query for duplicate terms. Terms Giphy has no GIF
 * for are listed in --skip-file so later runs spend their hourly quota on new terms.
 *
 *   bun scripts/seed-card-gifs.ts --dry-run
 *   bun scripts/seed-card-gifs.ts --limit 90 --delay 37000
 */
async function main() {
  const { values } = parseArgs({
    options: { "dry-run": { type: "boolean" }, limit: { type: "string", default: "90" }, delay: { type: "string", default: "37000" }, "skip-file": { type: "string", default: ".seed-card-gifs-no-gif.txt" } },
  });
  const limit = Number(values.limit);
  const delayMs = Number(values.delay);
  const skipFile = values["skip-file"]!;
  const skipped = new Set(existsSync(skipFile) ? readFileSync(skipFile, "utf8").split("\n").filter(Boolean) : []);
  const apiKey = process.env.GIPHY_API_KEY;
  const supabase = createAdminClient();
  if (!supabase || !apiKey) throw new Error("Configure Supabase and GIPHY_API_KEY.");

  const [lessons, paths] = await Promise.all([
    supabase.from("course_lessons").select("set_id"),
    supabase.from("learning_paths").select("id").eq("owner_id", process.env.SEED_CONTENT_OWNER_ID ?? ""),
  ]);
  if (lessons.error || paths.error) throw new Error(lessons.error?.message ?? paths.error?.message);
  const pathItems = paths.data.length ? await supabase.from("path_items").select("set_id").in("path_id", paths.data.map(({ id }) => id)) : { data: [], error: null };
  if (pathItems.error) throw new Error(pathItems.error.message);
  const setIds = [...new Set([...lessons.data.map((lesson) => lesson.set_id), ...pathItems.data.map((item) => item.set_id)])];

  const cards: { id: string; term: string; part_of_speech: string | null }[] = [];
  if (setIds.length) for (let from = 0; ; from += 1000) {
    const page = await supabase.from("cards").select("id, term, part_of_speech").in("set_id", setIds).is("image_url", null).order("id").range(from, from + 999);
    if (page.error) throw new Error(page.error.message);
    cards.push(...page.data);
    if (page.data.length < 1000) break;
  }

  const byQuery = new Map<string, { noun: boolean; ids: string[] }>();
  for (const card of cards) {
    const query = card.term.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
    if (!query || skipped.has(query)) continue;
    const entry = byQuery.get(query) ?? { noun: /noun|danh từ/i.test(card.part_of_speech ?? ""), ids: [] };
    entry.ids.push(card.id);
    byQuery.set(query, entry);
  }
  console.log(`${setIds.length} course and path sets, ${cards.length} cards without an image, ${byQuery.size} distinct terms to search (${skipped.size} skipped, no GIF).`);
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
    if (!url) { missing += 1; appendFileSync(skipFile, `${query}\n`); console.log(`[${searched}] ${query} -> no GIF`); continue; }
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
