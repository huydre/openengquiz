import { createClient } from "@/lib/supabase/server";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { MAX_AUDIO_BYTES, wavDuration } from "@/lib/speech/speaking-wav";
import { transcribeRecording } from "@/lib/speech/transcribe";

/**
 * Speech to text for a learner's recording so the answer box can be prefilled and edited
 * before submitting. Groq first, self-hosted Whisper as fallback.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Bản ghi không hợp lệ." }, { status: 400 });
  }
  const duration = wavDuration(await audio.arrayBuffer());
  if (!duration || duration > 60) {
    return Response.json({ error: "Cần bản ghi WAV tối đa 60 giây." }, { status: 400 });
  }

  try {
    await assertQuota(supabase, user.id, "speaking");
    const signal = AbortSignal.timeout(30_000);
    const text = await transcribeRecording(audio.slice(0, audio.size, "audio/wav"), signal);
    if (!text) return Response.json({ error: "Chưa nghe rõ. Bạn thử nói lại hoặc gõ câu trả lời nhé." }, { status: 422 });
    await recordUsage(supabase, user.id, "speaking");
    return Response.json({ text: text.slice(0, 2000) });
  } catch (error) {
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    console.error("Transcription failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Chưa chép được lời. Hãy thử lại." }, { status: 502 });
  }
}
