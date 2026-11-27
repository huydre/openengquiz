import { falseStatement, shuffled } from "./question-generator";
import type { QuestionType, StudyCard, StudyMode } from "./study-types";

export type StudyQuestion = {
  cardId: string;
  type: QuestionType;
  statement?: string;
  pairCardIds?: string[];
};

export function buildQuestions(
  mode: StudyMode,
  cards: StudyCard[],
  count: number,
  quizTypes: QuestionType[],
): StudyQuestion[] {
  const chosen = shuffled(cards).slice(0, Math.min(Math.max(1, count), cards.length));
  const questions: StudyQuestion[] = [];
  for (let index = 0; index < chosen.length;) {
    const card = chosen[index];
    if (mode === "game") {
      questions.push({ cardId: card.id, type: "game" });
      index++;
      continue;
    }
    if (mode === "writing") {
      questions.push({ cardId: card.id, type: "writing" });
      index++;
      continue;
    }
    if (mode === "dictation") {
      questions.push({
        cardId: card.id,
        type: card.example_en && index % 2 ? "dictation_example" : "dictation_term",
      });
      index++;
      continue;
    }
    const type = quizTypes[questions.length % quizTypes.length] ?? "multiple_choice";
    if (type === "match") {
      const pairCardIds = chosen.slice(index, index + 4).map((item) => item.id);
      questions.push({ cardId: card.id, type, pairCardIds });
      index += pairCardIds.length;
      continue;
    }
    const distractor = falseStatement(card, cards);
    questions.push({
      cardId: card.id,
      type,
      statement: type === "true_false" && distractor && index % 2 ? distractor : undefined,
    });
    index++;
  }
  return questions;
}
