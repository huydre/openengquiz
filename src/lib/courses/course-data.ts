import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { levelProgress } from "./course-progress";
export { getLessonPlayerState } from "./lesson-player-state";

export async function courseMap(db: SupabaseClient, level: string) {
  const { data, error } = await db.from("course_parts").select("id,title,position,course_lessons(id,title,icon,position,set_id)")
    .eq("level_id", level).order("position").order("position", { referencedTable: "course_lessons" });
  if (error) throw error;
  const ids = data.flatMap((part) => part.course_lessons.map((lesson) => lesson.id));
  const rows = ids.length ? await db.from("lesson_progress").select("lesson_id,step,completed_at").in("lesson_id", ids) : null;
  if (rows?.error) throw rows.error;
  const progress = new Map(rows?.data?.map((row) => [row.lesson_id, row]));
  const completed = new Set([...progress.values()].filter((row) => row.completed_at).map((row) => row.lesson_id));
  return { parts: data, progress, completed, ...levelProgress(ids, completed) };
}

export async function getCourse(db: SupabaseClient, slug: string, cefr?: string | null) {
  const { data: course, error } = await db.from("courses").select("id,slug,goal,title,course_levels(*)").eq("slug", slug)
    .order("position", { referencedTable: "course_levels" }).maybeSingle();
  if (error) throw error;
  if (!course) return null;
  const { data: choice, error: choiceError } = await db.from("course_choices").select("level_id").eq("course_id", course.id).maybeSingle();
  if (choiceError) throw choiceError;
  const levels = course.course_levels;
  const level = levels.find((row) => row.id === choice?.level_id) ?? levels.find((row) => row.cefr === cefr) ?? levels[0];
  return { course, levels, level };
}

export async function getCourseLesson(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("course_lessons").select("*,course_parts!inner(position,level_id,course_levels!inner(cefr,courses!inner(slug)))").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const map = await courseMap(db, data.course_parts.level_id);
  const result = await db.from("lesson_progress").select("*").eq("lesson_id", id).maybeSingle();
  if (result.error) throw result.error;
  return { lesson: data, progress: result.data, map, open: map.next === id || map.completed.has(id) };
}
