import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { parseCourseCatalog } from "../src/lib/courses/course-catalog";
import { generateActivityContent } from "./seed-activity-content";
import { seedModel } from "./seed-model";
import { createAdminClient } from "../src/lib/supabase/admin";

/**
 * Backfills course_lessons.activity_content for already-seeded levels.
 * Idempotent: only lessons whose activity_content is null are touched, and
 * each update is guarded by .is('activity_content', null) so a concurrent
 * writer cannot be overwritten.
 *
 * Usage: bun --conditions=react-server scripts/seed-lesson-activities.ts [--level foundations]
 */

interface LessonRow {
  id: string;
  title: string;
  warmup_question: string;
  set_id: string;
  position: number;
  course_parts: { course_levels: { slug: string; cefr: string; title: string } };
}

interface CardRow {
  term: string;
}

async function main() {
  const { values } = parseArgs({ options: { level: { type: "string" } } });
  const userId = z.uuid().parse(process.env.SEED_CONTENT_OWNER_ID ?? "");
  const supabase = createAdminClient();
  const { SEED_AI_BASE_URL: baseURL, SEED_AI_API_KEY: apiKey, SEED_AI_MODEL: modelId } = process.env;
  if (!supabase || !baseURL || !apiKey || !modelId) {
    throw new Error("Configure Supabase and SEED_AI_BASE_URL, SEED_AI_API_KEY, SEED_AI_MODEL.");
  }
  const model = seedModel(baseURL, apiKey, modelId);

  // Preflight: refuse to run if the v2 schema is not deployed.
  const probe = await supabase.from("course_lessons").select("activity_content").limit(1);
  if (probe.error) {
    throw new Error(
      `course_lessons.activity_content missing; apply migration 20261127200000_course_activities.sql first. (${probe.error.message})`,
    );
  }

  const { levels } = parseCourseCatalog(await readFile(new URL("../content/courses/ielts.yaml", import.meta.url), "utf8"));
  const targetSlugs = values.level ? [values.level] : levels.map((l) => l.slug);
  for (const slug of targetSlugs) {
    if (!levels.some((l) => l.slug === slug)) throw new Error(`Unknown level slug: ${slug}`);
  }

  const { data: course, error: courseError } = await supabase.from("courses").select("id").eq("slug", "ielts").single();
  if (courseError) throw courseError;

  const { data: levelRows, error: levelError } = await supabase
    .from("course_levels")
    .select("id,slug")
    .eq("course_id", course.id)
    .in("slug", targetSlugs);
  if (levelError) throw levelError;
  if (!levelRows?.length) throw new Error("No matching course_levels found.");

  for (const level of levelRows) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("course_lessons")
      .select("id,title,warmup_question,set_id,position,course_parts!inner(level_id,course_levels!inner(slug,cefr,title))")
      .eq("course_parts.level_id", level.id)
      .is("activity_content", null)
      .order("position");
    if (lessonsError) throw lessonsError;
    if (!lessons?.length) {
      console.log(`Level ${level.slug}: all lessons already have activity_content.`);
      continue;
    }

    const failed: string[] = [];
    for (const lesson of lessons as unknown as LessonRow[]) {
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select("term")
        .eq("set_id", lesson.set_id)
        .order("position")
        .order("id")
        .limit(8);
      if (cardsError) throw cardsError;
      if (!cards || cards.length !== 8) {
        throw new Error(`Lesson ${lesson.id} has ${cards?.length ?? 0} cards; expected 8.`);
      }
      let content;
      try {
        content = await generateActivityContent(model, userId, supabase, {
          lessonTitle: lesson.title,
          warmupQuestion: lesson.warmup_question,
          cefr: lesson.course_parts.course_levels.cefr,
          levelTitle: lesson.course_parts.course_levels.title,
          groupA: cards.slice(0, 4).map((c: CardRow) => c.term),
          groupB: cards.slice(4, 8).map((c: CardRow) => c.term),
        });
      } catch (error) {
        // One lesson failing the content checks must not stop the level; rerun to fill the gaps.
        failed.push(lesson.title);
        console.warn(`Skipped "${lesson.title}": ${error instanceof Error ? error.message : "generation failed"}`);
        continue;
      }
      const { data: updated, error: updateError } = await supabase
        .from("course_lessons")
        .update({ activity_content: content })
        .eq("id", lesson.id)
        .is("activity_content", null)
        .select("id");
      if (updateError) throw updateError;
      if (!updated?.length) {
        console.log(`Lesson ${lesson.id}: skipped, activity_content already set by another writer.`);
        continue;
      }
      console.log(`Backfilled activity_content for ${level.slug} lesson ${lesson.position + 1} (${lesson.title})`);
    }
    if (failed.length) {
      console.warn(`Level ${level.slug}: ${failed.length} lesson(s) still empty (${failed.join(", ")}). Run again to retry them.`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Lesson activity seed failed.");
  process.exitCode = 1;
});
