import { readFile } from "node:fs/promises";
import { z } from "zod";
import { isAiConfigured } from "../src/lib/ai/client";
import { generateCards } from "../src/lib/ai/generate-cards";
import { requestPathOutput } from "../src/lib/ai/generate-path";
import type { GeneratedCard } from "../src/lib/ai/generated-card-data";
import { assertQuota, recordUsage } from "../src/lib/ai/quota";
import { pathCards } from "../src/lib/paths/path-cards";
import { parsePathCatalog } from "../src/lib/paths/path-catalog";
import { createAdminClient } from "../src/lib/supabase/admin";
import { normalizeLookupTerm } from "../src/lib/vocab/lookup-term";

const wordsOutput = z.object({ words: z.array(z.string().max(100)).max(25) });

async function main() {
  const paths = parsePathCatalog(await readFile(new URL("../content/paths.yaml", import.meta.url), "utf8"));
  const owner = z.uuid().safeParse(process.env.SEED_PATHS_OWNER_ID);
  const db = createAdminClient();
  if (!owner.success || !db || !isAiConfigured()) throw new Error("Set SEED_PATHS_OWNER_ID, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, DEEPSEEK_API_KEY and AI_MODEL.");
  const userId = owner.data;
  const profile = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profile.error || !profile.data) throw new Error("Cannot find the configured system profile.");
  for (const path of paths) {
    try {
      const existing = await db.from("learning_paths").select("id").eq("slug", path.slug).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        console.log(`Skipped ${path.slug} (already exists)`);
        continue;
      }
      const seen = new Set<string>();
      const sets = [];
      for (const { topic, level } of path.sets) {
        const cards: GeneratedCard[] = [];
        const tried = new Set<string>();
        for (let batch = 0; cards.length < path.words && batch < Math.ceil(path.words / 15) + 3; batch++) {
          const signal = AbortSignal.timeout(120_000);
          const count = Math.min(25, path.words - cards.length + 3);
          const { words } = await requestPathOutput(wordsOutput, { topic, level, count, exclude: [...seen, ...tried] },
            "Generate exactly count useful English terms or phrases at the given CEFR level. Stay on topic, avoid every excluded term, and do not copy any vocabulary list.",
            async () => {
              await assertQuota(db, userId, "seed-paths");
              await recordUsage(db, userId, "seed-paths");
            }, signal);
          const candidates = [...new Set(words.map(normalizeLookupTerm))]
            .filter((word): word is string => word !== null && !seen.has(word) && !tried.has(word));
          if (!candidates.length) continue;
          candidates.forEach((word) => tried.add(word));
          const generated = await generateCards({ source: { type: "words", words: candidates }, existingTerms: [],
            userId, supabase: db, pathQuota: "seed-paths", signal });
          cards.push(...pathCards(generated, seen, path.words - cards.length));
        }
        if (cards.length !== path.words) throw new Error(`${topic}: ${cards.length}/${path.words} complete unique cards`);
        sets.push({ title: topic, description: null, cards });
      }
      const result = await db.rpc("seed_learning_path", { p_owner_id: userId, p_slug: path.slug, p_title: path.title,
        p_description: path.description, p_tags: path.tags, p_level: path.level, p_sets: sets });
      if (result.error || !result.data) throw new Error("Could not save the path. Check migrations and grants.");
      console.log(`Saved ${path.slug} as private`);
    } catch (error) {
      console.error(`Seed failed for ${path.slug}: ${error instanceof Error ? error.name : "DatabaseError"}`);
      process.exitCode = 1;
      return;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed configuration failed.");
  process.exitCode = 1;
});
