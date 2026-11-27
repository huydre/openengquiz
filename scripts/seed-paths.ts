import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { generateText, Output } from "ai";
import { parse } from "yaml";
import { z } from "zod";
import { cardTermKey, generatedCardSchema } from "../src/lib/ai/generated-card-data";
import { assertQuota, recordUsage } from "../src/lib/ai/quota";
import { createAdminClient } from "../src/lib/supabase/admin";
import { seedModel } from "./seed-model";

const catalogSchema = z.array(z.object({
  slug: z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(3000),
  tags: z.array(z.enum(["ielts", "toeic", "thpt", "communication", "work"])).min(1).max(10),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  sets: z.array(z.object({ title: z.string().trim().min(1).max(200), topic: z.string().trim().min(1), words: z.number().int().min(1).max(60) })).min(1).max(20),
})).min(1);

const forbiddenDash = /\u2014| \u2013 /u;
const cardSchema = generatedCardSchema.extend({
  ipa: z.string().trim().min(1).max(100), part_of_speech: z.string().trim().min(1).max(100),
  definition_en: z.string().trim().min(1).max(2000), example_en: z.string().trim().min(1).max(2000),
  example_vi: z.string().trim().min(1).max(2000),
});

async function main() {
  const { values } = parseArgs({ options: { path: { type: "string" } } });
  const source = await readFile(new URL("../content/paths/catalog.yaml", import.meta.url), "utf8");
  if (forbiddenDash.test(source)) throw new Error("Catalog contains forbidden punctuation.");
  const catalog = catalogSchema.parse(parse(source));
  if (new Set(catalog.map(({ slug }) => slug)).size !== catalog.length) throw new Error("Duplicate path slug.");
  const paths = catalog.filter(({ slug }) => !values.path || slug === values.path);
  if (!paths.length) throw new Error("Unknown path slug.");

  const owner = z.uuid().parse(process.env.SEED_CONTENT_OWNER_ID);
  const db = createAdminClient();
  if (!db) throw new Error("Configure Supabase for seeding.");
  const { SEED_AI_BASE_URL: url, SEED_AI_API_KEY: key, SEED_AI_MODEL: modelId } = process.env;
  if (!url || !key || !modelId) throw new Error("Configure SEED_AI_BASE_URL, SEED_AI_API_KEY, SEED_AI_MODEL.");
  const model = seedModel(url, key, modelId);
  const profile = await db.from("profiles").select("id").eq("id", owner).single();
  if (profile.error) throw new Error("Content owner profile not found.");
  const existing = await db.from("learning_paths").select("slug").in("slug", paths.map(({ slug }) => slug));
  if (existing.error) throw new Error(existing.error.message);
  const seeded = new Set(existing.data.map(({ slug }) => slug));
  let pathCount = 0, setCount = 0, cardCount = 0;

  for (const path of paths) {
    if (seeded.has(path.slug)) { console.log(`Skipped ${path.slug}`); continue; }
    const seen = new Set<string>();
    const sets = [];
    for (const { title, topic, words } of path.sets) {
      const cards: z.infer<typeof cardSchema>[] = [];
      for (let attempt = 1; attempt <= 3 && cards.length < words; attempt++) {
        await assertQuota(db, owner, "seed-paths");
        await recordUsage(db, owner, "seed-paths");
        let output: { cards: z.infer<typeof cardSchema>[] };
        try {
          ({ output } = await generateText({
            model, maxRetries: 0, abortSignal: AbortSignal.timeout(120_000),
            system: "Write original English-Vietnamese vocabulary flashcards. Match the CEFR in the target sense. Use short terms or expressions, IPA, part of speech, accurate English and natural Vietnamese definitions, an original English sentence using that sense and its natural Vietnamese translation. For language functions, use a complete example in context and label the part of speech or function. Use synonyms for that sense only, or an empty array if none fit. No em dashes or en dashes. Never copy a vocabulary list.",
            prompt: JSON.stringify({ title, topic, level: path.level, count: words - cards.length + 4, exclude: [...seen].slice(-60), attempt }),
            output: Output.object({ schema: z.object({ cards: z.array(cardSchema).min(1).max(64) }) }),
          }));
        } catch (error) {
          if (attempt === 3) throw error;
          console.warn(`Retrying ${path.slug}/${title} after generation attempt ${attempt}.`);
          continue;
        }
        for (const card of output.cards) {
          if (forbiddenDash.test(JSON.stringify(card))) continue;
          const key = cardTermKey(card.term);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          cards.push(card);
          if (cards.length === words) break;
        }
        console.log(`Prepared ${path.slug}/${title}: ${cards.length}/${words}`);
      }
      if (cards.length !== words) throw new Error(`Incomplete set ${path.slug}/${title}: ${cards.length}/${words}`);
      sets.push({ title, description: `Từ vựng tiếng Anh về ${topic} ở trình độ ${path.level}.`, cards });
    }
    const published = await db.rpc("seed_learning_path", {
      p_owner_id: owner, p_slug: path.slug, p_title: path.title, p_description: path.description,
      p_tags: path.tags, p_level: path.level, p_sets: sets,
    });
    if (published.error) throw published.error;
    if (!published.data) { console.log(`Skipped concurrently seeded ${path.slug}`); continue; }
    pathCount++;
    setCount += sets.length;
    cardCount += sets.reduce((total, set) => total + set.cards.length, 0);
    console.log(`Published ${path.slug}`);
  }
  console.log(`Seeded ${pathCount} paths, ${setCount} sets, ${cardCount} cards.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Path seed failed."); process.exitCode = 1; });
