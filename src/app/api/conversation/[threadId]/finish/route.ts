import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { callScenarioSchema, generateCallSummary, MAX_CALL_TURNS, type CallMessage, type CallTargetTerm } from "@/lib/ai/conversation";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { cefrSchema } from "@/lib/ai/speaking-feedback";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends an AI call: generates the vocabulary/usage summary and stores it on the
 * thread via finish_ai_call (which locks the row and rejects stale turn counts).
 */
export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
  if (signal.aborted) return new Response(null, { status: 408 });
  try {
    const { threadId } = await context.params;
    if (!z.uuid().safeParse(threadId).success) return Response.json({ error: "Cuộc gọi không hợp lệ." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Bạn cần đăng nhập để luyện hội thoại." }, { status: 401 });
    if (!isAiConfigured()) return Response.json({ error: "AI chưa được bật. Hãy thử lại sau." }, { status: 503 });

    const { data: thread, error: threadError } = await supabase.from("chat_threads")
      .select("id, set_id, scenario, summary").eq("id", threadId).abortSignal(signal).maybeSingle();
    if (threadError) throw threadError;
    if (!thread) return Response.json({ error: "Không tìm thấy cuộc gọi." }, { status: 404 });
    if (thread.summary) return Response.json({ summary: thread.summary });

    const scenario = callScenarioSchema.safeParse(thread.scenario);
    if (!scenario.success) return Response.json({ error: "Kịch bản không hợp lệ." }, { status: 400 });

    const [cards, profile, messages] = await Promise.all([
      supabase.from("cards").select("term, definition_vi").eq("set_id", thread.set_id)
        .order("position").order("created_at").order("id").limit(60).abortSignal(signal),
      supabase.from("profiles").select("level").eq("id", user.id).abortSignal(signal).maybeSingle(),
      supabase.from("chat_messages").select("role, content").eq("thread_id", thread.id)
        .order("created_at").order("id").limit(200).abortSignal(signal),
    ]);
    signal.throwIfAborted();
    if (cards.error || profile.error || messages.error) throw new Error("Could not load call context");

    const history = (messages.data ?? []) as { role: string; content: string }[];
    const expectedTurns = history.filter((m) => m.role === "user").length;
    if (expectedTurns === 0) return Response.json({ error: "Cuộc gọi chưa có lượt nào." }, { status: 409 });
    if (expectedTurns > MAX_CALL_TURNS) return Response.json({ error: "Cuộc gọi vượt quá số lượt." }, { status: 409 });

    const level = cefrSchema.safeParse(profile.data?.level).data ?? "B1";
    const terms: CallTargetTerm[] = (cards.data ?? []).map((c) => ({ term: c.term, definition_vi: c.definition_vi }));
    const transcript: CallMessage[] = history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    await assertQuota(supabase, user.id, "conversation");
    signal.throwIfAborted();
    const summary = await generateCallSummary({ scenario: scenario.data, level, terms, messages: transcript, signal });
    signal.throwIfAborted();

    const { data: saved, error: rpcError } = await supabase.rpc("finish_ai_call", {
      p_thread_id: thread.id,
      p_expected_turns: expectedTurns,
      p_summary: summary,
    }).abortSignal(signal);
    if (rpcError) throw rpcError;
    if (saved !== true) {
      return Response.json({ error: "Cuộc gọi đã thay đổi. Hãy tải lại trang." }, { status: 409 });
    }
    await recordUsage(supabase, user.id, "conversation");
    return Response.json({ summary });
  } catch (error) {
    if (signal.aborted) return Response.json({ error: "Tổng kết quá lâu. Hãy thử lại." }, { status: 504 });
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    console.error("AI call finish failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Chưa tạo được tổng kết. Hãy thử lại." }, { status: 502 });
  }
}
