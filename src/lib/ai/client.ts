import "server-only";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/** True when the LLM env vars are set; features that only add extras can skip the AI step otherwise. */
export function isAiConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY && process.env.AI_MODEL);
}

/**
 * Returns the configured LLM. Server-only: the API key must never reach the browser.
 * Model id comes from AI_MODEL so it can change without code edits.
 */
export function getModel() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const modelId = process.env.AI_MODEL;
  if (!apiKey || !modelId) {
    throw new Error("DEEPSEEK_API_KEY and AI_MODEL must be set in the server environment.");
  }
  return createDeepSeek({ apiKey })(modelId);
}

/**
 * Low-latency models for interactive feedback on Groq (about 1.5 s per request), or null when
 * Groq is not configured. Each slot uses its own model because Groq's free tier limits tokens
 * per minute per model; splitting parallel requests keeps them under the limit.
 */
// Scoring needs the stronger model to stay calibrated; the model answer is a simpler writing task.
const FAST_MODELS = { score: "openai/gpt-oss-120b", answer: "openai/gpt-oss-20b" } as const;
export type FastSlot = keyof typeof FAST_MODELS;

export function getFastModel(slot: FastSlot = "score") {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const override = slot === "score" ? process.env.FEEDBACK_MODEL : process.env.FEEDBACK_ANSWER_MODEL;
  return createGroq({ apiKey })(override || FAST_MODELS[slot]);
}

/** Provider options for the fast models: keep reasoning short so answers come back quickly. */
export const FAST_PROVIDER_OPTIONS = { groq: { reasoningEffort: "low" } } as const;

/** Runs `task` on the fast model first and retries once on the main model if it fails (rate limit, outage). */
export async function withFastModel<T>(task: (model: LanguageModel) => Promise<T>, signal?: AbortSignal, slot: FastSlot = "score"): Promise<T> {
  const fast = getFastModel(slot);
  if (fast) {
    try {
      return await task(fast);
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn("Fast model failed, using main model:", error instanceof Error ? error.message.slice(0, 120) : "unknown error");
    }
  }
  return task(getModel());
}
