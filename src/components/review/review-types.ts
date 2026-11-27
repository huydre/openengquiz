export type ReviewRating = 1 | 2 | 3 | 4;

export type ReviewInterval = { dueAt: string; label: string };

export type ReviewItem = {
  cardId: string;
  setId: string;
  setTitle: string;
  term: string;
  ipa: string | null;
  partOfSpeech: string | null;
  definitionVi: string | null;
  definitionEn: string | null;
  exampleEn: string | null;
  exampleVi: string | null;
  isNew: boolean;
  intervals: Record<ReviewRating, ReviewInterval>;
};
