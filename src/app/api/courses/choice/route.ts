import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const input = z.object({ level: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Cấp độ không hợp lệ." }, { status: 400 });
  const level = await db.from("course_levels").select("course_id").eq("id", input.data.level).maybeSingle();
  const admin = createAdminClient();
  if (level.error || !admin) return Response.json({ error: "Chưa lưu được cấp độ." }, { status: 503 });
  if (!level.data) return Response.json({ error: "Không tìm thấy cấp độ." }, { status: 404 });
  const { error } = await admin.from("course_choices").upsert({ user_id: user.id, course_id: level.data.course_id,
    level_id: input.data.level, updated_at: new Date().toISOString() });
  return error ? Response.json({ error: "Chưa lưu được cấp độ." }, { status: 502 }) : Response.json({ ok: true });
}
