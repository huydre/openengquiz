import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type WeeklyLeaderboard = {
  weekStart: string;
  weekEnd: string;
  entries: { rank: number; name: string; xp: number; isMe: boolean }[];
  me: { rank: number | null; xp: number };
};

export async function getWeeklyLeaderboard(supabase: SupabaseClient): Promise<WeeklyLeaderboard> {
  const { data, error } = await supabase.rpc("weekly_leaderboard");
  if (error) throw error;
  return {
    weekStart: data.week_start,
    weekEnd: data.week_end,
    entries: (data.entries as { rank: number; name: string; xp: number; is_me: boolean }[])
      .map(({ rank, name, xp, is_me }) => ({ rank, name, xp, isMe: is_me })),
    me: data.me,
  };
}

export async function getLeaderboardVisibility(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("my_leaderboard_visibility");
  if (error) throw error;
  return data;
}
