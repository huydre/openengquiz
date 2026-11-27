import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { getCourseLesson } from "@/lib/courses/course-data";
import {
  generateLessonFeedback,
  generateLessonIdeas,
  retoneLessonFeedback,
  translateWarmupQuestion,
  type LessonAnswerInput,
} from "@/lib/courses/course-feedback";
import { canActOnLesson, usedCourseTerms } from "@/lib/courses/course-progress";
import { FEEDBACK_TONES, type FeedbackTone, type LessonFeedback, type LessonStep } from "@/lib/courses/lesson-player-types";
import { parseMultipart, readBoundedBody } from "@/lib/http/multipart";
import { assessPronunciation, isSpeechServiceConfigured } from "@/lib/speech/client";
import { MAX_AUDIO_BYTES, wavDuration } from "@/lib/speech/speaking-wav";
import { transcribeRecording } from "@/lib/speech/transcribe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const textSchema = z.string().trim().min(1).max(2000);
const weakTermsSchema = z.array(z.string().trim().min(1).max(200)).max(60);
const threadIdSchema = z.uuid();

const jsonSchema = z.object({
  step: z.number().int().min(1).max(7),
  action: z.enum(["advance", "answer", "retry", "ideas", "tone", "translate"]).default("advance"),
  transcript: textSchema.optional(),
  tone: z.enum(FEEDBACK_TONES).optional(),
  weakTerms: weakTermsSchema.optional(),
  threadId: threadIdSchema.optional(),
  typed: z.boolean().optional(),
});

interface Normalized {
  step: number;
  action: "advance" | "answer" | "retry" | "ideas" | "tone" | "translate";
  transcript: string | null;
  typed: boolean;
  tone: FeedbackTone | null;
  weakTerms: string[] | null;
  threadId: string | null;
  audio: Blob | null;
}

async function readInput(request: Request, signal: AbortSignal): Promise<Normalized | Response> {
  const type = request.headers.get("content-type") ?? "";
  if (/^multipart\/form-data(?:;|$)/i.test(type)) {
    const raw = await readBoundedBody(request, MAX_AUDIO_BYTES + 32768, signal);
    const form = raw ? await parseMultipart(raw, type) : null;
    if (!form) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    const audio = form.get("audio");
    const step = Number(form.get("step"));
    const action = String(form.get("action") ?? "advance");
    const transcriptField = form.get("transcript");
    const parsed = jsonSchema.safeParse({
      step,
      action,
      transcript: typeof transcriptField === "string" && transcriptField.trim() ? transcriptField.trim().slice(0, 2000) : undefined,
      tone: form.get("tone") || undefined,
      weakTerms: (() => {
        const raw = form.get("weakTerms");
        if (typeof raw !== "string" || !raw.trim()) return undefined;
        try { return JSON.parse(raw); } catch { return "__invalid__"; }
      })(),
      threadId: form.get("threadId") || undefined,
      typed: form.get("typed") === "true",
    });
    if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    if (audio !== null && !(audio instanceof File)) return Response.json({ error: "Bản ghi không hợp lệ." }, { status: 400 });
    if (audio instanceof File && audio.size > MAX_AUDIO_BYTES) throw new RangeError("Oversize WAV");
    return {
      step: parsed.data.step,
      action: parsed.data.action,
      transcript: parsed.data.transcript ?? null,
      typed: parsed.data.typed ?? false,
      tone: parsed.data.tone ?? null,
      weakTerms: parsed.data.weakTerms ?? null,
      threadId: parsed.data.threadId ?? null,
      audio: audio instanceof File ? audio : null,
    };
  }
  const parsed = jsonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  return {
    step: parsed.data.step,
    action: parsed.data.action,
    transcript: parsed.data.transcript ?? null,
    typed: parsed.data.typed ?? false,
    tone: parsed.data.tone ?? null,
    weakTerms: parsed.data.weakTerms ?? null,
    threadId: parsed.data.threadId ?? null,
    audio: null,
  };
}

interface RpcResult {
  step: number;
  calling: boolean;
  attempt: string | null;
  complete: boolean;
}

async function rpc(admin: SupabaseClient, userId: string, lessonId: string,
  step: number, action: string, payload: Record<string, unknown>): Promise<RpcResult | null> {
  const { data, error } = await admin.rpc("advance_course_lesson", {
    p_user: userId, p_lesson: lessonId, p_step: step, p_action: action, p_payload: payload,
  });
  if (error) throw error;
  return data as RpcResult | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]);
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    const { lessonId } = await params;
    if (!z.uuid().safeParse(lessonId).success) return Response.json({ error: "Bài học không hợp lệ." }, { status: 400 });
    const admin = createAdminClient();
    if (!admin) return Response.json({ error: "Chưa thể lưu tiến độ." }, { status: 503 });
    const current = await getCourseLesson(db, lessonId);
    if (!current) return Response.json({ error: "Không tìm thấy bài học." }, { status: 404 });
    if (current.lesson.activity_content) return Response.json({ error: "Bài học đã chuyển sang hoạt động mới. Tải lại trang." }, { status: 409 });
    if (!current.open || current.progress?.completed_at) return Response.json({ error: "Bài học không khả dụng." }, { status: 409 });

    const input = await readInput(request, signal);
    if (input instanceof Response) return input;
    const { step, action } = input;
    if (step !== (current.progress?.step ?? 1)) {
      return Response.json({ error: "Bước học đã thay đổi. Tải lại trang." }, { status: 409 });
    }
    if (!canActOnLesson(step, action, Boolean(current.progress?.calling), Boolean(current.progress?.second_attempt_id))) {
      return Response.json({ error: "Thao tác không hợp lệ ở bước này." }, { status: 409 });
    }

    if (action === "ideas") {
      const cached = current.progress?.ideas;
      if (Array.isArray(cached) && cached.length) {
        return Response.json({ step, complete: false, ideas: cached });
      }
      if (!isAiConfigured()) return Response.json({ error: "AI chưa được bật." }, { status: 503 });
      const { data: cards, error } = await db.from("cards").select("term").eq("set_id", current.lesson.set_id);
      if (error) throw error;
      await assertQuota(db, user.id, "speaking");
      signal.throwIfAborted();
      const ideas = await generateLessonIdeas({
        question: current.lesson.warmup_question,
        cefr: current.lesson.course_parts.course_levels.cefr,
        terms: (cards ?? []).map((c) => c.term),
        signal,
      });
      signal.throwIfAborted();
      await recordUsage(db, user.id, "speaking");
      const saved = await rpc(admin, user.id, lessonId, step, "ideas", { ideas });
      if (!saved) return Response.json({ error: "Chưa lưu được gợi ý." }, { status: 409 });
      return Response.json({ step, complete: false, ideas });
    }

    if (action === "tone") {
      if (!input.tone) return Response.json({ error: "Thiếu giọng góp ý." }, { status: 400 });
      const saved = await rpc(admin, user.id, lessonId, step, "tone", { tone: input.tone });
      if (!saved) return Response.json({ error: "Chưa lưu được giọng góp ý." }, { status: 409 });
      // Regenerate the Vietnamese-facing fields of the latest attempt feedback.
      let attempt = null;
      if (isAiConfigured()) {
        const latestId = current.progress?.second_attempt_id ?? current.progress?.first_attempt_id;
        if (latestId) {
          const { data: row } = await db.from("speaking_attempts")
            .select("id,phase,transcript,pron,feedback,created_at").eq("id", latestId).eq("user_id", user.id).maybeSingle();
          const feedback = row?.feedback as LessonFeedback | null;
          if (row && feedback) {
            try {
              await assertQuota(db, user.id, "speaking");
              const retone = await retoneLessonFeedback({
                question: current.lesson.warmup_question,
                transcript: row.transcript,
                feedback,
                tone: input.tone,
                signal,
              });
              signal.throwIfAborted();
              await recordUsage(db, user.id, "speaking");
              const merged = { ...feedback, ...retone };
              const { error: updateError } = await admin.from("speaking_attempts").update({ feedback: merged }).eq("id", row.id);
              if (updateError) throw updateError;
              const pronScore = (row.pron as { score?: unknown } | null)?.score;
              attempt = {
                id: row.id,
                phase: row.phase === "second" ? "second" as const : "first" as const,
                transcript: row.transcript,
                pron: typeof pronScore === "number" ? { score: pronScore } : null,
                feedback: merged,
                createdAt: row.created_at,
              };
            } catch (cause) {
              if (cause instanceof QuotaExceededError) return Response.json({ error: cause.message }, { status: 429 });
              console.error("Retone failed", cause instanceof Error ? cause.name : "Unknown");
            }
          }
        }
      }
      return Response.json({ step, complete: false, attempt });
    }

    if (action === "translate") {
      if (current.lesson.warmup_question_vi) {
        return Response.json({ step, complete: false, translation: current.lesson.warmup_question_vi });
      }
      if (!isAiConfigured()) return Response.json({ error: "AI chưa được bật." }, { status: 503 });
      await assertQuota(db, user.id, "speaking");
      signal.throwIfAborted();
      const translation = await translateWarmupQuestion({ question: current.lesson.warmup_question, signal });
      signal.throwIfAborted();
      await recordUsage(db, user.id, "speaking");
      await rpc(admin, user.id, lessonId, step, "translate", { translation });
      return Response.json({ step, complete: false, translation });
    }

    // advance / answer / retry go through the RPC.
    const payload: Record<string, unknown> = {};
    if (action === "advance") {
      if (input.weakTerms) payload.weakTerms = input.weakTerms;
      if (input.threadId) payload.threadId = input.threadId;
    }

    if (action === "answer") {
      let transcript = input.transcript;
      let pron = null;
      if (input.audio) {
        if (!isSpeechServiceConfigured()) return Response.json({ error: "Dịch vụ chấm nói chưa sẵn sàng." }, { status: 503 });
        const duration = wavDuration(await input.audio.arrayBuffer());
        if (!duration || duration > 60) return Response.json({ error: "Cần WAV PCM 16 kHz mono, tối đa 60 giây." }, { status: 400 });
        if (!transcript) {
          // Groq first, self-hosted Whisper as fallback; empty only if both fail.
          await assertQuota(db, user.id, "speaking");
          await recordUsage(db, user.id, "speaking");
          transcript = (await transcribeRecording(input.audio, signal))?.trim().slice(0, 2000) || null;
        }
        if (!transcript) return Response.json({ error: "Chưa có bản chép. Nhập câu bạn đã nói rồi thử lại." }, { status: 422 });
        await assertQuota(db, user.id, "pronunciation");
        await recordUsage(db, user.id, "pronunciation");
        signal.throwIfAborted();
        pron = await assessPronunciation(input.audio, transcript);
      } else {
        if (!transcript) return Response.json({ error: "Nhập câu trả lời của bạn." }, { status: 400 });
      }
      if (!transcript) return Response.json({ error: "Chưa có bản chép." }, { status: 422 });

      // AI feedback for the answer (typed or voice).
      let feedback: LessonFeedback | null = null;
      if (isAiConfigured() && (step === 2 || (step === 7 && !current.progress?.second_attempt_id))) {
        const { data: cards, error } = await db.from("cards").select("term").eq("set_id", current.lesson.set_id);
        if (error) throw error;
        const terms = (cards ?? []).map((c) => c.term);
        const { data: profile, error: profileError } = await db.from("profiles").select("feedback_tone").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        const tone = (profile?.feedback_tone ?? "friendly") as FeedbackTone;
        const previous = step === 7 ? current.progress?.warmup_transcript ?? null : null;
        const previousAttempt = step === 7 ? current.progress?.first_attempt_id : null;
        let previousUsed: string[] = [];
        if (previousAttempt) {
          const { data: prev } = await db.from("speaking_attempts").select("feedback").eq("id", previousAttempt).maybeSingle();
          previousUsed = ((prev?.feedback as LessonFeedback | null)?.used ?? []);
        }
        await assertQuota(db, user.id, "speaking");
        signal.throwIfAborted();
        const raw = await generateLessonFeedback({
          question: current.lesson.warmup_question,
          cefr: current.lesson.course_parts.course_levels.cefr,
          tone,
          transcript,
          terms,
          previous,
          previousUsed,
          signal,
        } satisfies LessonAnswerInput);
        signal.throwIfAborted();
        await recordUsage(db, user.id, "speaking");
        // Second attempt: derive comparison fields.
        if (step === 7 && previous) {
          const usedSecond = raw.used.length ? raw.used : usedCourseTerms(transcript, terms);
          const usedFirst = previousUsed.length ? previousUsed : usedCourseTerms(previous, terms);
          const firstSet = new Set(usedFirst.map((t) => t.toLowerCase()));
          feedback = {
            ...raw,
            used: usedSecond,
            newTerms: usedSecond.filter((t) => !firstSet.has(t.toLowerCase())),
            delta: null, // filled by loader against stored first score
          };
        } else {
          feedback = { ...raw, used: raw.used.length ? raw.used : usedCourseTerms(transcript, terms) };
        }
      }
      payload.transcript = transcript;
      payload.pron = pron;
      payload.feedback = feedback;
      if (!pron) payload.typed = "true";
    }

    const saved = await rpc(admin, user.id, lessonId, step, action, payload);
    if (!saved) return Response.json({ error: "Chưa đủ điều kiện hoàn thành bước này hoặc tiến độ đã thay đổi." }, { status: 409 });
    return Response.json({
      step: saved.step as LessonStep,
      complete: saved.complete,
      attempt: saved.attempt,
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof RangeError) return Response.json({ error: "Bản ghi quá lớn." }, { status: 413 });
    if (signal.aborted) return Response.json({ error: "Xử lý quá lâu. Hãy thử lại." }, { status: 504 });
    console.error("Course lesson failed", error instanceof Error ? error.name : "DatabaseError");
    return Response.json({ error: "Chưa lưu được bài học. Hãy thử lại." }, { status: 502 });
  }
}
