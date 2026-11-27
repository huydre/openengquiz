import { cardDefinition, type StudyCard } from "./study-types";

export type Choice = { id: string; label: string };

export function choiceOptions(card: StudyCard, cards: StudyCard[]): Choice[] {
  const correct = cardDefinition(card);
  const seen = new Set([correct.toLocaleLowerCase()]);
  const distractors: Choice[] = [];
  for (const candidate of cards) {
    if (candidate.id === card.id) continue;
    const label = cardDefinition(candidate);
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push({ id: candidate.id, label });
    if (distractors.length === 3) break;
  }
  return [{ id: card.id, label: correct }, ...distractors];
}

export function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function falseStatement(card: StudyCard, cards: StudyCard[]): string | null {
  return choiceOptions(card, cards).find((item) => item.id !== card.id)?.label ?? null;
}
