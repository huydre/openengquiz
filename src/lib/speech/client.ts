import "server-only";
import { z } from "zod";

/**
 * Client for the self-hosted speech service (services/speech): pronunciation scoring with
 * Pronunciada, TTS (openai.fm voices with Kokoro fallback) and speech to text. Server-only: the service token must never reach the browser.
 */

const TIMEOUT_MS = 30_000;

export const TTS_VOICES = ["af_heart", "am_michael", "bf_emma", "bm_george"] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

const phoneSchema = z.object({ ipa: z.string(), score: z.number(), heard: z.string().nullable() });
const wordSchema = z.object({
  text: z.string(),
  score: z.number(),
  omitted: z.boolean(),
  start: z.number().nullable(),
  end: z.number().nullable(),
  phones: z.array(phoneSchema),
});
const issueSchema = z.object({
  kind: z.string().nullable(),
  word: z.string().nullable(),
  word_index: z.number().nullable(),
  expected: z.string().nullable(),
  heard: z.string().nullable(),
  error_prob: z.number().nullable(),
  features: z.array(z.object({
    feature: z.string().nullable(),
    expected: z.string().nullable(),
    heard: z.string().nullable(),
  })),
});

/** Scores are 0..1. `issues` lists detected mistakes (word level and phone level). */
export const pronunciationResultSchema = z.object({
  text: z.string(),
  score: z.number(),
  accuracy: z.number().nullable(),
  fluency: z.number().nullable(),
  completeness: z.number().nullable(),
  words: z.array(wordSchema),
  issues: z.array(issueSchema),
  warnings: z.array(z.string()),
});
export type PronunciationResult = z.infer<typeof pronunciationResultSchema>;

export class SpeechServiceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function config() {
  const url = process.env.SPEECH_SERVICE_URL;
  const token = process.env.SPEECH_SERVICE_TOKEN;
  if (!url || !token) throw new SpeechServiceError("Speech service is not configured");
  return { url: url.replace(/\/$/, ""), token };
}

export function isSpeechServiceConfigured() {
  return Boolean(process.env.SPEECH_SERVICE_URL && process.env.SPEECH_SERVICE_TOKEN);
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const { url, token } = config();
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new SpeechServiceError(`Speech service unreachable: ${(error as Error).name}`);
  }
  if (!response.ok) {
    throw new SpeechServiceError(`Speech service ${path} failed`, response.status);
  }
  return response;
}

/**
 * Scores a recording against the text the learner meant to say. Accepts any browser
 * recording format (webm/ogg/mp4/wav, at most 60 s); the service converts it.
 */
export async function assessPronunciation(
  audio: Blob,
  text: string,
  strictness = 0.5,
): Promise<PronunciationResult> {
  const form = new FormData();
  form.append("audio", audio, "recording");
  form.append("text", text);
  form.append("strictness", String(strictness));
  const response = await call("/assess", { method: "POST", body: form });
  return pronunciationResultSchema.parse(await response.json());
}

/** Which engine produced the audio: GPT-4o mini TTS via openai.fm (primary) or Kokoro (fallback). */
export type TtsEngine = "openai-fm" | "kokoro";

/** Synthesizes speech as MP3 bytes. */
export async function synthesizeSpeech(
  text: string,
  voice: TtsVoice = "af_heart",
  speed = 1,
): Promise<{ audio: ArrayBuffer; engine: TtsEngine }> {
  const response = await call("/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voice, speed }),
  });
  const engine: TtsEngine = response.headers.get("x-tts-engine") === "openai-fm" ? "openai-fm" : "kokoro";
  return { audio: await response.arrayBuffer(), engine };
}

/** English speech to text on the self-hosted service (faster-whisper). Null when unavailable. */
export async function transcribeSpeech(audio: Blob): Promise<string | null> {
  if (!isSpeechServiceConfigured()) return null;
  const form = new FormData();
  form.append("audio", audio, "recording.wav");
  try {
    const response = await call("/transcribe", { method: "POST", body: form });
    const parsed = z.object({ text: z.string() }).safeParse(await response.json());
    const text = parsed.success ? parsed.data.text.trim() : "";
    return text || null;
  } catch {
    return null;
  }
}
