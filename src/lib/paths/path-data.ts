import { z } from "zod";

export const levels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const pathFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  level: z.enum(levels),
});

export type PathCard = z.infer<typeof pathFields> & { id: string };
export type PathProgress = { set_id: string; total: number; mastered: number };

export function summarizeProgress(rows: PathProgress[]) {
  let total = 0, mastered = 0;
  for (const row of rows) {
    total += row.total;
    mastered += row.mastered;
  }
  return {
    total, mastered, percent: total ? Math.round(100 * mastered / total) : 0,
    next: rows.find((row) => row.mastered < row.total)?.set_id,
  };
}

const goalTags: Record<string, string> = { ielts: "ielts", toeic: "toeic", thpt: "thpt", work: "for work", communication: "cefr" };

export function recommendPaths(paths: PathCard[], goal?: string | null, level?: string | null) {
  const tag = goal ? goalTags[goal] : undefined;
  const target = levels.findIndex((value) => value === level);
  return paths.filter((path) => path.tags.some((value) => value.toLowerCase() === tag) || path.level === level)
    .sort((a, b) => rank(b) - rank(a)).slice(0, 3);

  function rank(path: PathCard) {
    const matches = path.tags.some((value) => value.toLowerCase() === tag);
    return (matches ? levels.length : 0) - (target < 0 ? 0 : Math.abs(levels.indexOf(path.level) - target));
  }
}
