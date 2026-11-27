export const LESSON_STEPS = [1, 2, 3, 4, 5, 6, 7] as const;
export type LessonStep = (typeof LESSON_STEPS)[number];

export type LessonAction = "advance" | "answer" | "retry" | "ideas" | "tone" | "translate";
export type FeedbackTone = "serious" | "friendly" | "funny";
export const FEEDBACK_TONES: FeedbackTone[] = ["serious", "friendly", "funny"];
export interface LessonIdea {
  vi: string;
  en: string;
}

export interface LessonCorrection {
  original: string;
  replacement: string;
  reason: string;
}

/** Structured feedback for one warmup answer (first or second attempt). */
export interface LessonFeedback {
  /** Overall score 0..1 plus per-dimension scores. */
  score: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
  /** CEFR labels derived from the scores via cefrForScore. */
  cefr: string;
  grammarCefr: string;
  vocabularyCefr: string;
  coherenceCefr: string;
  exampleCefr: string;
  /** Tutor comment in Vietnamese, written in the saved feedback tone. */
  comment_vi: string;
  /** Higher-level model answer in English with highlighted phrases in `highlights`. */
  example: string;
  /** Vietnamese translation of `example`. */
  example_vi: string;
  /** Phrases or lesson terms to highlight inside `example`. */
  highlights: string[];
  corrections: LessonCorrection[];
  /** Lesson terms detected in this transcript. */
  used: string[];
  /** Lesson terms used here but not in the previous attempt (second only). */
  newTerms: string[];
  /** score minus previous attempt score (second only, else null). */
  delta: number | null;
}

export interface LessonAttempt {
  id: string;
  phase: "first" | "second";
  transcript: string;
  /** Pronunciation score when answered by voice; null for typed answers and legacy rows. */
  pron: { score: number | null } | null;
  feedback: LessonFeedback | null;
  createdAt: string;
}

export interface LessonComparison {
  first: LessonAttempt | null;
  second: LessonAttempt | null;
  /** second.score - first.score when both exist. */
  delta: number | null;
  newTerms: string[];
  usedFirst: string[];
  usedSecond: string[];
}

export interface LessonCallState {
  threadId: string;
  scenario: "course";
  /** True when the thread already has a summary (call ended, advance may be retried). */
  finished: boolean;
  messages: { role: "user" | "assistant"; content: string }[];
}

/** Everything the lesson player UI needs, loaded server-side. */
export interface LessonPlayerState {
  lessonId: string;
  /** Persisted step 1..7; completed lessons keep their last step with complete=true. */
  step: LessonStep;
  complete: boolean;
  /** 1-based part and lesson positions inside the level, for "Phần N • Bài M". */
  partPosition: number;
  lessonPosition: number;
  /** CEFR of the lesson's level (A1..C2). */
  cefr: string;
  warmupTranscript: string | null;
  warmupQuestionVi: string | null;
  /** Global per-user feedback tone (profiles.feedback_tone). */
  tone: FeedbackTone;
  /** All warmup speaking attempts for this lesson, newest first. */
  attempts: LessonAttempt[];
  /** Attempts pointed to by lesson_progress; null until that phase is answered. */
  first: LessonAttempt | null;
  second: LessonAttempt | null;
  comparison: LessonComparison | null;
  ideas: LessonIdea[] | null;
  /** Terms the learner struggled with in step 6, sent with the advance payload. */
  weakTerms: string[];
  /** Step 7 subphase: true once the learner enters the call view. */
  calling: boolean;
  /** Narration script owned by the Narration agent; passed through untouched. */
  narration: unknown;
  /** Latest course call thread for resume at step 7, or null. */
  call: LessonCallState | null;
}

/**
 * Maps a 0..1 score to a CEFR label for display. Thresholds:
 * >=0.90 C2, >=0.80 C1, >=0.65 B2, >=0.50 B1, >=0.35 A2, otherwise A1.
 */
export function cefrForScore(score: number): string {
  if (score >= 0.9) return "C2";
  if (score >= 0.8) return "C1";
  if (score >= 0.65) return "B2";
  if (score >= 0.5) return "B1";
  if (score >= 0.35) return "A2";
  return "A1";
}

/** Builds the CEFR fields of LessonFeedback from raw dimension scores. */
export function feedbackCefrs(scores: { score: number; grammar: number; vocabulary: number; coherence: number; example?: number }) {
  return {
    cefr: cefrForScore(scores.score),
    grammarCefr: cefrForScore(scores.grammar),
    vocabularyCefr: cefrForScore(scores.vocabulary),
    coherenceCefr: cefrForScore(scores.coherence),
    exampleCefr: cefrForScore(scores.example ?? scores.score),
  };
}

/** Response payload of POST /api/courses/lessons/[lessonId]. */
export interface LessonPlayerResponse {
  step: LessonStep;
  complete: boolean;
  attempt?: LessonAttempt;
  ideas?: LessonIdea[];
  comparison?: LessonComparison;
  translation?: string;
}
