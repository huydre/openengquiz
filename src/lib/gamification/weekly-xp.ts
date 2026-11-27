/**
 * Weekly leaderboard XP rules. Pure module: no Supabase imports so the formula can
 * be unit-tested and mirrored by the weekly_leaderboard RPC in
 * supabase/migrations/20261128020100_weekly_leaderboard.sql.
 *
 * Formula (must stay in sync with the RPC):
 *   1 XP  per SRS review or finished study session
 *         (user_daily_activity.reviews + user_daily_activity.studied;
 *          `studied` counts sessions, not cards)
 *   10 XP per completed course activity
 *         (course_activity_progress rows with completed_at not null;
 *          includes synthetic legacy backfill rows, which count as valid)
 *   5 XP  per speaking attempt (speaking_attempts rows)
 */

export const XP_PER_REVIEW_OR_SESSION = 1;
export const XP_PER_COURSE_ACTIVITY = 10;
export const XP_PER_SPEAKING_ATTEMPT = 5;

export type DailyActivityRow = { reviews: number; studied: number };
export type CourseActivityRow = { completed_at: string | null };
export type SpeakingAttemptRow = { created_at: string };

/** XP earned from user_daily_activity rows inside the week. */
export function activityXp(rows: DailyActivityRow[]): number {
  return rows.reduce((sum, row) => sum + row.reviews + row.studied, 0) * XP_PER_REVIEW_OR_SESSION;
}

/** XP earned from completed course_activity_progress rows inside the week. */
export function courseActivityXp(rows: CourseActivityRow[]): number {
  return rows.filter((row) => row.completed_at !== null).length * XP_PER_COURSE_ACTIVITY;
}

/** XP earned from speaking_attempts rows inside the week. */
export function speakingXp(rows: SpeakingAttemptRow[]): number {
  return rows.length * XP_PER_SPEAKING_ATTEMPT;
}

export function totalWeeklyXp(parts: {
  activity: DailyActivityRow[];
  courseActivities: CourseActivityRow[];
  speakingAttempts: SpeakingAttemptRow[];
}): number {
  return activityXp(parts.activity) + courseActivityXp(parts.courseActivities) + speakingXp(parts.speakingAttempts);
}
