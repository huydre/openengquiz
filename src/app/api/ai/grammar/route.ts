import { NextResponse } from "next/server";
import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAiConfigured } from "@/lib/ai/client";
import { assertQuota, recordUsage, QuotaExceededError } from "@/lib/ai/quota";
import {
  cefrSchema,
  generateGrammarExercise,
  gradeGrammarAnswer,
  grammarModeSchema,
  type GrammarTerm,
} from "@/lib/ai/grammar";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("exercise"),
    setId: z.uuid(),
    mode: grammarModeSchema,
  }),
  z.object({
    action: z.literal("grade"),
    setId: z.uuid(),
    mode: grammarModeSchema,
    prompt: z.string().trim().min(1).max(2000),
    reference: z.string().trim().min(1).max(2000),
    answer: z.string().trim().min(1).max(2000),
  }),
]);

export async function POST(request: Request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
  if (signal.aborted) return new Response(null, { status: 408 });
  const timeout = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  try {
    return await Promise.race([handle(request, signal), timeout]);
  } catch (error) {
    if (signal.aborted) {
      return NextResponse.json({ error: "Yêu cầu quá lâu. Hãy thử lại." }, { status: 504 });
    }
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
      return NextResponse.json({ error: "AI trả kết quả sai định dạng. Hãy thử lại." }, { status: 502 });
    }
    console.error("Grammar request failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Không xử lý được yêu cầu. Hãy thử lại." }, { status: 500 });
  }
}

async function handle(request: Request, signal: AbortSignal) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI chưa được bật. Vui lòng thử lại sau." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để luyện ngữ pháp." }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  const input = body.data;

  // RLS on study_sets limits this to sets the user may read.
  const { data: set, error: setError } = await supabase
    .from("study_sets")
    .select("id")
    .eq("id", input.setId)
    .maybeSingle();
  signal.throwIfAborted();
  if (setError) throw setError;
  if (!set) {
    return NextResponse.json({ error: "Không tìm thấy bộ từ." }, { status: 404 });
  }

  await assertQuota(supabase, user.id, "grammar");
  signal.throwIfAborted();

  if (input.action === "exercise") {
    const [cards, profile] = await Promise.all([
      supabase.from("cards").select("term, definition_vi").eq("set_id", input.setId)
        .order("position").order("created_at").order("id").limit(40).abortSignal(signal),
      supabase.from("profiles").select("level").eq("id", user.id).abortSignal(signal).maybeSingle(),
    ]);
    signal.throwIfAborted();
    if (cards.error) throw cards.error;
    if (profile.error) throw profile.error;
    const terms = (cards.data ?? []) as GrammarTerm[];
    if (!terms.length) {
      return NextResponse.json({ error: "Bộ từ chưa có thẻ để luyện ngữ pháp." }, { status: 422 });
    }
    const level = cefrSchema.safeParse(profile.data?.level).data ?? "B1";
    const exercise = await generateGrammarExercise(input.mode, terms, level, signal);
    signal.throwIfAborted();
    await recordUsage(supabase, user.id, "grammar");
    return NextResponse.json({ exercise });
  }

  const grade = await gradeGrammarAnswer(
    { mode: input.mode, prompt: input.prompt, reference: input.reference, answer: input.answer },
    signal,
  );
  signal.throwIfAborted();

  const { error: insertError } = await supabase.from("grammar_attempts").insert({
    user_id: user.id,
    set_id: input.setId,
    mode: input.mode,
    prompt: input.prompt,
    reference: input.reference,
    answer: input.answer,
    score: grade.score,
    feedback: {
      corrected_en: grade.corrected_en,
      explanation_vi: grade.explanation_vi,
      mistakes: grade.mistakes,
    },
  });
  signal.throwIfAborted();
  await recordUsage(supabase, user.id, "grammar");
  if (insertError) {
    console.error("Grammar attempt insert failed", insertError.code);
    return NextResponse.json({ grade, saved: false });
  }
  return NextResponse.json({ grade, saved: true });
}
