import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getStreakStatus(supabase: SupabaseClient): Promise<{
  streak: number;
  freezes: number;
  frozenDays: string[];
  activeDays: string[];
}> {
  const { data, error } = await supabase.rpc("sync_streak");
  if (error) throw error;
  return { streak: data.streak, freezes: data.freezes, frozenDays: data.frozen_days, activeDays: data.active_days };
}
