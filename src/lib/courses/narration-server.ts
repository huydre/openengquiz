import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAiConfigured } from "@/lib/ai/client";
import { generateLessonNarration } from "@/lib/ai/narration";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import {
  fallbackNarration,
  narrationLinesSchema,
  type NarrationKind,
  type NarrationLine,
} from "./narration";

/**
 * Returns cached narration lines for a lesson, generating and storing them on first use.
 * Falls back to fixed lines when AI is off, quota is exhausted, or generation fails.
 * Pass the service-role client so the cache write always succeeds.
 */
export async function getLessonNarration(
  db: SupabaseClient,
  lesson: {
    id: string;
    title: string;
    warmup_question: string;
    cefr: string;
    words: string[];
  },
  kind: NarrationKind,
  userId: string,
  signal: AbortSignal,
): Promise<NarrationLine[]> {
  const { data: cached } = await db
    .from("lesson_narration")
    .select("lines")
    .eq("lesson_id", lesson.id)
    .eq("kind", kind)
    .maybeSingle();
  const parsed = narrationLinesSchema.safeParse(cached?.lines);
  if (parsed.success) return parsed.data;

  if (!isAiConfigured()) return fallbackNarration(kind, lesson.title);

  try {
    await assertQuota(db, userId, "narration");
    const lines = await generateLessonNarration(
      {
        kind,
        title: lesson.title,
        question: lesson.warmup_question,
        cefr: lesson.cefr,
        words: lesson.words,
      },
      signal,
    );
    await recordUsage(db, userId, "narration");
    const { error } = await db
      .from("lesson_narration")
      .upsert({ lesson_id: lesson.id, kind, lines }, { onConflict: "lesson_id,kind" });
    if (error) console.error("lesson_narration cache write failed", error.code ?? error.name);
    return lines;
  } catch (error) {
    if (error instanceof QuotaExceededError) return fallbackNarration(kind, lesson.title);
    console.error("narration generation failed", error instanceof Error ? error.name : "error");
    return fallbackNarration(kind, lesson.title);
  }
}
