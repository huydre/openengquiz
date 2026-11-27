"use client";

/**
 * Streams an AI reply into sequential TTS playback for the voice call.
 *
 * `push(delta)` receives raw text deltas (NDJSON stream chunks). Complete
 * sentences are cut as soon as their terminator arrives, prefetched while the
 * previous sentence plays, and played in order, so the learner hears the first
 * sentence ~1 s after it finishes generating instead of waiting for the whole
 * reply. `finish()` flushes any trailing fragment and resolves once playback
 * drains; `stop()` clears the queue and resolves immediately.
 *
 * Sentences longer than the TTS route limit (300 chars) are split on clause
 * boundaries so no chunk is rejected.
 */

import { playTtsTrack, prefetchTts, type TtsAccent, type TtsPlayback, type TtsSpeed } from "./play-tts";

/** Server limit for /api/tts `text` (see src/app/api/tts/route.ts). */
export const TTS_MAX_CHARS = 300;

export interface CallReplyAudioOptions {
  onSpeaking: (speaking: boolean) => void;
  /** Called when the final utterance fails to play (e.g. TTS outage). */
  onError?: () => void;
  accent?: TtsAccent;
  speed?: TtsSpeed;
  /** Test seams; production uses playTtsTrack/prefetchTts. `onPlaying` fires
   *  when audio actually starts (playTtsTrack onState "playing"). */
  play?: (text: string, onPlaying: () => void) => TtsPlayback;
  prefetch?: (text: string) => void;
}

export interface CallReplyAudio {
  push: (delta: string) => void;
  finish: () => Promise<void>;
  stop: () => void;
}

interface SentenceQueue {
  pending: string[];
  playing: TtsPlayback | null;
  done: boolean;
  stopped: boolean;
  drainWaiters: Array<() => void>;
}

/** Sentence-ending punctuation, including CJK and ellipsis styles. */
const SENTENCE_END = /[!?…。！？]+["'\u201d\u2019)\]]*\s*|\.+["'\u201d\u2019)\]]*(?:\s+|$)/;
/** Preferred split points inside an over-long chunk. */
const CLAUSE_BREAK = /[,;:，；：\u2014\u2013-]\s*/g;

/**
 * Cuts `text` into speakable chunks. Complete sentences are emitted as soon as
 * their terminator arrives; the remainder stays buffered for the next delta.
 * Chunks over TTS_MAX_CHARS are split on clause boundaries, then hard-split.
 */
export function splitCallReplyText(buffered: string, final = false): { chunks: string[]; rest: string } {
  const chunks: string[] = [];
  let rest = buffered;

  for (;;) {
    const match = SENTENCE_END.exec(rest);
    if (!match) break;
    if (!final && match[0] === "." && /\d$/.test(rest.slice(0, match.index))) break;
    const end = match.index + match[0].length;
    const sentence = rest.slice(0, end).trim();
    rest = rest.slice(end);
    if (sentence) chunks.push(...splitLong(sentence));
  }

  if (final && rest.trim()) {
    chunks.push(...splitLong(rest.trim()));
    rest = "";
  }
  return { chunks, rest };
}

function splitLong(text: string): string[] {
  if (text.length <= TTS_MAX_CHARS) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > TTS_MAX_CHARS) {
    // Prefer the last clause break inside the limit window.
    const window = remaining.slice(0, TTS_MAX_CHARS);
    let cut = -1;
    for (const match of window.matchAll(CLAUSE_BREAK)) {
      cut = (match.index ?? 0) + match[0].length;
    }
    if (cut <= 0) cut = TTS_MAX_CHARS;
    const piece = remaining.slice(0, cut).trim();
    if (piece) parts.push(piece);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

export function createCallReplyAudio({
  onSpeaking,
  onError,
  accent = "en-US",
  speed = 1,
  play = (text, onPlaying) =>
    // Live replies use the low-latency engine; cached lesson audio keeps the primary voice.
    playTtsTrack(text, {
      accent,
      speed,
      fast: true,
      onState: (state) => {
        if (state === "playing") onPlaying();
      },
    }),
  prefetch = (text) => prefetchTts(text, { accent, speed, fast: true }),
}: CallReplyAudioOptions): CallReplyAudio {
  const queue: SentenceQueue = {
    pending: [],
    playing: null,
    done: false,
    stopped: false,
    drainWaiters: [],
  };
  const prefetched = new Set<string>();
  let buffer = "";

  /** Warm the head of the queue if it is not already playing or prefetched. */
  const warmNext = () => {
    const next = queue.pending[0];
    if (next && !prefetched.has(next)) {
      prefetched.add(next);
      prefetch(next);
    }
  };

  const notifyDrain = () => {
    if (queue.pending.length === 0 && !queue.playing) {
      onSpeaking(false);
      const waiters = queue.drainWaiters.splice(0);
      for (const resolve of waiters) resolve();
    }
  };

  const pump = () => {
    if (queue.stopped) return;
    if (queue.playing || queue.pending.length === 0) {
      if (queue.done) notifyDrain();
      return;
    }
    const text = queue.pending.shift()!;
    prefetched.delete(text);
    // Warm the next sentence while this one plays.
    warmNext();
    let playback: TtsPlayback;
    try {
      playback = play(text, () => {
        // Guard: a stop() while the URL fetch was pending must not resurrect
        // the speaking indicator.
        if (!queue.stopped && queue.playing === playback) onSpeaking(true);
      });
    } catch {
      onError?.();
      pump();
      return;
    }
    queue.playing = playback;
    void playback.done.then((outcome) => {
      // A stop() during pending playback must not resurrect the speaking state.
      if (queue.stopped) return;
      queue.playing = null;
      if (outcome === "failed") onError?.();
      pump();
    });
  };

  const enqueue = (chunks: string[]) => {
    if (queue.stopped) return;
    queue.pending.push(...chunks.filter(Boolean));
    // While a sentence plays, prefetch whatever is waiting so playback never
    // waits on TTS generation.
    if (queue.playing) warmNext();
    pump();
  };

  return {
    push(delta) {
      if (queue.stopped || queue.done) return;
      buffer += delta;
      const { chunks, rest } = splitCallReplyText(buffer);
      buffer = rest;
      enqueue(chunks);
    },
    finish() {
      if (queue.done) return Promise.resolve();
      queue.done = true;
      const { chunks } = splitCallReplyText(buffer, true);
      buffer = "";
      enqueue(chunks);
      if (queue.pending.length === 0 && !queue.playing) {
        notifyDrain();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => queue.drainWaiters.push(resolve));
    },
    stop() {
      if (queue.stopped) return;
      queue.stopped = true;
      queue.pending = [];
      queue.playing?.stop();
      queue.playing = null;
      onSpeaking(false);
      const waiters = queue.drainWaiters.splice(0);
      for (const resolve of waiters) resolve();
    },
  };
}
