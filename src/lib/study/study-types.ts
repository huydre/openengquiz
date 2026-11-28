export type StudyMode = "learn" | "quiz" | "dictation" | "writing" | "game";

export type StudyCard = {
  id: string;
  term: string;
  definition_vi: string | null;
  definition_en: string | null;
  example_en: string | null;
  /** Shown under English answer choices; optional because grading never needs it. */
  ipa?: string | null;
};

export type QuestionType =
  | "multiple_choice"
  | "learn_type"
  | "true_false"
  | "fill"
  | "match"
  | "dictation_term"
  | "dictation_example"
  | "writing"
  | "game";

export type StudyAttempt = {
  card_id: string;
  question_type: QuestionType;
  answer: string;
  statement?: string;
};

export function cardDefinition(card: StudyCard): string {
  return card.definition_vi?.trim() || card.definition_en?.trim() || card.term;
}
