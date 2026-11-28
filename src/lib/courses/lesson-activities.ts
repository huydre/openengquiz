import { z } from "zod";

/**
 * Shared contract for `course_lessons.activity_content` (JSONB) and the
 * per-activity progress rows in `course_activity_progress`. Pure module: no
 * server-only imports so client components can reuse the types and helpers.
 */

const speakingQuestionSchema = z.object({
  en: z.string().trim().min(1).max(400),
  vi: z.string().trim().min(1).max(600),
  part: z.union([z.literal(1), z.literal(3)]),
});

const grammarPointSchema = z.object({
  title: z.string().trim().min(1).max(200),
  explanationVi: z.string().trim().min(1).max(2000),
  exampleEn: z.string().trim().min(1).max(400),
  exampleVi: z.string().trim().min(1).max(600),
});

export const courseActivityContentSchema = z.object({
  /** Exactly 4 speaking prompts shown at activities 1, 3, 4 and 6. */
  speaking: z.array(speakingQuestionSchema).length(4),
  /** Exactly 2 grammar points, one per vocabulary group (activities 2 and 5). */
  grammar: z.array(grammarPointSchema).length(2),
  /** Scenario hint for the AI call activity (7). */
  conversation: z.string().trim().min(1).max(2000),
});

export type CourseActivityContent = z.infer<typeof courseActivityContentSchema>;
export type CourseSpeakingQuestion = z.infer<typeof speakingQuestionSchema>;
export type CourseGrammarPoint = z.infer<typeof grammarPointSchema>;

/** Row shape of `course_activity_progress` as selected by the server loaders. */
export interface CourseActivityProgress {
  lesson_id?: string;
  activity: number;
  small_step: number;
  state: Record<string, unknown> | null;
  completed_at: string | null;
}

export const ACTIVITY_COUNT = 7;
export const VOCAB_ACTIVITIES = [2, 5] as const;
export const VOCAB_SMALL_STEP_COUNT = 18;

export type ActivityKind = "speaking" | "vocabulary" | "call";

export interface ActivityDescriptor {
  /** 1..7, position in the lesson flow. */
  activity: number;
  kind: ActivityKind;
  /** Vietnamese title shown in the activity picker. */
  titleVi: string;
  /** Secondary line: the prompt for speaking, card/grammar summary for vocabulary. */
  subtitle: string;
  /** Total small steps inside the activity (18 for vocabulary, 1 otherwise). */
  smallSteps: number;
}

const SPEAKING_ACTIVITIES = [1, 3, 4, 6] as const;

/**
 * Ordered descriptor list for the 7 activities of a lesson, derived from the
 * parsed activity_content. Speaking activities surface their prompt; the two
 * vocabulary activities surface their word-group summary; the call activity
 * surfaces the conversation scenario.
 */
export function activityDescriptors(content: CourseActivityContent): ActivityDescriptor[] {
  const descriptors: ActivityDescriptor[] = [];
  for (let activity = 1; activity <= ACTIVITY_COUNT; activity += 1) {
    if ((VOCAB_ACTIVITIES as readonly number[]).includes(activity)) {
      const group = activity === 2 ? 0 : 1;
      descriptors.push({
        activity,
        kind: "vocabulary",
        titleVi: `Học từ vựng ${group + 1}`,
        subtitle: "4 từ, 1 ngữ pháp",
        smallSteps: VOCAB_SMALL_STEP_COUNT,
      });
      continue;
    }
    if (activity === 7) {
      descriptors.push({
        activity,
        kind: "call",
        titleVi: "Hội thoại",
        // The scenario text is tutor context; the picker shows a short, stable line.
        subtitle: "Gọi điện với gia sư, dùng từ của bài",
        smallSteps: 1,
      });
      continue;
    }
    const slot = SPEAKING_ACTIVITIES.indexOf(activity as (typeof SPEAKING_ACTIVITIES)[number]);
    const question = content.speaking[slot];
    descriptors.push({
      activity,
      kind: "speaking",
      titleVi: "Nói",
      subtitle: question ? `${question.en} (${question.part === 1 ? "IELTS Part 1" : "IELTS Part 3"})` : "Nói",
      smallSteps: 1,
    });
  }
  return descriptors;
}

/**
 * First activity (1..7) without a completed progress row, or null when every
 * activity is done. Rows may arrive unordered; completion is keyed by
 * `completed_at`.
 */
export function firstUnfinishedActivity(rows: readonly CourseActivityProgress[]): number | null {
  const done = new Set(rows.filter((row) => row.completed_at).map((row) => row.activity));
  for (let activity = 1; activity <= ACTIVITY_COUNT; activity += 1) {
    if (!done.has(activity)) return activity;
  }
  return null;
}
/**
 * Whether `activity` may be opened. All seven activities are clickable as
 * soon as the lesson itself is unlocked; this only validates the 1..7 range.
 */
export function isActivityUnlocked(lessonOpen: boolean, activity: number): boolean {
  return lessonOpen && activity >= 1 && activity <= ACTIVITY_COUNT;
}

/**
 * Lesson-level completion for the course map: a lesson counts as finished
 * only when all seven activities have a completed progress row. Mirrors the
 * `completed` set built by `levelProgress` in course-progress.ts.
 */
export function lessonActivitiesComplete(rows: readonly CourseActivityProgress[]): boolean {
  const done = new Set(rows.filter((row) => row.completed_at).map((row) => row.activity));
  return done.size === ACTIVITY_COUNT;
}

/** Progress fraction 0..1 across the 7 activities for ring/bar rendering. */
export function activityProgressFraction(rows: readonly CourseActivityProgress[]): number {
  const done = new Set(rows.filter((row) => row.completed_at).map((row) => row.activity));
  return done.size / ACTIVITY_COUNT;
}

// ---------------------------------------------------------------------------
// Vocabulary activity: 18 small steps
// ---------------------------------------------------------------------------

export type VocabStepKind = "review" | "recall" | "fill" | "speak" | "shadow";

export interface VocabStepDescriptor {
  /** 1..18, the `small_step` stored in course_activity_progress. */
  step: number;
  kind: VocabStepKind;
  /** Index into the 4 word cards of the current group (0..3), when applicable. */
  cardIndex?: number;
  /** Index into the group's grammar point (always 0 for the single grammar card). */
  grammarIndex?: number;
}

/**
 * Ordered 18-step plan for a vocabulary activity (group A at activity 2,
 * group B at activity 5). Steps 1-5 review the 4 cards plus the grammar card;
 * 6-9 recall meanings until mastered; 10/12/14/16 fill-in-the-blank and
 * 11/13/15/17 speak-with-word alternate per card; 18 is grammar shadowing.
 */
export function vocabStepPlan(): VocabStepDescriptor[] {
  const steps: VocabStepDescriptor[] = [];
  for (let card = 0; card < 4; card += 1) {
    steps.push({ step: steps.length + 1, kind: "review", cardIndex: card });
  }
  steps.push({ step: 5, kind: "review", grammarIndex: 0 });
  for (let card = 0; card < 4; card += 1) {
    steps.push({ step: steps.length + 1, kind: "recall", cardIndex: card });
  }
  for (let card = 0; card < 4; card += 1) {
    steps.push({ step: steps.length + 1, kind: "fill", cardIndex: card });
    steps.push({ step: steps.length + 1, kind: "speak", cardIndex: card });
  }
  steps.push({ step: 18, kind: "shadow", grammarIndex: 0 });
  return steps;
}

export const VOCAB_STEP_PLAN: readonly VocabStepDescriptor[] = vocabStepPlan();

export function vocabStepDescriptor(step: number): VocabStepDescriptor | null {
  return VOCAB_STEP_PLAN.find((entry) => entry.step === step) ?? null;
}

// ---------------------------------------------------------------------------
// Recall queue (steps 6-9): revisit wrong answers until all 4 are mastered
// ---------------------------------------------------------------------------

export interface RecallItem {
  cardIndex: number;
  /** Number of times this card has been answered correctly in a row. */
  streak: number;
  /** Times answered incorrectly; drives re-queue ordering. */
  misses: number;
  /** Manual override: learner claimed a correct answer via "Tôi trả lời đúng". */
  overridden?: boolean;
}

export interface RecallQueueState {
  /** Cards still in the queue, in serving order. */
  queue: RecallItem[];
  /** Cards already mastered (streak threshold reached or overridden). */
  mastered: RecallItem[];
}

export const RECALL_MASTERY_STREAK = 2;

/** Fresh queue for the 4 cards of a vocabulary group. */
export function createRecallQueue(cardIndexes: readonly number[] = [0, 1, 2, 3]): RecallQueueState {
  return {
    queue: cardIndexes.map((cardIndex) => ({ cardIndex, streak: 0, misses: 0 })),
    mastered: [],
  };
}

/**
 * Records one recall answer. Correct answers grow the streak; reaching
 * RECALL_MASTERY_STREAK (or a manual override) moves the card to `mastered`.
 * Wrong answers reset the streak, bump misses and push the card to the back
 * of the queue so it is revisited after the others.
 */
export function recordRecallAnswer(
  state: RecallQueueState,
  cardIndex: number,
  correct: boolean,
  options?: { override?: boolean },
): RecallQueueState {
  const existing = state.queue.find((item) => item.cardIndex === cardIndex)
    ?? state.mastered.find((item) => item.cardIndex === cardIndex)
    ?? { cardIndex, streak: 0, misses: 0 };
  const queue = state.queue.filter((item) => item.cardIndex !== cardIndex);
  const mastered = state.mastered.filter((item) => item.cardIndex !== cardIndex);

  if (correct || options?.override) {
    const streak = options?.override ? RECALL_MASTERY_STREAK : existing.streak + 1;
    const item: RecallItem = { ...existing, streak, overridden: options?.override || existing.overridden };
    if (streak >= RECALL_MASTERY_STREAK || options?.override) {
      return { queue, mastered: [...mastered, item] };
    }
    // Correct but not yet mastered: keep original position by reinserting at front.
    return { queue: [item, ...queue], mastered };
  }

  const item: RecallItem = { ...existing, streak: 0, misses: existing.misses + 1 };
  // Wrong answers go to the back so unseen cards are served first.
  return { queue: [...queue, item], mastered };
}

/** Next card to ask: front of the queue, or null when everything is mastered. */
export function nextRecallItem(state: RecallQueueState): RecallItem | null {
  return state.queue[0] ?? null;
}

/** Mastery progress "n / 4 mastered" for the recall phase UI. */
export function recallMasteryCount(state: RecallQueueState, total = 4): { mastered: number; total: number } {
  return { mastered: state.mastered.length, total };
}

// ---------------------------------------------------------------------------
// Vietnamese meaning matching (recall step answers)
// ---------------------------------------------------------------------------

/** Normalize case, punctuation and spaces without folding Vietnamese marks. */
export function normalizeMeaning(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance capped early for short strings. */
function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = temp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

/**
 * Splits a stored Vietnamese definition into its listed senses. Seed data
 * separates alternates with commas, semicolons or slashes; each piece is a
 * valid answer on its own.
 */
export function vietnameseMeanings(definitionVi: string): string[] {
  return definitionVi
    .split(/[;,\/]/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const MEANING_FILLER: Record<string, true> = {
  việc: true, sự: true, cái: true, người: true, một: true, các: true, những: true,
  hoặc: true, và: true, của: true, để: true, là: true, được: true, khác: true, phần: true,
  quả: true, trái: true,
};
const MEANING_FILLER_ASCII = Object.fromEntries(Object.keys(MEANING_FILLER).map((word) => [stripMeaningMarks(word), true as const]));
const NEGATION: Record<string, true> = { không: true, chẳng: true, chưa: true, đừng: true, khong: true, chang: true, chua: true, dung: true };

function stripMeaningMarks(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
}

function meaningSyllables(value: string, filler: Readonly<Record<string, true>>): string[] {
  return value.split(" ").filter((word) => /\p{L}/u.test(word) && !Object.hasOwn(filler, word));
}

/**
 * `expectedVi` can list senses separated by comma, semicolon or slash.
 * `alternates` can supply the English definition and synonyms.
 * Only `unsure` should fall through to semantic grading.
 */
export function gradeMeaningLocally(
  answer: string,
  expectedVi: string,
  alternates: readonly string[] = [],
): "correct" | "wrong" | "unsure" {
  const normalized = normalizeMeaning(answer);
  if (!normalized) return "wrong";
  const senses = vietnameseMeanings(expectedVi).map(normalizeMeaning).filter(Boolean);
  const candidates = [...senses, ...alternates.map(normalizeMeaning).filter(Boolean)];
  const unaccented = stripMeaningMarks(normalized) === normalized;
  for (const candidate of candidates) {
    if (normalized === candidate || (unaccented && normalized === stripMeaningMarks(candidate))) return "correct";
    // Allow near edits only for reasonably long answers to avoid false hits.
    const tolerance = candidate.length >= 12 ? 2 : candidate.length >= 6 ? 1 : 0;
    if (tolerance > 0 && editDistance(normalized, candidate, tolerance) <= tolerance) return "correct";
  }
  const words = meaningSyllables(normalized, unaccented ? MEANING_FILLER_ASCII : MEANING_FILLER);
  if (!words.length || normalized.length < 2) return "wrong";

  let overlap = false;
  let secondary = false;
  for (const sense of senses) {
    // Filter before folding so "là" and "lá" do not become the same filler.
    const content = meaningSyllables(sense, MEANING_FILLER);
    const compared = unaccented ? content.map(stripMeaningMarks) : content;
    overlap ||= words.some((word) => compared.includes(word));
    // ponytail: trust head phrases; exact matches deeper in a gloss are supporting details.
    if (words.length === 1 && (Object.hasOwn(NEGATION, words[0]) || compared[1] === "hơn" || compared[1] === "hon")) continue;
    if (words.every((word, index) => word === compared[index])) return "correct";
    secondary ||= compared.some((word, start) => start > 0 && word === words[0]
      && words.every((syllable, index) => syllable === compared[start + index]));
  }
  if (secondary) return "wrong";
  if (!overlap) {
    overlap = candidates.slice(senses.length).some((candidate) => meaningSyllables(candidate, MEANING_FILLER)
      .some((word) => words.includes(unaccented ? stripMeaningMarks(word) : word)));
  }
  return overlap ? "unsure" : "wrong";
}

export function matchVietnameseMeaning(answer: string, expectedVi: string, alternates: readonly string[] = []): boolean {
  return gradeMeaningLocally(answer, expectedVi, alternates) === "correct";
}

// ---------------------------------------------------------------------------
// Fill-in-the-blank (steps 10, 12, 14, 16)
// ---------------------------------------------------------------------------

/** Normalizes a typed fill answer: case, punctuation, whitespace, inflection suffixes. */
export function normalizeFillAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[-\u2010-\u2015]/g, " ")
    .replace(/[\p{P}\p{S}]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Accepts the exact term plus common inflections (plural -s/-es/-ies, past
 * -ed/-ied, -ing, and a trailing possessive). Multiword terms compare as a
 * normalized phrase.
 */
export function isFillAnswerCorrect(answer: string, term: string): boolean {
  const given = normalizeFillAnswer(answer);
  const expected = normalizeFillAnswer(term);
  if (!given || !expected) return false;
  if (given === expected) return true;

  const words = expected.split(" ");
  const last = words[words.length - 1];
  const variants = new Set<string>([expected]);

  // Inflect only the final word of the term.
  const inflect = (base: string): string[] => {
    const out = [base];
    if (base.endsWith("y") && base.length > 2 && !"aeiou".includes(base[base.length - 2])) {
      out.push(`${base.slice(0, -1)}ies`, `${base.slice(0, -1)}ied`, `${base.slice(0, -1)}ying`);
    }
    if (base.endsWith("e")) {
      out.push(`${base}d`, `${base}ing`);
    } else {
      out.push(`${base}s`, `${base}es`, `${base}ed`, `${base}ing`, `${base}d`);
      if (base.length > 2 && !"aeiou".includes(base[base.length - 1]) && "aeiou".includes(base[base.length - 2])) {
        out.push(`${base}${base[base.length - 1]}ed`, `${base}${base[base.length - 1]}ing`);
      }
    }
    out.push(`${base}'s`, `${base}s'`);
    return out;
  };

  for (const form of inflect(last)) {
    variants.add([...words.slice(0, -1), form].join(" "));
  }
  if (variants.has(given)) return true;

  // Small typo tolerance for longer single-word answers only; multiword
  // phrases stay strict to avoid matching unrelated sentences.
  if (!expected.includes(" ") && given.length >= 5 && expected.length >= 5) {
    return editDistance(given, expected, 2) <= 2;
  }
  return false;
}

export interface ClozeResult {
  /** Sentence with the term replaced by a blank marker. */
  before: string;
  after: string;
  /** The removed term, for answer checking. */
  answer: string;
}

/**
 * Builds a cloze from an example sentence by removing the first whole-word
 * occurrence of `term`. Matches the literal term plus common inflections of
 * its final word (walk/walked/walking, city/cities, check in/checks in), so
 * the blanked surface form is whatever the sentence actually used. Returns
 * null when nothing matches, so callers can fall back to another example.
 */
export function buildCloze(sentence: string, term: string): ClozeResult | null {
  const trimmed = term.trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/u);
  const last = words[words.length - 1];
  // Candidate surface forms: the literal term plus common inflections of its
  // final word (walk/walks/walked/walking, city/cities, study/studies/studying).
  const surfaces = new Set<string>([trimmed]);
  const inflect = (base: string): string[] => {
    const out = [base];
    if (base.endsWith("y") && base.length > 2 && !"aeiou".includes(base[base.length - 2])) {
      out.push(`${base.slice(0, -1)}ies`, `${base.slice(0, -1)}ied`, `${base.slice(0, -1)}ying`);
    }
    if (base.endsWith("e")) {
      out.push(`${base}d`, `${base}ing`);
    } else {
      out.push(`${base}s`, `${base}es`, `${base}ed`, `${base}ing`, `${base}d`);
      if (base.length > 2 && !"aeiou".includes(base[base.length - 1]) && "aeiou".includes(base[base.length - 2])) {
        out.push(`${base}${base[base.length - 1]}ed`, `${base}${base[base.length - 1]}ing`);
      }
    }
    out.push(`${base}'s`, `${base}s'`);
    return out;
  };
  for (const form of inflect(last)) {
    surfaces.add([...words.slice(0, -1), form].join(" "));
  }
  // Also inflect the first word for phrasal verbs like "check in" -> "checks in".
  if (words.length > 1) {
    const first = words[0];
    for (const form of inflect(first)) {
      surfaces.add([form, ...words.slice(1)].join(" "));
    }
  }
  // Sort longest first so multiword inflections win over shorter prefixes.
  const ordered = [...surfaces].sort((a, b) => b.length - a.length);
  for (const candidate of ordered) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const match = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=[^\\p{L}\\p{N}]|$)`, "iu").exec(sentence);
    if (!match) continue;
    const start = match.index + match[1].length;
    const end = start + match[2].length;
    return {
      before: sentence.slice(0, start).trimEnd(),
      after: sentence.slice(end).trimStart(),
      answer: match[2],
    };
  }
  return null;
}
