import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { gradeStudySession } from "@/lib/study/grade-session";
import type { StudyCard, StudyMode } from "@/lib/study/study-types";

const attemptSchema = z.object({
  card_id: z.uuid(),
  question_type: z.enum([
    "multiple_choice", "learn_type", "true_false", "fill", "match",
    "dictation_term", "dictation_example", "writing", "game",
  ]),
  answer: z.string().max(1000),
  statement: z.string().max(1000).optional(),
});
const bodySchema = z.object({
  sessionId: z.uuid(),
  attempts: z.array(attemptSchema).min(1).max(500),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Dữ liệu trả lời không hợp lệ." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const { data: session, error: sessionError } = await supabase.from("study_sessions")
    .select("id, set_id, mode, score, total, finished_at")
    .eq("id", body.sessionId).eq("user_id", user.id).maybeSingle();
  if (sessionError || !session?.set_id) {
    return NextResponse.json({ error: "Không tìm thấy phiên học." }, { status: 404 });
  }
  if (session.finished_at) {
    return NextResponse.json({
      status: "duplicate", session_id: session.id, score: session.score, total: session.total,
    });
  }
  if (!["learn", "quiz", "dictation", "writing", "game"].includes(session.mode)) {
    return NextResponse.json({ error: "Chế độ học không hợp lệ." }, { status: 400 });
  }
  const { data: cards, error: cardsError } = await supabase.from("cards")
    .select("id, term, definition_vi, definition_en, example_en").eq("set_id", session.set_id);
  if (cardsError || !cards?.length) {
    return NextResponse.json({ error: "Không tải được thẻ trong bộ." }, { status: 400 });
  }
  try {
    const graded = gradeStudySession(session.mode as StudyMode, cards as StudyCard[], body.attempts);
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Dịch vụ học chưa sẵn sàng." }, { status: 503 });
    const { data, error } = await admin.rpc("finish_study_session", {
      p_user_id: user.id,
      p_session_id: session.id,
      p_attempts: graded.attempts,
      p_score: graded.score,
      p_total: graded.total,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    // Database/grader messages are internal (English); log them and show a friendly message.
    console.error("Study session finish failed", error);
    return NextResponse.json({ error: "Không lưu được kết quả. Hãy thử lại." }, { status: 400 });
  }
}
