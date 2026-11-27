import type { SupabaseClient } from "@supabase/supabase-js";

/** System-owned study sets excluded from the learner's personal set list. */
export async function systemSetIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const [lessons, paths] = await Promise.all([
    supabase.from("course_lessons").select("set_id"),
    process.env.SEED_CONTENT_OWNER_ID
      ? supabase.from("learning_paths").select("id").eq("owner_id", process.env.SEED_CONTENT_OWNER_ID)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lessons.error) return ids;
  for (const lesson of lessons.data) ids.add(lesson.set_id);
  if (paths.error || !paths.data.length) return ids;
  const items = await supabase.from("path_items").select("set_id").in("path_id", paths.data.map(({ id }) => id));
  if (!items.error) for (const item of items.data) ids.add(item.set_id);
  return ids;
}
