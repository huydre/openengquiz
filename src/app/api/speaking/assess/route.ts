import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { cefrSchema, generateSpeakingFeedback, type SpeakingFeedback } from "@/lib/ai/speaking-feedback";
import { assessPronunciation, isSpeechServiceConfigured } from "@/lib/speech/client";
import { transcribeRecording } from "@/lib/speech/transcribe";
import { MAX_AUDIO_BYTES, wavDuration } from "@/lib/speech/speaking-wav";
import { parseMultipart, readBoundedBody } from "@/lib/http/multipart";
import { createClient } from "@/lib/supabase/server";

const maxBody = MAX_AUDIO_BYTES + 32_768;
const textSchema = z.string().trim().min(1).max(2000);
const fields = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("scripted"), text: textSchema, cardId: z.uuid().nullable() }),
  z.object({ mode: z.literal("speaking"), question: textSchema, transcript: textSchema.nullable(), cardId: z.uuid() }),
]);

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  if (signal.aborted) return new Response(null, { status: 408 });
  const timeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  try {
    return await Promise.race([assess(request, signal), timeout]);
  } catch (error) {
    if (signal.aborted) return Response.json({ error: "Chấm phát âm quá lâu. Hãy thử lại." }, { status: 504 });
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    if (error instanceof RangeError) return Response.json({ error: "Bản ghi vượt quá 5 MB." }, { status: 413 });
    console.error("Speech assessment failed", error instanceof Error ? error.name : "DatabaseError");
    return Response.json({ error: "Chưa chấm được phát âm. Hãy thử lại." }, { status: 502 });
  }
}

async function assess(request: Request, signal: AbortSignal) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập để luyện nói." }, { status: 401 });
  if (!isSpeechServiceConfigured()) return Response.json({ error: "Dịch vụ giọng nói chưa được bật." }, { status: 503 });
  signal.throwIfAborted();
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data(?:;|$)/i.test(contentType) || !request.body) {
    return Response.json({ error: "Yêu cầu cần có bản ghi WAV." }, { status: 400 });
  }
  const bytes = await readBoundedBody(request, maxBody, signal);
  if (!bytes) return Response.json({ error: "Yêu cầu cần có bản ghi WAV." }, { status: 400 });
  const form = await parseMultipart(bytes, contentType);
  const audio = form?.get("audio");
  const transcriptField = form?.get("transcript");
  const parsed = fields.safeParse({
    mode: form?.get("mode"), text: form?.get("text"), question: form?.get("question"),
    transcript: typeof transcriptField === "string" ? transcriptField.trim() || null : transcriptField ?? null,
    cardId: form?.get("cardId") || null,
  });
  if (!parsed.success || !(audio instanceof File)) {
    return Response.json({ error: "Câu luyện tập hoặc bản ghi không hợp lệ." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) throw new RangeError("Oversize WAV");
  const duration = wavDuration(await audio.arrayBuffer());
  if (!duration) return Response.json({ error: "Cần bản ghi WAV PCM 16 kHz mono." }, { status: 400 });
  if (duration > 60) return Response.json({ error: "Bản ghi tối đa 60 giây." }, { status: 413 });
  const wav = audio.slice(0, audio.size, "audio/wav");
  signal.throwIfAborted();

  const input = parsed.data;
  const usesAi = input.mode === "speaking" && isAiConfigured();
  const needsStt = input.mode === "speaking" && !input.transcript;
  const feature = usesAi || needsStt ? "speaking" : "pronunciation";
  await assertQuota(supabase, user.id, feature);
  signal.throwIfAborted();
  let term = "";
  if (input.cardId) {
    const { data, error } = await supabase.from("cards").select("term").eq("id", input.cardId)
      .abortSignal(signal).maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Không tìm thấy thẻ." }, { status: 404 });
    term = data.term;
  }
  let transcript = input.mode === "scripted" ? input.text : input.transcript;
  if (!transcript && needsStt) {
    transcript = await transcribeRecording(wav, signal);
  }
  if (!transcript) return Response.json({ error: "Chưa có bản chép. Nhập câu bạn đã nói rồi thử lại." }, { status: 422 });
  signal.throwIfAborted();
  const prompt = input.mode === "scripted" ? input.text : input.question;
  const pron = await assessPronunciation(wav, transcript);
  signal.throwIfAborted();
  await recordUsage(supabase, user.id, feature);
  signal.throwIfAborted();

  let feedback: SpeakingFeedback | null = null;
  if (usesAi) {
    const feedbackSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
    try {
      const { data: profile } = await supabase.from("profiles").select("level").eq("id", user.id)
        .abortSignal(feedbackSignal).maybeSingle();
      const level = cefrSchema.safeParse(profile?.level).data ?? "B1";
      feedback = await generateSpeakingFeedback({ term, level, question: prompt, transcript }, feedbackSignal);
    } catch (error) {
      console.error("Speaking feedback unavailable", error instanceof Error ? error.name : "UnknownError");
    }
  }
  signal.throwIfAborted();
  const { error } = await supabase.from("speaking_attempts").insert({
    user_id: user.id, card_id: input.cardId, mode: input.mode, prompt_text: prompt, transcript, pron, feedback,
  }).abortSignal(signal);
  if (error) console.error("Speaking history insert failed", error.code);
  return Response.json({ pron, transcript, feedback, saved: !error });
}
