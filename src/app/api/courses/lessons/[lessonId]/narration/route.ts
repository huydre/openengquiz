import { z } from "zod";
import { getCourseLesson } from "@/lib/courses/course-data";
import { getLessonNarration } from "@/lib/courses/narration-server";
import { narrationKindSchema } from "@/lib/courses/narration";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ lessonId: string }> };

/**
 * GET /api/courses/lessons/[lessonId]/narration?kind=intro|transition|retry
 * Returns `{ lines: { en, vi }[] }` for the TutorNarration component. Lines are cached per
 * lesson in `lesson_narration`; fixed fallbacks are returned when AI is off or fails.
 */
export async function GET(request: Request, { params }: Props) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });

    const { lessonId } = await params;
    if (!z.uuid().safeParse(lessonId).success) {
      return Response.json({ error: "Bài học không hợp lệ." }, { status: 400 });
    }
    const kind = narrationKindSchema.safeParse(new URL(request.url).searchParams.get("kind"));
    if (!kind.success) {
      return Response.json({ error: "Loại lời dẫn không hợp lệ." }, { status: 400 });
    }

    const current = await getCourseLesson(db, lessonId);
    if (!current) return Response.json({ error: "Không tìm thấy bài học." }, { status: 404 });
    if (!current.open) return Response.json({ error: "Bài học chưa mở khóa." }, { status: 403 });

    const admin = createAdminClient();
    if (!admin) return Response.json({ error: "Chưa tải được lời dẫn." }, { status: 503 });

    const { data: cards, error: cardsError } = await db
      .from("cards")
      .select("term")
      .eq("set_id", current.lesson.set_id)
      .order("position");
    if (cardsError) throw cardsError;

    const lines = await getLessonNarration(
      admin,
      {
        id: current.lesson.id,
        title: current.lesson.title,
        warmup_question: current.lesson.warmup_question,
        cefr: current.lesson.course_parts.course_levels.cefr,
        words: (cards ?? []).map(({ term }) => term),
      },
      kind.data,
      user.id,
      signal,
    );
    return Response.json({ lines });
  } catch (error) {
    if (signal.aborted) return Response.json({ error: "Xử lý quá lâu. Hãy thử lại." }, { status: 504 });
    console.error("Lesson narration failed", error instanceof Error ? error.name : "error");
    return Response.json({ error: "Chưa tải được lời dẫn." }, { status: 502 });
  }
}
