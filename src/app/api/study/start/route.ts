import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  setId: z.uuid(),
  mode: z.enum(["learn", "quiz", "dictation", "writing", "game"]),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Dịch vụ học chưa sẵn sàng." }, { status: 503 });
  const { data, error } = await admin.rpc("start_study_session", {
    p_user_id: user.id,
    p_set_id: body.setId,
    p_mode: body.mode,
  });
  if (error || typeof data !== "string") {
    if (error) console.error("Study session start failed", error);
    return NextResponse.json({ error: "Không tạo được phiên học. Hãy thử lại." }, { status: 400 });
  }
  return NextResponse.json({ sessionId: data });
}
