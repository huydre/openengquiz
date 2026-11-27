"use client";

/**
 * Plays natural pronunciation audio (Kokoro via /api/tts, cached in Storage). Falls back to the
 * browser's speechSynthesis when the service is unavailable or the user is signed out.
 * `playTts` fires and forgets; `playTtsTrack` returns a handle so callers (e.g. TutorNarration)
 * can await the outcome, pause, resume and stop.
 *
 * Speed is applied exactly once: Kokoro synthesizes at `speed`, so server audio plays at
 * rate 1. The browser speechSynthesis fallback sets `utterance.rate` instead.
 */

import { ttsCacheKey } from "./tts-cache-key";

export type TtsAccent = "en-US" | "en-GB";
export type TtsSpeed = 0.75 | 0.9 | 1;

/** How a track finished: natural end, explicit stop, or media failure. */
export type TtsOutcome = "ended" | "stopped" | "failed";

const VOICE_BY_ACCENT: Record<TtsAccent, string> = { "en-US": "af_heart", "en-GB": "bf_emma" };
const urlCache = new Map<string, Promise<string | null>>();
let current: TtsPlayback | null = null;

function audioUrl(text: string, voice: string, speed: number): Promise<string | null> {
  const key = ttsCacheKey(voice, text, speed);
  let pending = urlCache.get(key);
  if (!pending) {
    pending = fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, voice, speed }),
    })
      .then(async (response) => (response.ok ? ((await response.json()).url as string) : null))
      .catch(() => null);
    // Do not remember failures, so a later click can retry.
    pending.then((url) => { if (!url) urlCache.delete(key); });
    urlCache.set(key, pending);
  }
  return pending;
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
  options: { accent?: TtsAccent; speed?: number; onState?: (state: TtsState) => void } = {},
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

  void audioUrl(trimmed, VOICE_BY_ACCENT[accent], speed).then(async (url) => {
    if (stopped || settled) { settle("stopped"); return; }
    if (url) {
      const audio = new Audio(url);
      inner = audioPlayback(audio);
      try {
        await audio.play();
        emit?.("playing");
      } catch {
        // Autoplay blocked or decode failure: fall back to the browser voice once.
        inner.stop();
        if (stopped || settled) { settle("stopped"); return; }
        inner = speakWithBrowser(trimmed, accent, speed);
        emit?.("playing");
      }
    } else {
      inner = speakWithBrowser(trimmed, accent, speed);
      emit?.("playing");
    }
    const active = inner;
    void active.done.then((outcome) => settle(outcome));
  });

  current = playback;
  return playback;
}

export async function playTts(text: string, options: { accent?: TtsAccent; speed?: number } = {}) {
  playTtsTrack(text, options);
}
