const DAY_MS = 86_400_000;

export function addDays(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS)
    .toISOString().slice(0, 10);
}

export function dayStartUtc(day: string): string {
  return new Date(`${day}T00:00:00+07:00`).toISOString();
}
