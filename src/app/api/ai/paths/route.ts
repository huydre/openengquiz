import { after, NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/client";
import { generatePathSets, pathRequest, proposePath } from "@/lib/ai/generate-path";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: "AI chưa bật." }, { status: 503 });
  const parsed = pathRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Kiểm tra mục tiêu, số tuần và trình độ." }, { status: 400 });
  const input = parsed.data;
  try {
    await assertQuota(db, user.id, "generate-path");
    const { data: path, error } = await db.from("learning_paths").insert({
      owner_id: user.id, title: input.goal.slice(0, 200), description: `Kế hoạch ${input.weeks} tuần`,
      level: input.level, status: "generating",
    }).select("id").single();
    if (error || !path) throw error ?? new Error("Draft not created");
    const userId = user.id;
    after(async () => {
      const signal = AbortSignal.timeout(270_000);
      try {
        const plan = await proposePath(input, async () => {
          await assertQuota(db, userId, "generate-path");
          await recordUsage(db, userId, "generate-path");
        }, signal);
        const { error: updateError } = await db.from("learning_paths")
          .update({ title: plan.title, description: plan.description, tags: plan.tags })
          .eq("id", path.id).eq("status", "generating");
        if (updateError) throw updateError;
        const sets = await generatePathSets(plan, input.level, { supabase: db, userId, signal });
        const result = await db.rpc("publish_generated_path", { p_path_id: path.id, p_sets: sets });
        if (result.error || result.data !== true) throw result.error ?? new Error("Draft no longer active");
      } catch (error) {
        const message = error instanceof QuotaExceededError ? error.message : "AI không tạo được lộ trình. Vui lòng thử lại.";
        const { error: updateError } = await db.from("learning_paths").update({ status: "failed", error: message })
          .eq("id", path.id).eq("status", "generating");
        if (updateError) console.error("Could not mark path generation failed", updateError.code);
      }
    });
    return NextResponse.json({ id: path.id }, { status: 202 });
  } catch (error) {
    if (error instanceof QuotaExceededError) return NextResponse.json({ error: error.message }, { status: 429 });
    return NextResponse.json({ error: "Không khởi tạo được lộ trình. Vui lòng thử lại." }, { status: 500 });
  }
}
