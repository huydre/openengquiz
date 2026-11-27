import { generateText, streamText } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { describe, expect, it, vi } from "vitest";

const inserted: Record<string, unknown>[] = [];
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => { throw new Error("outside a request"); } }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; } }),
  }),
}));

const { usageCounts, withTokenTracking } = await import("./token-usage");

const usage = {
  inputTokens: { total: 120, noCache: 20, cacheRead: 100, cacheWrite: undefined },
  outputTokens: { total: 30, text: 30, reasoning: undefined },
};

describe("usageCounts", () => {
  it("reads nested totals and treats missing values as zero", () => {
    expect(usageCounts(usage)).toEqual({ input: 120, cachedInput: 100, output: 30 });
    expect(usageCounts(undefined)).toEqual({ input: 0, cachedInput: 0, output: 0 });
  });
});

describe("withTokenTracking", () => {
  it("records usage of generate calls under the feature and model", async () => {
    inserted.length = 0;
    const model = new MockLanguageModelV4({
      doGenerate: { content: [{ type: "text", text: "hi" }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
    });
    await generateText({ model: withTokenTracking(model, "grammar", "deepseek/test"), prompt: "x" });
    await vi.waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toEqual({ feature: "grammar", model: "deepseek/test", input_tokens: 120, cached_input_tokens: 100, output_tokens: 30 });
  });

  it("records usage of streamed calls when the stream finishes", async () => {
    inserted.length = 0;
    const model = new MockLanguageModelV4({
      doStream: {
        stream: convertArrayToReadableStream([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "hello" },
          { type: "text-end", id: "1" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
        ]),
      },
    });
    const result = streamText({ model: withTokenTracking(model, "call-reply", "groq/test"), prompt: "x" });
    await result.consumeStream();
    await vi.waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toMatchObject({ feature: "call-reply", model: "groq/test", output_tokens: 30 });
  });
});
