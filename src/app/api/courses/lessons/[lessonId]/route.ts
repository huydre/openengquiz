import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { getCourseLesson } from "@/lib/courses/course-data";
import { compareCourseSpeech } from "@/lib/courses/course-feedback";
import { usedCourseTerms } from "@/lib/courses/course-progress";
import { parseMultipart, readBoundedBody } from "@/lib/http/multipart";
import { assessPronunciation, isSpeechServiceConfigured } from "@/lib/speech/client";
import { MAX_AUDIO_BYTES, wavDuration } from "@/lib/speech/speaking-wav";
import { transcribeGroq } from "@/lib/speech/transcribe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    if (!current.open || current.progress?.completed_at) return Response.json({ error: "Bài học không khả dụng." }, { status: 409 });
    const step = current.progress?.step ?? 1;
    const type = request.headers.get("content-type") ?? "";
    let transcript: string | null = null;
    let pron = null;
    let feedback = null;
    if (step === 1 || step === 3) {
      if (!/^multipart\/form-data(?:;|$)/i.test(type)) return Response.json({ error: "Cần bản ghi WAV." }, { status: 400 });
      if (!isSpeechServiceConfigured() || (step === 3 && !isAiConfigured())) return Response.json({ error: "Dịch vụ chấm nói chưa sẵn sàng." }, { status: 503 });
      const raw = await readBoundedBody(request, MAX_AUDIO_BYTES + 32768, signal);
      const form = raw ? await parseMultipart(raw, type) : null;
      const audio = form?.get("audio");
      if (Number(form?.get("step")) !== step || !(audio instanceof File) || audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "Bản ghi hoặc bước không hợp lệ." }, { status: 400 });
      const duration = wavDuration(await audio.arrayBuffer());
      if (!duration || duration > 60) return Response.json({ error: "Cần WAV PCM 16 kHz mono, tối đa 60 giây." }, { status: 400 });
      const submitted = z.string().trim().max(2000).safeParse(form?.get("transcript") ?? "");
      if (!submitted.success) return Response.json({ error: "Bản chép không hợp lệ." }, { status: 400 });
      const transcribe = !submitted.data && Boolean(process.env.GROQ_API_KEY);
      if (transcribe) {
        await assertQuota(db, user.id, "speaking");
        await recordUsage(db, user.id, "speaking");
      }
      transcript = submitted.data || (transcribe ? (await transcribeGroq(audio, signal))?.trim().slice(0, 2000) : null) || null;
      if (!transcript) return Response.json({ error: "Chưa có bản chép. Nhập câu bạn đã nói rồi thử lại." }, { status: 422 });
      await assertQuota(db, user.id, "pronunciation");
      await recordUsage(db, user.id, "pronunciation");
      signal.throwIfAborted();
      pron = await assessPronunciation(audio, transcript);
      if (step === 3) {
        const { data: cards, error } = await db.from("cards").select("term").eq("set_id", current.lesson.set_id);
        if (error) throw error;
        const used = usedCourseTerms(transcript, cards.map(({ term }) => term));
        await assertQuota(db, user.id, "speaking");
        await recordUsage(db, user.id, "speaking");
        const comparison = await compareCourseSpeech({ question: current.lesson.warmup_question, first: current.progress.warmup_transcript,
          second: transcript, cefr: current.lesson.course_parts.course_levels.cefr, used }, signal);
        feedback = { ...comparison, used, total: cards.length };
      }
    } else {
      const body = z.object({ step: z.union([z.literal(2), z.literal(4)]) }).safeParse(await request.json().catch(() => null));
      if (!body.success || body.data.step !== step) return Response.json({ error: "Bước học đã thay đổi. Tải lại trang." }, { status: 409 });
    }
    signal.throwIfAborted();
    const { data, error } = await admin.rpc("advance_course_lesson", { p_user: user.id, p_lesson: lessonId, p_step: step,
      p_transcript: transcript, p_pron: pron, p_feedback: feedback }).abortSignal(signal);
    if (error) throw error;
    if (!data) return Response.json({ error: "Chưa đủ điều kiện hoàn thành bước này hoặc tiến độ đã thay đổi." }, { status: 409 });
    return Response.json({ step: Math.min(step + 1, 4), complete: step === 4, score: pron?.score });
  } catch (error) {
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof RangeError) return Response.json({ error: "Bản ghi quá lớn." }, { status: 413 });
    if (signal.aborted) return Response.json({ error: "Xử lý quá lâu. Hãy thử lại." }, { status: 504 });
    console.error("Course lesson failed", error instanceof Error ? error.name : "DatabaseError");
    return Response.json({ error: "Chưa lưu được bài học. Hãy thử lại." }, { status: 502 });
  }
}
