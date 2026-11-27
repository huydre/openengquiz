import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLessonComparison } from "./course-progress";
import type {
  FeedbackTone,
  LessonAttempt,
  LessonCallState,
  LessonComparison,
  LessonFeedback,
  LessonIdea,
  LessonPlayerState,
  LessonStep,
} from "./lesson-player-types";
import { LESSON_STEPS } from "./lesson-player-types";

const TONES: FeedbackTone[] = ["serious", "friendly", "funny"];

const asTone = (value: unknown): FeedbackTone =>
  TONES.includes(value as FeedbackTone) ? (value as FeedbackTone) : "friendly";
const asStep = (value: unknown): LessonStep =>
  LESSON_STEPS.includes(value as LessonStep) ? (value as LessonStep) : 1;

function asIdeas(value: unknown): LessonIdea[] | null {
  if (!Array.isArray(value)) return null;
  const ideas = value.filter((item): item is LessonIdea =>
    typeof item === "object" && item !== null &&
    typeof (item as LessonIdea).vi === "string" && typeof (item as LessonIdea).en === "string");
  return ideas.length ? ideas : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asFeedback(value: unknown): LessonFeedback | null {
  if (typeof value !== "object" || value === null) return null;
  const fb = value as LessonFeedback;
  return typeof fb.score === "number" && typeof fb.comment_vi === "string" ? fb : null;
}

function asPronScore(value: unknown): { score: number | null } | null {
  if (typeof value !== "object" || value === null) return null;
  const score = (value as { score?: unknown }).score;
  return { score: typeof score === "number" ? score : null };
}

interface AttemptRow {
  id: string;
  phase: string | null;
  transcript: string;
  pron: unknown;
  feedback: unknown;
  created_at: string;
}

function toAttempt(row: AttemptRow, phase: "first" | "second"): LessonAttempt {
  return {
    id: row.id,
    phase,
    transcript: row.transcript,
    pron: asPronScore(row.pron),
    feedback: asFeedback(row.feedback),
    createdAt: row.created_at,
  };
}

/**
 * Loads everything the 7-step lesson player needs for one lesson.
 * `db` is the request-scoped client (RLS applies); course content tables are
 * readable by any signed-in user.
 */
export async function getLessonPlayerState(db: SupabaseClient, lessonId: string, userId: string): Promise<LessonPlayerState | null> {
  const { data: lesson, error } = await db.from("course_lessons")
    .select("id,set_id,warmup_question,warmup_question_vi,position,course_parts!inner(position,level_id,course_levels!inner(cefr))")
    .eq("id", lessonId).maybeSingle();
  if (error) throw error;
  if (!lesson) return null;

  const part = lesson.course_parts as unknown as {
    position: number;
    course_levels: { cefr: string };
  };

  const [progress, profile, attemptRows, thread] = await Promise.all([
    db.from("lesson_progress")
      .select("step,calling,completed_at,warmup_transcript,ideas,weak_terms,first_attempt_id,second_attempt_id")
      .eq("lesson_id", lessonId).maybeSingle(),
    db.from("profiles").select("feedback_tone").eq("id", userId).maybeSingle(),
    db.from("speaking_attempts")
      .select("id,phase,transcript,pron,feedback,created_at")
      .eq("lesson_id", lessonId).order("created_at", { ascending: false }).order("id", { ascending: false })
      .then((r) => {
        if (r.error) throw r.error;
        return r.data ?? [];
      }),
    // Latest course call thread for this lesson's set; finished flag comes from
    // the server-only course_finished_at marker.
    db.from("chat_threads")
      .select("id,summary,course_finished_at,chat_messages(role,content)")
      .eq("set_id", lesson.set_id).eq("scenario", "course")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1)
      .order("created_at", { referencedTable: "chat_messages" })
      .order("id", { referencedTable: "chat_messages" }).maybeSingle(),
  ]);
  if (progress.error) throw progress.error;
  if (profile.error) throw profile.error;
  if (thread.error) throw thread.error;

  const row = progress.data;
  const step = asStep(row?.step);
  const complete = Boolean(row?.completed_at);

  const rows = attemptRows as AttemptRow[];
  const byId = new Map(rows.map((a) => [a.id, a]));
  const toPhase = (id: string | null | undefined, phase: "first" | "second") =>
    id && byId.has(id) ? toAttempt(byId.get(id)!, phase) : null;

  // Pointers are authoritative; rows without a pointer still appear in history.
  const first = toPhase(row?.first_attempt_id, "first");
  const second = toPhase(row?.second_attempt_id, "second");

  // Comparison needs lesson terms; load card terms only when both attempts exist.
  let comparison: LessonComparison | null = null;
  if (first && second) {
    const { data: cards, error: cardsError } = await db.from("cards").select("term").eq("set_id", lesson.set_id);
    if (cardsError) throw cardsError;
    const derived = buildLessonComparison(first, second, (cards ?? []).map((c) => c.term));
    if (derived) comparison = { first, second, ...derived };
  }

  const attempts: LessonAttempt[] = rows.map((a) =>
    toAttempt(a, a.phase === "second" ? "second" : "first"));

  let call: LessonCallState | null = null;
  const threadRow = thread.data;
  if (threadRow && step === 7 && row?.calling && !complete) {
    const messages = ((threadRow.chat_messages ?? []) as { role: string; content: string }[])
      .map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content }));
    call = {
      threadId: threadRow.id,
      scenario: "course",
      finished: threadRow.course_finished_at != null,
      messages,
    };
  }

  return {
    lessonId,
    step,
    complete,
    partPosition: (part?.position ?? 0) + 1,
    lessonPosition: (lesson.position ?? 0) + 1,
    cefr: part?.course_levels?.cefr ?? "B1",
    warmupTranscript: row?.warmup_transcript ?? null,
    warmupQuestionVi: lesson.warmup_question_vi ?? null,
    tone: asTone(profile.data?.feedback_tone),
    attempts,
    first,
    second,
    comparison,
    ideas: asIdeas(row?.ideas),
    weakTerms: asStringArray(row?.weak_terms),
    calling: Boolean(row?.calling),
    narration: null,
    call,
  };
}
