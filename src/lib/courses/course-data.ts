import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lessonActivitiesComplete, type CourseActivityProgress } from "./lesson-activities";
import { levelProgress } from "./course-progress";
export { getLessonPlayerState } from "./lesson-player-state";

export async function courseMap(db: SupabaseClient, level: string, userId?: string) {
  // Legacy databases omit activity_content from the wildcard selection.
  const { data, error } = await db.from("course_parts").select("id,title,position,course_lessons(*)")
    .eq("level_id", level).order("position").order("position", { referencedTable: "course_lessons" });
  if (error) throw error;
  const ids = data.flatMap((part) => part.course_lessons.map((lesson) => lesson.id));
  const v2Ids = data.flatMap((part) => part.course_lessons.filter((lesson) => lesson.activity_content).map((lesson) => lesson.id));
  const progressQuery = db.from("lesson_progress").select("lesson_id,step,completed_at").in("lesson_id", ids);
  const activitiesQuery = v2Ids.length ? db.from("course_activity_progress")
    .select("lesson_id,activity,small_step,state,completed_at").in("lesson_id", v2Ids) : null;
  if (userId) {
    progressQuery.eq("user_id", userId);
    activitiesQuery?.eq("user_id", userId);
  }
  const [rows, activities] = await Promise.all([ids.length ? progressQuery : null, activitiesQuery]);
  if (rows?.error) throw rows.error;
  if (activities?.error) throw activities.error;
  const activityByLesson = new Map<string, CourseActivityProgress[]>();
  for (const row of activities?.data ?? []) {
    const existing = activityByLesson.get(row.lesson_id);
    if (existing) existing.push(row as CourseActivityProgress);
    else activityByLesson.set(row.lesson_id, [row as CourseActivityProgress]);
  }
  const progress = new Map(rows?.data?.map((row) => [row.lesson_id, row]));
  const v2Lessons = new Set(v2Ids);
  const completed = new Set(ids.filter((id) => v2Lessons.has(id)
    ? lessonActivitiesComplete(activityByLesson.get(id) ?? [])
    : Boolean(progress.get(id)?.completed_at)));
  return { parts: data, progress, activityByLesson, completed, ...levelProgress(ids, completed) };
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

export async function getCourseLesson(db: SupabaseClient, id: string, userId?: string) {
  const { data, error } = await db.from("course_lessons").select("*,course_parts!inner(position,level_id,course_levels!inner(cefr,courses!inner(slug)))").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const progress = db.from("lesson_progress").select("*").eq("lesson_id", id);
  if (userId) progress.eq("user_id", userId);
  const [map, result] = await Promise.all([courseMap(db, data.course_parts.level_id, userId), progress.maybeSingle()]);
  if (result.error) throw result.error;
  return { lesson: data, progress: result.data, map, open: map.next === id || map.completed.has(id) };
}
