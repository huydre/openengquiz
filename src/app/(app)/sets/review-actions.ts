"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function enrollSetCards(setId: string): Promise<{ added?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const admin = createAdminClient();
  if (!admin) return { error: "Máy chủ chưa sẵn sàng để lưu lịch ôn." };
  const { data, error } = await admin.rpc("enroll_set_cards", { p_user_id: user.id, p_set_id: setId });
  if (error) {
    console.error("SRS enrollment failed", error);
    return { error: "Chưa thêm được thẻ vào ôn tập." };
  }
  revalidatePath("/review");
  revalidatePath(`/sets/${setId}`);
  return { added: typeof data === "number" ? data : 0 };
}

/** Adds the cards finished in a vocabulary lesson to the learner's review queue. */
export async function enrollLearnedCards(cardIds: string[]): Promise<{ added?: number; error?: string }> {
  const ids = [...new Set(cardIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
  if (!ids.length) return { added: 0 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const admin = createAdminClient();
  if (!admin) return { error: "Máy chủ chưa sẵn sàng để lưu lịch ôn." };
  const { data, error } = await admin.rpc("enroll_cards", { p_user_id: user.id, p_card_ids: ids });
  if (error) {
    console.error("Lesson enrollment failed", error.message);
    return { error: "Chưa thêm được từ vào ôn tập." };
  }
  revalidatePath("/review");
  return { added: typeof data === "number" ? data : 0 };
}
