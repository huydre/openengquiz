import "server-only";
import { after } from "next/server";
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";

/** Which part of the app made an LLM call; used to group token usage. */
export type AiCallFeature =
  | "generate-cards" | "lookup" | "lookup-enrich" | "grammar" | "reading" | "narration"
  | "speaking-question" | "speaking-feedback"
  | "course-question" | "course-feedback" | "course-ideas" | "course-translate" | "course-retone"
  | "call-reply" | "call-terms" | "call-greeting" | "call-assist" | "call-summary";

type UsageCounts = { input: number; cachedInput: number; output: number };

/** Reads token counts from an AI SDK usage object (nested totals; missing values count as 0). */
export function usageCounts(usage: {
  inputTokens?: { total?: number; cacheRead?: number };
  outputTokens?: { total?: number };
} | undefined): UsageCounts {
  return {
    input: usage?.inputTokens?.total ?? 0,
    cachedInput: usage?.inputTokens?.cacheRead ?? 0,
    output: usage?.outputTokens?.total ?? 0,
  };
}

function record(feature: AiCallFeature, model: string, counts: UsageCounts) {
  if (!counts.input && !counts.output) return;
  const admin = createAdminClient();
  if (!admin) return;
  const write = Promise.resolve(admin.from("ai_token_usage").insert({
    feature,
    model,
    input_tokens: counts.input,
    cached_input_tokens: counts.cachedInput,
    output_tokens: counts.output,
  })).then(({ error }) => {
    if (error) console.warn("Token usage not recorded:", error.message);
  });
  // Write after the response is sent; outside a request (tests, scripts) just let it run.
  try {
    after(() => write);
  } catch {
    void write;
  }
}

/** Wraps a model so every call (generate or stream) records its token usage for `feature`. */
export function withTokenTracking(model: Exclude<LanguageModel, string>, feature: AiCallFeature, modelId: string) {
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      record(feature, modelId, usageCounts(result.usage));
      return result;
    },
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();
      const tracked = stream.pipeThrough(new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === "finish") record(feature, modelId, usageCounts(chunk.usage));
          controller.enqueue(chunk);
        },
      }));
      return { stream: tracked, ...rest };
    },
  };
  return wrapLanguageModel({ model, middleware });
}
