import { cardTermKey, type GeneratedCard } from "../ai/generated-card-data";

export function pathCards(cards: GeneratedCard[], seen: Set<string>, limit: number) {
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
