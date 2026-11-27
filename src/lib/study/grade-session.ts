import { gradeAttempt } from "./answer-matcher";
import { cardDefinition, type StudyAttempt, type StudyCard, type StudyMode } from "./study-types";

const allowedTypes: Record<StudyMode, StudyAttempt["question_type"][]> = {
  learn: ["multiple_choice", "learn_type"],
  quiz: ["multiple_choice", "true_false", "fill", "match"],
  dictation: ["dictation_term", "dictation_example"],
  writing: ["writing"],
  game: ["game"],
};

export function gradeStudySession(
  mode: StudyMode,
  cards: StudyCard[],
  attempts: StudyAttempt[],
) {
  if (!attempts.length || attempts.length > 500) throw new Error("Số câu trả lời không hợp lệ.");
  const byId = new Map(cards.map((card) => [card.id, card]));
  const graded = attempts.map((attempt) => {
    const card = byId.get(attempt.card_id);
    if (!card || !allowedTypes[mode].includes(attempt.question_type)) {
      throw new Error("Câu hỏi không thuộc bộ từ hoặc chế độ này.");
    }
    if (attempt.question_type === "true_false") {
      const validStatements = cards.map(cardDefinition);
      if (!attempt.statement || !validStatements.includes(attempt.statement)) {
        throw new Error("Mệnh đề đúng/sai không hợp lệ.");
      }
    }
    return { ...attempt, correct: gradeAttempt(attempt, card) };
  });
  if (mode === "learn") {
    const choicePassed = new Set<string>();
    const mastered = new Set<string>();
    for (const attempt of graded) {
      if (attempt.question_type === "multiple_choice" && attempt.correct) {
        choicePassed.add(attempt.card_id);
      }
      if (attempt.question_type === "learn_type" && attempt.correct && choicePassed.has(attempt.card_id)) {
        mastered.add(attempt.card_id);
      }
    }
    if (mastered.size !== cards.length) throw new Error("Chưa hoàn thành tất cả thẻ.");
  }
  let combo = 0;
  const score = mode === "game"
    ? graded.reduce((sum, attempt) => {
      combo = attempt.correct ? combo + 1 : 0;
      return sum + (attempt.correct ? 100 + Math.min(combo - 1, 5) * 20 : 0);
    }, 0)
    : graded.filter((attempt) => attempt.correct).length;
  return {
    attempts: graded.map(({ card_id, question_type, answer, correct }) => ({
      card_id, question_type, answer, correct,
    })),
    score,
    total: mode === "game" ? graded.length * 200 : graded.length,
  };
}
