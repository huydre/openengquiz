import type { QuestionType, StudyCard } from "./study-types";

export type LearnStage = "recognition" | "recall" | "review";
export type LearnQuestionType = Extract<
  QuestionType,
  "multiple_choice" | "match" | "learn_type" | "fill" | "dictation_term"
>;
export type LearnStep = { cardId: string; stage: LearnStage; type: LearnQuestionType };

export type LearnState = {
  queue: LearnStep[];
  remaining: string[];
  mastered: string[];
  batch: number;
  batchSize: number;
  cards: StudyCard[];
};

const RECOGNITION_TYPES: LearnQuestionType[] = ["multiple_choice", "match"];
const RECALL_TYPES: LearnQuestionType[] = ["learn_type", "fill", "dictation_term"];

/**
 * A fill-in-the-blank step is only offered when the example sentence really contains the
 * term. The check mirrors the Prompt fallback in study-question.tsx: the term may end in
 * punctuation the sentence lacks ("let's play a game!"), so trailing punctuation is ignored.
 */
function exampleHasTerm(card: StudyCard): boolean {
  const core = card.term.trim().replace(/[\s.!?,;:]+$/u, "");
  return Boolean(card.example_en && core && card.example_en.toLowerCase().includes(core.toLowerCase()));
}

/** Picks the question form for one learn step. Pure: randomness comes from `random`. */
export function pickLearnType(
  stage: "recognition" | "recall",
  card: StudyCard,
  random: () => number = Math.random,
): LearnQuestionType {
  const options = stage === "recognition"
    ? RECOGNITION_TYPES
    : RECALL_TYPES.filter((type) => type !== "fill" || exampleHasTerm(card));
  const fallback: LearnQuestionType = stage === "recognition" ? "multiple_choice" : "learn_type";
  return options[Math.floor(random() * options.length)] ?? fallback;
}

function stepFor(card: StudyCard, stage: LearnStage, random: () => number): LearnStep {
  return {
    cardId: card.id,
    stage,
    type: pickLearnType(stage === "recall" ? "recall" : "recognition", card, random),
  };
}

export function createLearnState(
  cards: StudyCard[],
  batchSize = 6,
  random: () => number = Math.random,
): LearnState {
  const unique = [...new Map(cards.map((card) => [card.id, card])).values()];
  const size = Math.max(1, Math.min(7, batchSize));
  return {
    queue: unique.slice(0, size).map((card) => stepFor(card, "recognition", random)),
    remaining: unique.slice(size).map((card) => card.id),
    mastered: [],
    batch: unique.length ? 1 : 0,
    batchSize: size,
    cards: unique,
  };
}

export function advanceLearn(
  state: LearnState,
  correct: boolean,
  random: () => number = Math.random,
): LearnState {
  const [current, ...queue] = state.queue;
  if (!current) return state;
  const mastered = [...state.mastered];
  const card = state.cards.find((item) => item.id === current.cardId);

  if (current.stage === "review") {
    // A correct review changes nothing. A wrong one demotes the card: it leaves `mastered`
    // and has to pass recognition then recall again.
    if (!correct) {
      const index = mastered.indexOf(current.cardId);
      if (index >= 0) mastered.splice(index, 1);
      if (card) queue.push(stepFor(card, "recognition", random));
    }
  } else if (card) {
    if (current.stage === "recognition") {
      queue.push(stepFor(card, correct ? "recall" : "recognition", random));
    } else if (correct) {
      if (!mastered.includes(current.cardId)) mastered.push(current.cardId);
    } else {
      queue.push(stepFor(card, "recall", random));
    }
  }

  if (queue.length || !state.remaining.length) {
    return { ...state, queue, mastered };
  }

  const nextCards = state.remaining.slice(0, state.batchSize)
    .map((id) => state.cards.find((item) => item.id === id))
    .filter((item): item is StudyCard => Boolean(item));
  const batchQueue = nextCards.map((item) => stepFor(item, "recognition", random));

  // Once more than 30% of the cards are mastered, each new batch interleaves about 15%
  // (at least one) mastered cards as review steps, like OpenQuiz.
  const reviewCount = mastered.length > state.cards.length * 0.3
    ? Math.max(1, Math.round(nextCards.length * 0.15))
    : 0;
  const reviewPool = [...mastered];
  for (let index = 0; index < reviewCount && reviewPool.length; index++) {
    const pick = reviewPool.splice(Math.floor(random() * reviewPool.length), 1)[0];
    const reviewCard = state.cards.find((item) => item.id === pick);
    if (!reviewCard) continue;
    const position = Math.floor(random() * (batchQueue.length + 1));
    batchQueue.splice(position, 0, stepFor(reviewCard, "review", random));
  }

  return {
    ...state,
    queue: batchQueue,
    remaining: state.remaining.slice(state.batchSize),
    mastered,
    batch: state.batch + 1,
  };
}
