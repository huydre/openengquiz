import { gradeAttempt } from "./answer-matcher";
import { cardDefinition, type StudyAttempt, type StudyCard, type StudyMode } from "./study-types";

const allowedTypes: Record<StudyMode, StudyAttempt["question_type"][]> = {
  learn: ["multiple_choice", "match", "learn_type", "fill", "dictation_term"],
  quiz: ["multiple_choice", "true_false", "fill", "match"],
  dictation: ["dictation_term", "dictation_example"],
  writing: ["writing"],
  game: ["game"],
};

const learnRecognitionTypes: StudyAttempt["question_type"][] = ["multiple_choice", "match"];
const learnRecallTypes: StudyAttempt["question_type"][] = ["learn_type", "fill", "dictation_term"];

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
    // A card is mastered once a correct recognition answer (multiple_choice or match) is
    // followed by a correct recall answer (learn_type, fill or dictation_term). Reviews are
    // not flagged by the client: a recognition answer on an already-mastered card is a
    // review, so a wrong one demotes the card and it must pass recognition then recall
    // again, while a correct one keeps it mastered.
    const recognitionPassed = new Set<string>();
    const mastered = new Set<string>();
    for (const attempt of graded) {
      if (learnRecognitionTypes.includes(attempt.question_type)) {
        if (attempt.correct) {
          recognitionPassed.add(attempt.card_id);
        } else {
          recognitionPassed.delete(attempt.card_id);
          mastered.delete(attempt.card_id);
        }
      } else if (learnRecallTypes.includes(attempt.question_type)) {
        if (attempt.correct) {
          if (recognitionPassed.has(attempt.card_id)) mastered.add(attempt.card_id);
        } else if (mastered.has(attempt.card_id)) {
          mastered.delete(attempt.card_id);
          recognitionPassed.delete(attempt.card_id);
        }
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
