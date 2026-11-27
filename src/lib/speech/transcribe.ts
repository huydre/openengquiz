import "server-only";
import { z } from "zod";
import { transcribeSpeech } from "./client";

const transcriptSchema = z.object({ text: z.string().trim().min(1).max(2000) });

/**
 * Transcribes a WAV recording with Groq Whisper. Returns null when Groq is not configured,
 * over its free limit (429) or failing, so callers can fall back (see transcribeRecording).
 */
export async function transcribeGroq(wav: Blob, signal: AbortSignal): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const body = new FormData();
    body.set("file", wav, "recording.wav");
    body.set("model", "whisper-large-v3-turbo");
    body.set("language", "en");
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal,
    });
    if (!response.ok) return null;
    const data = transcriptSchema.safeParse(await response.json());
    return data.success ? data.data.text : null;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}

/**
 * Speech to text for free answers: Groq Whisper first (fast, accurate); when Groq is not
 * configured, rate-limited or failing, fall back to Whisper on our own speech service.
 */
export async function transcribeRecording(wav: Blob, signal: AbortSignal): Promise<string | null> {
  const fromGroq = await transcribeGroq(wav, signal);
  if (fromGroq) return fromGroq;
  signal.throwIfAborted();
  return transcribeSpeech(wav);
}
