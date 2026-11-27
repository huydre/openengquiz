/**
 * Weekly leaderboard window rules, pure. Mirrors public.weekly_leaderboard in
 * supabase/migrations/20261128020100_weekly_leaderboard.sql: keep in sync.
 *
 * A week runs Monday 00:00 Asia/Ho_Chi_Minh (UTC+7, no DST) through the next
 * Monday 00:00. `user_daily_activity.day` is already a VN-local date; timestamptz
 * columns are compared against the VN-midnight instants.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD of the Monday starting the VN week that contains `now`. */
export function vnWeekStart(now: Date): string {
  // Shift into VN wall time, then find that day's Monday.
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const day = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
  const dow = new Date(day).getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = (dow + 6) % 7;
  return new Date(day - mondayOffset * 86_400_000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD of the day after the week ends (exclusive bound). */
export function vnWeekEnd(now: Date): string {
  const start = new Date(`${vnWeekStart(now)}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 7);
  return start.toISOString().slice(0, 10);
}

/** Instant (ms) of Monday 00:00 VN for the week containing `now`. */
export function vnWeekStartMs(now: Date): number {
  return Date.parse(`${vnWeekStart(now)}T00:00:00.000Z`) - VN_OFFSET_MS;
}

/** Whether a timestamptz instant falls inside the VN week containing `now`. */
export function inVnWeek(instant: Date, now: Date): boolean {
  return instant.getTime() >= vnWeekStartMs(now) && instant.getTime() < vnWeekStartMs(now) + 7 * 86_400_000;
}
