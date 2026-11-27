import { cardTermKey, type GeneratedCard } from "../ai/generated-card-data";

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

export function usedCourseTerms(transcript: string, terms: string[]) {
  const tokenize = (value: string) => value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ") ?? "";
  const text = ` ${tokenize(transcript)} `;
  return terms.filter((term) => { const key = tokenize(term); return key && text.includes(` ${key} `); });
}
