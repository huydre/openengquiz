"use client";

/**
 * Plays natural pronunciation audio (Kokoro via /api/tts, cached in Storage). Falls back to the
 * browser's speechSynthesis when the service is unavailable or the user is signed out.
 */

export type TtsAccent = "en-US" | "en-GB";

const VOICE_BY_ACCENT: Record<TtsAccent, string> = { "en-US": "af_heart", "en-GB": "bf_emma" };
const urlCache = new Map<string, Promise<string | null>>();
let current: HTMLAudioElement | null = null;

function audioUrl(text: string, voice: string): Promise<string | null> {
  const key = `${voice}\n${text}`;
  let pending = urlCache.get(key);
  if (!pending) {
    pending = fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice }),
    })
      .then(async (response) => (response.ok ? ((await response.json()).url as string) : null))
      .catch(() => null);
    // Do not remember failures, so a later click can retry.
    pending.then((url) => { if (!url) urlCache.delete(key); });
    urlCache.set(key, pending);
  }
  return pending;
}

function speakWithBrowser(text: string, accent: TtsAccent) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  window.speechSynthesis.speak(utterance);
}

export async function playTts(text: string, options: { accent?: TtsAccent } = {}) {
  const accent = options.accent ?? "en-US";
  const trimmed = text.trim();
  if (!trimmed) return;

  current?.pause();
  const url = await audioUrl(trimmed, VOICE_BY_ACCENT[accent]);
  if (!url) {
    speakWithBrowser(trimmed, accent);
    return;
  }
  current = new Audio(url);
  try {
    await current.play();
  } catch {
    speakWithBrowser(trimmed, accent);
  }
}
