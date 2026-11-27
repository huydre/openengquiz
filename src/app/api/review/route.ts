import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRating, previewIntervals, type StoredReviewState } from "@/lib/srs/fsrs";

const requestSchema = z.object({
  cardId: z.uuid(),
  clientReviewId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { data: state, error: readError } = await supabase.from("review_states")
    .select("state, fsrs, due_at, reps, lapses, last_review_at, version")
    .eq("user_id", user.id).eq("card_id", parsed.data.cardId).maybeSingle();
  if (readError) return Response.json({ error: "Không đọc được lịch ôn tập." }, { status: 500 });
  if (!state) return Response.json({ error: "Thẻ chưa được thêm vào ôn tập." }, { status: 404 });

  const now = new Date();
  let next;
  try { next = applyRating(state as StoredReviewState, parsed.data.rating, now); }
  catch { return Response.json({ error: "Lịch ôn tập không hợp lệ." }, { status: 500 }); }

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Máy chủ chưa sẵn sàng để lưu ôn tập." }, { status: 503 });
  const { data, error } = await admin.rpc("commit_review", {
    p_user_id: user.id,
    p_card_id: parsed.data.cardId,
    p_client_review_id: parsed.data.clientReviewId,
    p_rating: parsed.data.rating,
    p_expected_version: state.version,
    p_next_state: next.next,
    p_log: { elapsed_days: next.log.elapsedDays, scheduled_days: next.log.scheduledDays },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("stale")) return Response.json({ error: "Thẻ đã được ôn ở nơi khác. Tải lại nhé." }, { status: 409 });
    if (message.includes("new card limit")) return Response.json({ error: "Bạn đã học đủ thẻ mới hôm nay." }, { status: 429 });
    if (message.includes("not allowed") || message.includes("not found")) return Response.json({ error: "Không thể ôn thẻ này." }, { status: 403 });
    console.error("Review commit failed", error);
    return Response.json({ error: "Chưa lưu được lượt ôn. Hãy thử lại." }, { status: 500 });
  }

  return Response.json({
    status: data?.status ?? "applied",
    intervals: previewIntervals(next.next, now),
  });
}
