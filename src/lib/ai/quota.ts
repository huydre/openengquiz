import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_DAILY_LIMITS, type AiFeature, startOfLocalDayUtc } from "./quota-rules";

export class QuotaExceededError extends Error {
  constructor(
    readonly feature: AiFeature,
    readonly limit: number,
  ) {
    super(`Bạn đã dùng hết ${limit} lượt "${feature}" hôm nay. Hãy quay lại vào ngày mai.`);
  }
}

/**
 * Throws QuotaExceededError when the signed-in user has used up today's allowance for a feature.
 * Counts rows in ai_usage (RLS limits the query to the caller's own rows).
 */
export async function assertQuota(supabase: SupabaseClient, userId: string, feature: AiFeature) {
  const limit = AI_DAILY_LIMITS[feature];
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", startOfLocalDayUtc(new Date()).toISOString());

  if (error) throw error;
  if ((count ?? 0) >= limit) throw new QuotaExceededError(feature, limit);
}

/** Records one AI call. Call after the provider request succeeds. */
export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: AiFeature,
  usage: { units?: number; costUsd?: number } = {},
) {
  const { error } = await supabase.from("ai_usage").insert({
    user_id: userId,
    feature,
    units: usage.units ?? 1,
    cost_usd: usage.costUsd ?? null,
  });
  if (error) throw error;
}
