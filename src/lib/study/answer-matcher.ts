import { cardDefinition, type StudyAttempt, type StudyCard } from "./study-types";

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\s.!?。！？,;:]+$/u, "")
    .trim();
}

export function matchesAnswer(answer: string, expected: string): boolean {
  return normalizeAnswer(answer) === normalizeAnswer(expected);
}

export function gradeAttempt(attempt: StudyAttempt, card: StudyCard): boolean {
  switch (attempt.question_type) {
    case "multiple_choice":
    case "game":
      return matchesAnswer(attempt.answer, cardDefinition(card));
    case "true_false": {
      if (!attempt.statement || !["true", "false"].includes(attempt.answer)) return false;
      const trueStatement = matchesAnswer(attempt.statement, cardDefinition(card));
      return (attempt.answer === "true") === trueStatement;
    }
    case "dictation_example":
      return Boolean(card.example_en && matchesAnswer(attempt.answer, card.example_en));
    case "learn_type":
    case "fill":
    case "match":
    case "dictation_term":
    case "writing":
      return matchesAnswer(attempt.answer, card.term);
  }
}

export function expectedAnswer(attempt: StudyAttempt, card: StudyCard): string {
  switch (attempt.question_type) {
    case "multiple_choice":
    case "game":
      return cardDefinition(card);
    case "true_false":
      return matchesAnswer(attempt.statement ?? "", cardDefinition(card)) ? "Đúng" : "Sai";
    case "dictation_example":
      return card.example_en ?? card.term;
    default:
      return card.term;
  }
}
