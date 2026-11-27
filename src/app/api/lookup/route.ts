import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/ai/client";
import { assertQuota, QuotaExceededError, recordUsage } from "@/lib/ai/quota";
import { DictionaryNotFoundError, lookupDictionary } from "@/lib/vocab/lookup-dictionary";
import { enrichVietnamese } from "@/lib/vocab/enrich-vietnamese";
import { lookupWithAi } from "@/lib/vocab/lookup-ai";
import { lookupResultSchema, normalizeLookupTerm, type LookupResult } from "@/lib/vocab/lookup-term";

/**
 * Word lookup: shared cache, then an AI dictionary entry (every sense with Vietnamese meaning,
 * example and translation, synonyms, related words; spelling correction; Vietnamese queries map
 * to the English word). Without AI or quota it falls back to the Free Dictionary API plus a
 * Vietnamese meaning, as before.
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
  // AI entries may be stored under the typed query (misspelling or Vietnamese) with a different headword.
  const fromCache = cachedResult.success && (cachedResult.data.term === term || cachedResult.data.meanings?.length)
    ? cachedResult.data : null;
  const aiReady = isAiConfigured();
  if (fromCache && (fromCache.meanings?.length || !aiReady)) {
    return Response.json({ data: fromCache });
  }

  const admin = createAdminClient();
  const store = async (key: string, data: LookupResult) => {
    if (!admin) return;
    const { error } = await admin.from("word_cache").upsert({ term: key, data, updated_at: new Date().toISOString() });
    if (error) console.error("Lookup cache write failed", error);
  };

  if (aiReady) {
    try {
      await assertQuota(supabase, user.id, "lookup");
      const entry = await lookupWithAi(term, AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]));
      await recordUsage(supabase, user.id, "lookup");
      if (!entry) return Response.json({ error: "Chưa tìm thấy từ này. Thử từ khác nhé." }, { status: 404 });
      await store(term, entry);
      if (entry.term !== term) await store(entry.term, { ...entry, corrected_term: null, source_lang: "en" });
      return Response.json({ data: entry });
    } catch (error) {
      if (!(error instanceof QuotaExceededError)) console.error("AI lookup failed, using dictionary", error);
    }
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
  if (changed) await store(term, result);

  return Response.json({ data: result });
}
