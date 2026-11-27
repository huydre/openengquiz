const DAY_MS = 86_400_000;

function offset(day: string, days: number): string {
  return new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10);
}

function gap(after: string, before: string): number {
  return Math.max(0, (Date.parse(before) - Date.parse(after)) / DAY_MS - 1);
}

function freezeDays(after: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => offset(after, i + 1));
}

/** Replays active VN days, then previews missed days before today. SQL mirrors these transitions. */
export function calculateStreakFreeze(activeDays: Iterable<string>, today: string) {
  let streak = 0;
  let freezes = 0;
  let awarded = 0;
  let lastActive: string | undefined;
  const frozenDays: string[] = [];
  for (const day of [...new Set(activeDays)].sort()) {
    if (day > today) break;
    let missed = lastActive ? gap(lastActive, day) : 0;
    if (lastActive && missed <= freezes) {
      frozenDays.push(...freezeDays(lastActive, missed));
      freezes -= missed;
    } else {
      streak = 0;
      missed = 0;
    }
    const next = streak + missed + 1;
    const reward = Math.min(2 - freezes, Math.floor(next / 7) - Math.floor(streak / 7));
    freezes += reward;
    awarded += reward;
    streak = next;
    lastActive = day;
  }
  if (lastActive) {
    const missed = gap(lastActive, today);
    if (missed > freezes) streak = 0;
    else {
      frozenDays.push(...freezeDays(lastActive, missed));
      freezes -= missed;
      const reward = Math.min(2 - freezes, Math.floor((streak + missed) / 7) - Math.floor(streak / 7));
      freezes += reward;
      awarded += reward;
      streak += missed;
    }
  }
  return { streak, freezes, frozenDays, awarded };
}
