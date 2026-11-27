import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/ai/client";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { DictionaryNotFoundError, lookupDictionary } from "@/lib/vocab/lookup-dictionary";
import { enrichVietnamese } from "@/lib/vocab/enrich-vietnamese";
import { lookupResultSchema, normalizeLookupTerm, type LookupResult } from "@/lib/vocab/lookup-term";

/**
 * Word lookup: shared cache, then Free Dictionary API, then a Vietnamese meaning from the LLM
 * when it is configured. A cached entry without Vietnamese is enriched once AI becomes available.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Vui lòng đăng nhập để tra từ." }, { status: 401 });
  }

  const term = normalizeLookupTerm(new URL(request.url).searchParams.get("term") ?? "");
  if (!term) {
    return Response.json({ error: "Nhập từ dài tối đa 100 ký tự." }, { status: 400 });
  }

  const { data: cached, error: cacheError } = await supabase
    .from("word_cache")
    .select("data")
    .eq("term", term)
    .maybeSingle();
  if (cacheError) console.error("Lookup cache read failed", cacheError);

  const cachedResult = lookupResultSchema.safeParse(cached?.data);
  const fromCache = cachedResult.success && cachedResult.data.term === term ? cachedResult.data : null;
  const aiReady = isAiConfigured();
  if (fromCache && (fromCache.definition_vi || !aiReady)) {
    return Response.json({ data: fromCache });
  }

  let result: LookupResult;
  try {
    result = fromCache ?? (await lookupDictionary(term));
  } catch (error) {
    if (error instanceof DictionaryNotFoundError) {
      return Response.json({ error: "Chưa tìm thấy từ này. Thử từ khác nhé." }, { status: 404 });
    }
    console.error("Dictionary lookup failed", error);
    return Response.json({ error: "Chưa tra được từ lúc này. Thử lại sau nhé." }, { status: 502 });
  }

  // The Vietnamese meaning is an extra: on quota or AI errors, still return the English result.
  if (aiReady) {
    try {
      await assertQuota(supabase, user.id, "lookup");
      result = await enrichVietnamese(result);
      await recordUsage(supabase, user.id, "lookup");
    } catch (error) {
      if (!(error instanceof QuotaExceededError)) console.error("Vietnamese enrichment failed", error);
    }
  }

  const changed = !fromCache || result.definition_vi !== fromCache.definition_vi;
  const admin = createAdminClient();
  if (admin && changed) {
    const { error } = await admin
      .from("word_cache")
      .upsert({ term, data: result, updated_at: new Date().toISOString() });
    if (error) console.error("Lookup cache write failed", error);
  }

  return Response.json({ data: result });
}
