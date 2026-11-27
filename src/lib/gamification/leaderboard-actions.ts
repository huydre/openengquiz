"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setLeaderboardVisibility(visible: boolean): Promise<{ error: string | null }> {
  if (typeof visible !== "boolean") return { error: "Cài đặt hiển thị không hợp lệ." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase.from("profiles").update({ show_on_leaderboard: visible })
    .eq("id", user.id).select("id").maybeSingle();
  if (error || !data) return { error: "Không lưu được cài đặt hiển thị." };
  revalidatePath("/account");
  return { error: null };
}
