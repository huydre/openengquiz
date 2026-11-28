"use client";

/**
 * Plays natural pronunciation audio. Short text (a word, a phrase or one sentence) streams straight
 * from Google Translate's speech endpoint, measured at about 0.3 s from Vietnam; longer text and any
 * Google failure go through GET /api/tts (Kokoro, cached in Storage; `fast` skips straight to Kokoro).
 * The browser's speechSynthesis is the last resort when neither source plays.
 * `playTts` fires and forgets; `playTtsTrack` returns a handle so callers (e.g. TutorNarration)
 * can await the outcome, pause, resume and stop.
 *
 * Speed is applied exactly once: Google audio plays at `speed` via playbackRate, Kokoro synthesizes
 * at `speed` so server audio plays at rate 1, and the speechSynthesis fallback sets `utterance.rate`.
 */

import { ttsCacheKey } from "./tts-cache-key";

export type TtsAccent = "en-US" | "en-GB";
export type TtsSpeed = 0.75 | 0.9 | 1;

/** How a track finished: natural end, explicit stop, or media failure. */
export type TtsOutcome = "ended" | "stopped" | "failed";

const VOICE_BY_ACCENT: Record<TtsAccent, string> = { "en-US": "af_heart", "en-GB": "bf_emma" };
const prefetched = new Set<string>();
// Google's endpoint takes at most 200 characters; multi-sentence text keeps the app's own voice.
const GOOGLE_MAX_CHARS = 200;
const warmGoogle = new Map<string, HTMLAudioElement>();

/** A word, a phrase or a single sentence: short enough for the fast Google voice. */
export function isShortTtsText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= GOOGLE_MAX_CHARS && !/[.!?]\s+\S/.test(trimmed);
}

/**
 * Google Translate's public speech endpoint (unofficial, no key). `en-GB` gives the British voice;
 * speed is applied on the client with playbackRate, which keeps the pitch.
 */
export function googleTtsUrl(text: string, accent: TtsAccent = "en-US"): string {
  const params = new URLSearchParams({ ie: "UTF-8", client: "tw-ob", tl: accent === "en-GB" ? "en-GB" : "en", q: text.trim() });
  return `https://translate.google.com/translate_tts?${params}`;
}
let current: TtsPlayback | null = null;

/**
 * Direct audio URL: the route answers with a redirect to the cached file or the fresh MP3,
 * so an <audio> element starts streaming without an extra JSON round trip.
 */
export function ttsUrl(text: string, accent: TtsAccent = "en-US", speed = 1, fast = false): string {
  const params = new URLSearchParams({ text: text.trim(), voice: VOICE_BY_ACCENT[accent], speed: String(speed) });
  if (fast) params.set("engine", "kokoro");
  return `/api/tts?${params}`;
}

/**
 * Warms the server cache and the browser HTTP cache for a line that will be played soon
 * (e.g. the tutor's next sentence), so its playback starts instantly.
 */
export function prefetchTts(text: string, options: { accent?: TtsAccent; speed?: number; fast?: boolean } = {}) {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (isShortTtsText(trimmed)) {
    const url = googleTtsUrl(trimmed, options.accent);
    if (!warmGoogle.has(url)) {
      // Keep a small pool of preloaded elements; the oldest is dropped first.
      if (warmGoogle.size >= 8) warmGoogle.delete(warmGoogle.keys().next().value!);
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
      warmGoogle.set(url, audio);
    }
    return;
  }
  const key = `${options.fast ? "fast\n" : ""}${ttsCacheKey(VOICE_BY_ACCENT[options.accent ?? "en-US"], trimmed, options.speed ?? 1)}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  void fetch(ttsUrl(trimmed, options.accent, options.speed, options.fast), { credentials: "same-origin" })
    .then((response) => { if (!response.ok) prefetched.delete(key); return response.arrayBuffer(); })
    .catch(() => prefetched.delete(key));
}

export type TtsState = "loading" | "playing" | "paused" | "idle";

export interface TtsPlayback {
  /** Resolves with the outcome when the utterance ends, is stopped, or fails. */
  done: Promise<TtsOutcome>;
  pause(): void;
  resume(): void;
  stop(): void;
}

function speakWithBrowser(text: string, accent: TtsAccent, speed: number): TtsPlayback {
  if (!("speechSynthesis" in window)) {
    return { done: Promise.resolve<TtsOutcome>("failed"), pause() {}, resume() {}, stop() {} };
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  utterance.rate = speed;
  let settle!: (outcome: TtsOutcome) => void;
  const done = new Promise<TtsOutcome>((resolve) => { settle = resolve; });
  utterance.onend = () => settle("ended");
  utterance.onerror = () => settle("failed");
  window.speechSynthesis.speak(utterance);
  return {
    done,
    pause() { window.speechSynthesis.pause(); },
    resume() { window.speechSynthesis.resume(); },
    stop() { window.speechSynthesis.cancel(); settle("stopped"); },
  };
}

function audioPlayback(audio: HTMLAudioElement): TtsPlayback {
  let settle!: (outcome: TtsOutcome) => void;
  const done = new Promise<TtsOutcome>((resolve) => { settle = resolve; });
  let outcome: TtsOutcome | null = null;
  const finish = (value: TtsOutcome) => {
    if (outcome === null) {
      outcome = value;
      settle(value);
    }
  };
  audio.addEventListener("ended", () => finish("ended"), { once: true });
  audio.addEventListener("error", () => finish("failed"), { once: true });
  return {
    done,
    pause() { audio.pause(); },
    resume() { void audio.play().catch(() => finish("failed")); },
    stop() {
      audio.pause();
      audio.removeAttribute("src");
      finish("stopped");
    },
  };
}

/**
 * Starts playback and returns a handle. Replaces any in-flight playback.
 * `onState` reports loading/playing/idle transitions for UI animation; "idle" fires only
 * for the most recent track so stale completions cannot reset the mascot.
 */
export function playTtsTrack(
  text: string,
  options: { accent?: TtsAccent; speed?: number; fast?: boolean; onState?: (state: TtsState) => void } = {},
): TtsPlayback {
  const accent = options.accent ?? "en-US";
  const speed = options.speed ?? 1;
  const trimmed = text.trim();
  const emit = options.onState;
  current?.stop();

  if (!trimmed) {
    emit?.("idle");
    return { done: Promise.resolve<TtsOutcome>("ended"), pause() {}, resume() {}, stop() {} };
  }

  emit?.("loading");
  let inner: TtsPlayback | null = null;
  let stopped = false;
  let settled = false;

  let settleDone!: (outcome: TtsOutcome) => void;
  const done = new Promise<TtsOutcome>((resolve) => { settleDone = resolve; });

  const settle = (outcome: TtsOutcome) => {
    if (settled) return;
    settled = true;
    if (current === playback) current = null;
    emit?.("idle");
    settleDone(outcome);
  };

  const playback: TtsPlayback = {
    done,
    pause() { inner?.pause(); },
    resume() { inner?.resume(); },
    stop() {
      if (settled) return;
      stopped = true;
      inner?.stop();
      // If the URL fetch is still pending, settle when it resolves; otherwise inner.done
      // already settles via the handler below.
      if (!inner) settle("stopped");
    },
  };

  // Sources in order: Google for short text, then the app's /api/tts, then the browser voice.
  const short = isShortTtsText(trimmed);
  const sources: { url: string; rate: number }[] = [
    ...(short ? [{ url: googleTtsUrl(trimmed, accent), rate: speed }] : []),
    { url: ttsUrl(trimmed, accent, speed, options.fast), rate: 1 },
  ];

  void (async () => {
    for (const source of sources) {
      if (stopped || settled) { settle("stopped"); return; }
      const warm = warmGoogle.get(source.url);
      if (warm) warmGoogle.delete(source.url);
      const audio = warm ?? new Audio(source.url);
      audio.playbackRate = source.rate;
      inner = audioPlayback(audio);
      try {
        await audio.play();
        emit?.("playing");
        const active = inner;
        void active.done.then((outcome) => settle(outcome));
        return;
      } catch {
        // Blocked, unreachable or undecodable: try the next source.
        inner.stop();
      }
    }
    if (stopped || settled) { settle("stopped"); return; }
    inner = speakWithBrowser(trimmed, accent, speed);
    emit?.("playing");
    const active = inner;
    void active.done.then((outcome) => settle(outcome));
  })();

  current = playback;
  return playback;
}

export async function playTts(text: string, options: { accent?: TtsAccent; speed?: number } = {}) {
  playTtsTrack(text, options);
}
