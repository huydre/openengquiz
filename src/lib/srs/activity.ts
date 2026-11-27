import { startOfLocalDayUtc } from "../ai/quota-rules";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function vietnamDay(now: Date): string {
  return new Date(startOfLocalDayUtc(now).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Counts consecutive active VN days, allowing today's activity to be pending. */
export function currentStreak(activeDays: Iterable<string>, now: Date): number {
  const days = new Set(activeDays);
  let day = vietnamDay(now);
  if (!days.has(day)) day = previousDay(day);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = previousDay(day);
  }
  return streak;
}
