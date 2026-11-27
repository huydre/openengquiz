import { z } from "zod";
import { isAiConfigured } from "@/lib/ai/client";
import { QuotaExceededError, assertQuota, recordUsage } from "@/lib/ai/quota";
import { cefrSchema, generateSpeakingQuestion } from "@/lib/ai/speaking-feedback";
import { isSpeechServiceConfigured } from "@/lib/speech/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  if (signal.aborted) return new Response(null, { status: 408 });
  const timeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  try {
    return await Promise.race([createQuestion(request, signal), timeout]);
  } catch (error) {
    if (signal.aborted) return Response.json({ error: "Tạo câu hỏi quá lâu. Hãy thử lại." }, { status: 504 });
    if (error instanceof QuotaExceededError) return Response.json({ error: error.message }, { status: 429 });
    return Response.json({ error: "Chưa tạo được câu hỏi. Hãy thử lại." }, { status: 502 });
  }
}

async function createQuestion(request: Request, signal: AbortSignal) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập để luyện nói." }, { status: 401 });
  if (!isSpeechServiceConfigured()) {
    return Response.json({ error: "Dịch vụ giọng nói chưa được bật." }, { status: 503 });
  }

  const body = z.object({ cardId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Thẻ không hợp lệ." }, { status: 400 });

  const [card, profile] = await Promise.all([
    supabase.from("cards").select("term").eq("id", body.data.cardId).abortSignal(signal).maybeSingle(),
    supabase.from("profiles").select("level").eq("id", user.id).abortSignal(signal).maybeSingle(),
  ]);
  signal.throwIfAborted();
  if (card.error || profile.error) throw new Error("Could not load speaking prompt input");
  if (!card.data) return Response.json({ error: "Không tìm thấy thẻ." }, { status: 404 });
  const { term } = card.data;
  const level = cefrSchema.safeParse(profile.data?.level).data ?? "B1";
  let question = `How would you use “${term}” to describe a situation in your life?`;
  if (isAiConfigured()) {
    await assertQuota(supabase, user.id, "speaking");
    signal.throwIfAborted();
    question = await generateSpeakingQuestion(term, level, signal);
    signal.throwIfAborted();
    await recordUsage(supabase, user.id, "speaking");
  }
  return Response.json({ question, term, level });
}
