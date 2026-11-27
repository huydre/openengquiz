/**
 * Daily per-user limits. LLM features (DeepSeek) are generous and only stop abuse;
 * speech features are tighter because the Azure Speech free tier caps audio hours.
 */
export const AI_DAILY_LIMITS = {
  "generate-cards": 50,
  "seed-courses": 1500,
  "seed-paths": 1500,
  lookup: 300,
  grammar: 100,
  reading: 30,
  conversation: 50,
  speaking: 30,
  // Self-hosted Pronunciada (~0.6 s CPU per check); a vocabulary lesson reads each word and its example.
  pronunciation: 300,
  // Kokoro TTS on our VPS; only cache misses count, cached audio is free.
  tts: 500,
  // Tutor narration lines per lesson; cached in lesson_narration so only misses count.
  narration: 60,
} as const;

export type AiFeature = keyof typeof AI_DAILY_LIMITS;

/** Quota days reset at local midnight in Vietnam (UTC+7, no DST). */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Returns the UTC instant of the most recent local (Asia/Ho_Chi_Minh) midnight at or before `now`. */
export function startOfLocalDayUtc(now: Date): Date {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - VN_OFFSET_MS);
}
