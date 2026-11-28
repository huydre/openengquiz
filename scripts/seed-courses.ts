import { readFile, appendFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { generateText, Output } from "ai";
import { z } from "zod";
import { cardTermKey, generatedCardSchema, type GeneratedCard } from "../src/lib/ai/generated-card-data";
import { assertQuota, recordUsage } from "../src/lib/ai/quota";
import { parseCourseCatalog } from "../src/lib/courses/course-catalog";
import { courseCards } from "../src/lib/courses/course-progress";
import { courseActivityContentSchema } from "../src/lib/courses/lesson-activities";
import { generateActivityContent } from "./seed-activity-content";
import { seedModel } from "./seed-model";
import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const { values } = parseArgs({ options: { level: { type: "string" } } });
  const { levels, ...course } = parseCourseCatalog(await readFile(new URL("../content/courses/ielts.yaml", import.meta.url), "utf8"));
  if (values.level && !levels.some((level) => level.slug === values.level)) throw new Error("Unknown level slug.");
  const userId = z.uuid().parse(process.env.SEED_CONTENT_OWNER_ID ?? "");
  const supabase = createAdminClient();
  const { SEED_AI_BASE_URL: baseURL, SEED_AI_API_KEY: apiKey, SEED_AI_MODEL: modelId } = process.env;
  if (!supabase || !baseURL || !apiKey || !modelId) throw new Error("Configure Supabase and SEED_AI_BASE_URL, SEED_AI_API_KEY, SEED_AI_MODEL.");
  const model = seedModel(baseURL, apiKey, modelId);
  const profile = await supabase.from("profiles").select("id").eq("id", userId).single();
  if (profile.error) throw new Error("Content owner profile not found.");

  // Preflight: the v2 seed RPC is required for activity_content.
  const probe = await supabase.from("course_lessons").select("activity_content").limit(1);
  if (probe.error) {
    throw new Error(`course_lessons.activity_content missing; apply migration 20261127200000_course_activities.sql first. (${probe.error.message})`);
  }

  const { data: existing, error } = await supabase.from("courses")
    .select("course_levels(slug,course_parts(course_lessons(set_id)))").eq("slug", course.slug).maybeSingle();
  if (error) throw error;
  const seeded = new Set(existing?.course_levels.map((level) => level.slug));
  const seen = new Set<string>();
  for (const level of existing?.course_levels ?? []) for (const part of level.course_parts) {
    const { data, error } = await supabase.from("cards").select("term").in("set_id", part.course_lessons.map((lesson) => lesson.set_id));
    if (error) throw error;
    for (const card of data) seen.add(cardTermKey(card.term));
  }
  for (const [position, level] of levels.entries()) {
    if ((values.level && level.slug !== values.level) || seeded.has(level.slug)) continue;
    const checkpoint = process.env.SEED_CHECKPOINT_DIR && `${process.env.SEED_CHECKPOINT_DIR}/${level.slug}.jsonl`;
    const draftSchema = z.object({ title: z.string(), question: z.string(), icon: z.string(), cards: z.array(generatedCardSchema).length(8), activity_content: courseActivityContentSchema.optional() });
    const drafts = new Map<string, z.infer<typeof draftSchema>>();
    if (checkpoint) {
      const text = await readFile(checkpoint, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
        return "";
      });
      for (const line of text.trim().split("\n").filter(Boolean)) {
        const draft = draftSchema.parse(JSON.parse(line));
        drafts.set(draft.title, draft);
      }
    }
    const ready = new Map<string, z.infer<typeof draftSchema>>();
    const lessons = level.parts.flatMap((part) => part.lessons);
    for (const { title, question, icon } of lessons) {
      const saved = drafts.get(title);
      const keys = saved?.cards.map((card) => cardTermKey(card.term));
      if (saved?.question !== question || saved.icon !== icon || !keys || new Set(keys).size !== 8 || keys.some((key) => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      ready.set(title, saved);
      console.log(`Resumed ${level.slug}: ${title}`);
    }

    const prepare = async ({ title, icon, question, scope }: typeof lessons[number]) => {
      const cards: GeneratedCard[] = [];
      try {
        for (let batch = 0; cards.length < level.words && batch < 6; batch++) {
          const signal = AbortSignal.timeout(120_000);
          await assertQuota(supabase, userId, "seed-courses");
          await recordUsage(supabase, userId, "seed-courses");
          const { output } = await generateText({ model, maxRetries: 0, abortSignal: signal,
            system: "Write original English-Vietnamese vocabulary flashcards for this lesson and CEFR. Use words or short phrases, not full sentences as terms. Avoid excluded terms. Each card needs IPA, a concise natural Vietnamese definition, an original English example using the term, and its natural Vietnamese translation. Use no em or en dashes. Never copy a vocabulary list.",
            prompt: JSON.stringify({ question, topic: title, scope, level: level.cefr, count: level.words - cards.length + 5, exclude: [...Array.from(seen).slice(-16), ...cards.map((card) => cardTermKey(card.term))], angle: batch % 2 ? "objects and actions" : "situations and useful expressions" }),
            output: Output.object({ schema: z.object({ cards: z.array(generatedCardSchema).min(1).max(20) }) }),
          });
          const complete = output.cards.filter((card) => card.example_vi?.trim() && !/\u2014| \u2013 /.test(JSON.stringify(card)));
          cards.push(...courseCards(complete, seen, level.words - cards.length));
          if (cards.length < level.words) console.warn(`Vocabulary batch ${batch + 1} for "${title}": ${cards.length}/${level.words} complete cards`);
        }
        if (cards.length !== level.words) throw new Error(`Incomplete vocabulary: ${question}`);
        if (cards.length !== 8) throw new Error(`Lesson ${title} produced ${cards.length} cards; the activity model requires exactly 8.`);
        let activity_content;
        try {
          activity_content = await generateActivityContent(model, userId, supabase, {
            lessonTitle: title,
            warmupQuestion: question,
            cefr: level.cefr,
            levelTitle: level.title,
            groupA: cards.slice(0, 4).map((card) => card.term),
            groupB: cards.slice(4, 8).map((card) => card.term),
          });
        } catch (error) {
          console.warn(`Activity pending for "${title}": ${error instanceof Error ? error.message : "generation failed"}`);
        }
        const draft = { title, question, icon, activity_content, cards };
        if (checkpoint) await appendFile(checkpoint, `${JSON.stringify(draft)}\n`, { mode: 0o600 });
        ready.set(title, draft);
        console.log(`Prepared ${level.slug}: ${title}`);
      } finally {
        if (!ready.has(title)) for (const card of cards) seen.delete(cardTermKey(card.term));
      }
    };
    const workers = process.env.SEED_CHECKPOINT_DIR ? 2 : 1;
    for (let pass = 0; pass < 2; pass++) {
      const pending = lessons.filter((lesson) => !ready.has(lesson.title));
      for (let start = 0; start < pending.length; start += workers) {
        await Promise.all(pending.slice(start, start + workers).map(async (lesson) => {
          try {
            await prepare(lesson);
          } catch (error) {
            console.warn(`Lesson pending for "${lesson.title}": ${error instanceof Error ? error.message : "generation failed"}`);
          }
        }));
      }
    }
    const missing = lessons.filter(({ title }) => !ready.has(title));
    if (missing.length) throw new Error(`Missing vocabulary (${missing.map(({ title }) => title).join(", ")})`);
    const failedActivities = [...ready.values()].filter((draft) => !draft.activity_content).map(({ title }) => title);
    const parts = level.parts.map((part) => ({ title: part.title, lessons: part.lessons.map(({ title }) => {
      const draft = ready.get(title)!;
      return { ...draft, cards: draft.cards.map((card) => ({ ...card, term_key: cardTermKey(card.term) })) };
    }) }));
    const { data: published, error } = await supabase.rpc("seed_course_level_v2", { p_owner: userId, p_course: course,
      p_level: { ...level, position, words_target: level.words * 30, parts } });
    if (error) throw error;
    if (!published) throw new Error("Another seed published this level. Restart to reload course vocabulary.");
    console.log(`Published ${course.slug}/${level.slug}`);
    if (failedActivities.length) {
      console.warn(`Missing activities (${failedActivities.join(", ")}). Run pnpm seed:lesson-activities --level ${level.slug}.`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Course seed failed."); process.exitCode = 1; });
