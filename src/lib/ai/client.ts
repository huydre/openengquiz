import "server-only";
import { createDeepSeek } from "@ai-sdk/deepseek";

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
