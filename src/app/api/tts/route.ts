import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { isSpeechServiceConfigured, synthesizeSpeech, TTS_VOICES } from "@/lib/speech/client";
import { ttsHashPreimage } from "@/lib/speech/tts-cache-key";

const BUCKET = "tts";
// Bump when the primary voice engine changes so older audio is regenerated.
const CACHE_PREFIX = "v2";
const requestSchema = z.object({
  text: z.string().trim().min(1).max(300),
  voice: z.enum(TTS_VOICES).default("af_heart"),
  speed: z.coerce.number().min(0.5).max(1.5).default(1),
});

type TtsRequest = z.infer<typeof requestSchema>;
type Resolved =
  | { kind: "cached"; url: string }
  | { kind: "fresh"; audio: ArrayBuffer; url: string }
  | { kind: "error"; response: Response };

/**
 * Finds or creates MP3 audio for a text. Audio is generated once (openai.fm voices, Kokoro as
 * fallback) and cached in Supabase Storage under a hash of voice + speed + text, so repeated
 * sentences cost nothing. Fallback audio is not cached, so the sentence gets the primary
 * voice once that engine is reachable again.
 * Fresh audio is returned immediately; the Storage upload and quota bookkeeping run after
 * the response so the learner does not wait for them.
 */
async function resolveAudio(input: TtsRequest): Promise<Resolved> {
  // Normalise whitespace so "the  cat" and "the cat" share one file.
  const text = input.text.replace(/\s+/g, " ");
  const { voice, speed } = input;

  const admin = createAdminClient();
  if (!admin || !isSpeechServiceConfigured()) {
    return { kind: "error", response: Response.json({ error: "Giọng đọc chưa sẵn sàng." }, { status: 503 }) };
  }

  const path = `${CACHE_PREFIX}/${voice}/${createHash("sha256").update(ttsHashPreimage(voice, text, speed)).digest("hex")}.mp3`;
  const storage = admin.storage.from(BUCKET);
  const url = storage.getPublicUrl(path).data.publicUrl;

  // Auth and the cache lookup are independent: run them together.
  const supabase = await createClient();
  const [{ data: { user } }, { data: existing }] = await Promise.all([
    supabase.auth.getUser(),
    storage.exists(path),
  ]);
  if (!user) {
    return { kind: "error", response: Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 }) };
  }
  if (existing) return { kind: "cached", url };

  try {
    await assertQuota(supabase, user.id, "tts");
    const { audio, engine } = await synthesizeSpeech(text, voice, speed);
    after(async () => {
      if (engine === "openai-fm") {
        const { error } = await storage.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
        if (error) console.error("TTS cache upload failed", error.message);
      }
      await recordUsage(supabase, user.id, "tts").catch(() => {});
    });
    return { kind: "fresh", audio, url };
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { kind: "error", response: Response.json({ error: error.message }, { status: 429 }) };
    }
    console.error("TTS failed", error instanceof Error ? error.message : error);
    return { kind: "error", response: Response.json({ error: "Chưa tạo được giọng đọc." }, { status: 502 }) };
  }
}

/**
 * Audio endpoint an <audio> element can point at directly:
 * GET /api/tts?text=...&voice=...&speed=... → 302 to the cached file, or the fresh MP3 bytes.
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = requestSchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });

  const result = await resolveAudio(parsed.data);
  if (result.kind === "error") return result.response;
  if (result.kind === "cached") {
    return new Response(null, { status: 302, headers: { location: result.url, "cache-control": "private, max-age=3600" } });
  }
  return new Response(result.audio, {
    headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=3600" },
  });
}
