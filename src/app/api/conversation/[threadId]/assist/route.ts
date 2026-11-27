import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { generateCallAssist } from "@/lib/ai/conversation";
import { loadCallContext, loadCallThread } from "@/lib/ai/conversation-context";
import { CALL_ASSIST_ACTIONS } from "@/lib/ai/conversation-types";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { createClient } from "@/lib/supabase/server";

const assistSchema = z.object({
  action: z.enum(CALL_ASSIST_ACTIONS),
  /** 0-based index into the persisted chat history (created_at, id order). */
  messageIndex: z.number().int().min(0).max(499),
});

/**
 * Focused help for one message inside an AI call: translate it, hint at a
 * better phrasing, suggest ideas, or evaluate a learner reply. The target
 * message is resolved from persisted history server-side, so the client only
 * sends an index. Works on finished calls too.
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

    const body = assistSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ error: "Yêu cầu trợ giúp không hợp lệ." }, { status: 400 });

    const thread = await loadCallThread(supabase, threadId, signal);
    if (!thread) return Response.json({ error: "Không tìm thấy cuộc gọi." }, { status: 404 });

    const ctx = await loadCallContext(supabase, thread, user.id, signal);
    const target = ctx.messages[body.data.messageIndex];
    if (!target) return Response.json({ error: "Không tìm thấy tin nhắn đó." }, { status: 404 });

    await assertQuota(supabase, user.id, "conversation");
    signal.throwIfAborted();
    const text = await generateCallAssist({
      action: body.data.action,
      role: target.role,
      content: target.content,
      context: ctx.messages,
      level: ctx.level,
      terms: ctx.terms,
      topic: ctx.topic,
      signal,
    });
    signal.throwIfAborted();
    await recordUsage(supabase, user.id, "conversation");
    return Response.json({ text });
  } catch (error) {
    if (signal.aborted) return Response.json({ error: "Trợ giúp quá lâu. Hãy thử lại." }, { status: 504 });
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    console.error("AI call assist failed", error instanceof Error ? error.name : "DatabaseError");
    return Response.json({ error: "Chưa tạo được trợ giúp. Hãy thử lại." }, { status: 502 });
  }
}
