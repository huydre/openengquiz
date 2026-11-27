import { parse } from "yaml";
import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const text = z.string().trim().min(1).max(400);
export const courseIcons = [
  "alarm-clock", "bed", "book-open", "briefcase", "bus", "calendar", "camera", "clock", "cloud-rain", "coffee",
  "dumbbell", "film", "graduation-cap", "heart-pulse", "home", "key", "landmark", "laptop", "leaf", "map-pin",
  "message-circle", "music", "newspaper", "palette", "plane", "scale", "shield", "shopping-bag", "sparkles", "sun",
  "users", "utensils", "wallet",
] as const;
export type CourseIcon = (typeof courseIcons)[number];
const schema = z.object({
  slug, goal: z.enum(["ielts", "toeic", "communication", "thpt", "work"]), title: text,
  levels: z.array(z.object({
    slug, title: text, cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
    words: z.number().int().min(8).max(10), summary: text, entry: text, outcome: text, method: text,
    parts: z.array(z.object({ title: text, lessons: z.array(z.object({
      title: text.max(80), icon: z.enum(courseIcons), question: text.regex(/\?$/), scope: text,
    })).length(5) })).length(6),
  })).min(1),
}).superRefine(({ goal, levels }, ctx) => {
  if (goal === "ielts" && levels.length !== 7) ctx.addIssue({ code: "custom", message: "IELTS requires seven levels" });
  const slugs = new Set<string>();
  const questions = new Set<string>();
  for (const level of levels) {
    if (slugs.has(level.slug)) ctx.addIssue({ code: "custom", message: `Duplicate level: ${level.slug}` });
    slugs.add(level.slug);
    for (const part of level.parts) for (const { question } of part.lessons) {
      const key = question.normalize("NFKC").toLowerCase();
      if (questions.has(key)) ctx.addIssue({ code: "custom", message: `Duplicate question: ${question}` });
      questions.add(key);
    }
  }
});

export function parseCourseCatalog(source: string) {
  return schema.parse(parse(source));
}
