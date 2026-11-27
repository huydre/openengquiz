import { NextResponse } from "next/server";
import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCards, type GenerateSource } from "@/lib/ai/generate-cards";
import { readSetTerms } from "@/lib/ai/generated-card-data";
import { normalizeLookupTerm } from "@/lib/vocab/lookup-term";
import { isAiConfigured } from "@/lib/ai/client";
import { QuotaExceededError } from "@/lib/ai/quota";

const level = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const requestSchema = z.object({
  targetSetId: z.uuid().nullish(),
  source: z.discriminatedUnion("type", [
    z.object({ type: z.literal("words"), words: z.array(z.string().max(200)).min(1).max(500) }),
    z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(15000), level: level.optional() }),
    z.object({ type: z.literal("topic"), topic: z.string().trim().min(1).max(200), level: level.optional() }),
  ]),
});

export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI chưa được cấu hình. Vui lòng liên hệ quản trị viên." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bạn cần đăng nhập để sử dụng tính năng này." }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Nguồn dữ liệu, trình độ hoặc bộ từ không hợp lệ." }, { status: 400 });
  }
  const { source, targetSetId } = body.data;
  if (source.type === "words" && !source.words.every(normalizeLookupTerm)) {
    return NextResponse.json({ error: "Mỗi từ hoặc cụm từ phải hợp lệ và dài tối đa 100 ký tự." }, { status: 400 });
  }

  try {
    let existingTerms: string[] = [];
    if (targetSetId) {
      const { data: set, error } = await supabase.from("study_sets").select("id")
        .eq("id", targetSetId).eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      if (!set) return NextResponse.json({ error: "Bạn không có quyền sửa bộ từ này." }, { status: 403 });
      existingTerms = await readSetTerms(supabase, targetSetId);
    }

    let finalSource: GenerateSource = source.type === "words" ? source : { ...source, level: source.level ?? "B1" };
    if (source.type !== "words" && !source.level) {
      const { data: profile, error } = await supabase.from("profiles").select("level").eq("id", user.id).maybeSingle();
      if (error) throw error;
      finalSource = { ...source, level: profile?.level ?? "B1" };
    }

    const cards = await generateCards({
      source: finalSource,
      existingTerms,
      userId: user.id,
      supabase,
    });

    return NextResponse.json({ cards });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
      return NextResponse.json({ error: "AI trả kết quả sai định dạng. Hãy thử lại." }, { status: 502 });
    }
    console.error("Generate cards failed", error instanceof Error ? error.name : "DatabaseError");
    return NextResponse.json(
      { error: "Không tạo được thẻ. Hãy thử lại." },
      { status: 500 },
    );
  }
}
