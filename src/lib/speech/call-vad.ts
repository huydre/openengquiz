/**
 * Pure voice-activity detection for the hands-free call mic.
 *
 * Fed with per-frame peak amplitudes (0..1) and wall-clock timestamps, it tracks
 * whether the learner is speaking and when to auto-stop the recording:
 * - speech detected, then ~1.2 s of quiet → "silence" (send what was captured)
 * - no speech at all for ~8 s → "no-speech" (caller shows "tap to speak")
 *
 * The leading-clip guard lives here too: `heardSpeech` only flips after real voice
 * energy, so the caller can drop everything captured before the first voiced frame.
 */

export interface CallVadOptions {
  /** Peak amplitude at or above which a frame counts as voice. Default 0.02. */
  threshold?: number;
  /** Quiet time after voice that ends the utterance. Default 1200 ms. */
  silenceMs?: number;
  /** Time with no voice at all before giving up. Default 8000 ms. */
  noSpeechMs?: number;
}

export type CallVadEvent = "speech" | "silence" | "no-speech";

export interface CallVad {
  /** Feed one captured frame. Returns the event to act on, or null. */
  push(peak: number, nowMs: number): CallVadEvent | null;
  /** Whether any voiced frame has been seen since the last reset. */
  readonly heardSpeech: boolean;
  /** Reset for a new utterance (keeps configuration). */
  reset(): void;
}

export const CALL_VAD_DEFAULTS = {
  threshold: 0.02,
  silenceMs: 1_200,
  noSpeechMs: 8_000,
} as const;

export function createCallVad(options: CallVadOptions = {}): CallVad {
  const threshold = options.threshold ?? CALL_VAD_DEFAULTS.threshold;
  const silenceMs = options.silenceMs ?? CALL_VAD_DEFAULTS.silenceMs;
  const noSpeechMs = options.noSpeechMs ?? CALL_VAD_DEFAULTS.noSpeechMs;

  let heard = false;
  let windowStart = -1;
  let lastVoiceAt = 0;
  let ended = false;

  return {
    get heardSpeech() {
      return heard;
    },
    push(peak, nowMs) {
      if (ended) return null;
      if (windowStart < 0) windowStart = nowMs;
      if (peak >= threshold) {
        heard = true;
        lastVoiceAt = nowMs;
        return "speech";
      }
      if (!heard) {
        if (nowMs - windowStart >= noSpeechMs) {
          ended = true;
          return "no-speech";
        }
        return null;
      }
      if (nowMs - lastVoiceAt >= silenceMs) {
        ended = true;
        return "silence";
      }
      return null;
    },
    reset() {
      heard = false;
      windowStart = -1;
      lastVoiceAt = 0;
      ended = false;
    },
  };
}
