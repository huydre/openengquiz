"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type LimitActionState = { message: string; saved: boolean };

export async function saveNewCardLimit(
  _previous: LimitActionState,
  formData: FormData,
): Promise<LimitActionState> {
  const raw = formData.get("newCardsPerDay");
  const limit = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return { message: "Chọn từ 1 đến 100 thẻ mới mỗi ngày.", saved: false };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { message: "Vui lòng đăng nhập lại để lưu cài đặt.", saved: false };
  }

  const { error } = await supabase.from("profiles")
    .update({ new_cards_per_day: limit }).eq("id", user.id);
  if (error) return { message: "Không lưu được cài đặt. Vui lòng thử lại.", saved: false };

  revalidatePath("/review");
  return { message: `Đã lưu giới hạn ${limit} thẻ mới mỗi ngày.`, saved: true };
}
