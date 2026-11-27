"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  message: z.string().trim().min(1, "Nhập nội dung góp ý.").max(2000, "Góp ý tối đa 2000 ký tự."),
  page: z.string().trim().min(1).max(500),
});

export type FeedbackResult = { ok: true } | { error: string };

export async function submitFeedback(input: { message: string; page: string }): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Vui lòng đăng nhập để gửi góp ý." };
  const { error } = await supabase.from("feedback_reports").insert({
    user_id: user.id, page: parsed.data.page, message: parsed.data.message,
  });
  if (error) {
    if (error.code === "PT429") return { error: "Bạn đã gửi quá nhiều góp ý hôm nay. Mai thử lại nhé." };
    console.error("Feedback insert failed", error.message);
    return { error: "Chưa gửi được góp ý. Thử lại sau nhé." };
  }
  return { ok: true };
}
