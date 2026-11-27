import "server-only";
import { z } from "zod";

const transcriptSchema = z.object({ text: z.string().trim().min(1).max(2000) });

/**
 * Transcribes a WAV recording with Groq Whisper. Returns null when Groq is not
 * configured or the request fails, so callers can fall back to typed input.
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
