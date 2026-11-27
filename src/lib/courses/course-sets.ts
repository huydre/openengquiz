import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ids of the sets that hold course lesson vocabulary. Those sets belong to the content owner's
 * account but are course material, so "my sets" lists and pickers leave them out.
 */
export async function courseSetIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("course_lessons").select("set_id");
  if (error) return new Set();
  return new Set(data.map((lesson) => lesson.set_id as string));
}
