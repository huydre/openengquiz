import { cardTermKey, type GeneratedCard } from "../ai/generated-card-data";
import type { LessonAction } from "./lesson-player-types";

export function levelProgress(lessonIds: string[], completed: ReadonlySet<string>) {
  const next = lessonIds.find((id) => !completed.has(id));
  return { next, done: lessonIds.filter((id) => completed.has(id)).length, total: lessonIds.length };
}

export function courseCards(cards: GeneratedCard[], seen: Set<string>, limit: number) {
  const selected: GeneratedCard[] = [];
  for (const card of cards) {
    if (selected.length >= limit) break;
    const key = cardTermKey(card.term);
    if (!key || seen.has(key) || !card.ipa?.trim() || !card.definition_vi.trim() || !card.example_en?.trim()) continue;
    seen.add(key);
    selected.push(card);
  }
  return selected;
}

export function canActOnLesson(step: number, action: LessonAction, calling: boolean, hasSecond: boolean) {
  if (action === "answer") return step === 2 || (step === 7 && !calling && !hasSecond);
  if (action === "retry" || action === "tone") return step === 3 || (step === 7 && !calling && hasSecond);
  if (action === "advance") return step === 1 || (step >= 3 && step <= 6) || (step === 7 && (calling || hasSecond));
  return step === 2 || (step === 7 && !calling && !hasSecond);
}

export function usedCourseTerms(transcript: string, terms: string[]) {
  const tokenize = (value: string) => value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? "";
  const text = ` ${tokenize(transcript)} `;
  return terms.filter((term) => { const key = tokenize(term); return key && text.includes(` ${key} `); });
}

/** Derives the first-vs-second warmup comparison shown at lesson step 7. */
export function buildLessonComparison(
  first: { transcript: string; feedback?: { score: number; used: string[] } | null } | null,
  second: { transcript: string; feedback?: { score: number; used: string[] } | null } | null,
  terms: string[],
) {
  if (!first || !second) return null;
  const usedFirst = first.feedback?.used.length ? first.feedback.used : usedCourseTerms(first.transcript, terms);
  const usedSecond = second.feedback?.used.length ? second.feedback.used : usedCourseTerms(second.transcript, terms);
  const firstSet = new Set(usedFirst.map((t) => t.toLowerCase()));
  return {
    delta: first.feedback && second.feedback ? second.feedback.score - first.feedback.score : null,
    newTerms: usedSecond.filter((t) => !firstSet.has(t.toLowerCase())),
    usedFirst,
    usedSecond,
  };
}
