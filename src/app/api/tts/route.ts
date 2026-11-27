import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { isSpeechServiceConfigured, synthesizeSpeech, TTS_VOICES } from "@/lib/speech/client";
import { ttsHashPreimage } from "@/lib/speech/tts-cache-key";

const BUCKET = "tts";
const requestSchema = z.object({
  text: z.string().trim().min(1).max(300),
  voice: z.enum(TTS_VOICES).default("af_heart"),
  speed: z.number().min(0.5).max(1.5).default(1),
});

/**
 * Returns a public URL to MP3 audio for `text`. Audio is generated once with Kokoro and cached in
 * Supabase Storage under a hash of voice + text, so repeated words cost nothing.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  // Normalise whitespace so "the  cat" and "the cat" share one file.
  const text = parsed.data.text.replace(/\s+/g, " ");
  const { voice, speed } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin || !isSpeechServiceConfigured()) {
    return Response.json({ error: "Giọng đọc chưa sẵn sàng." }, { status: 503 });
  }

  const path = `${voice}/${createHash("sha256").update(ttsHashPreimage(voice, text, speed)).digest("hex")}.mp3`;
  const storage = admin.storage.from(BUCKET);
  const { data: publicUrl } = storage.getPublicUrl(path);

  const { data: existing } = await storage.exists(path);
  if (existing) return Response.json({ url: publicUrl.publicUrl });

  try {
    await assertQuota(supabase, user.id, "tts");
    const audio = await synthesizeSpeech(text, voice, speed);
    const { error } = await storage.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    await recordUsage(supabase, user.id, "tts");
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    console.error("TTS failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Chưa tạo được giọng đọc." }, { status: 502 });
  }

  return Response.json({ url: publicUrl.publicUrl });
}
