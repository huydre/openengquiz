export function normalizeSearchQuery(value: string | null): string | null {
  const query = value?.trim();
  return query && query.length >= 2 && query.length <= 80 ? query : null;
}

export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
