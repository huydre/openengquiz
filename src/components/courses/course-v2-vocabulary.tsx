"use client";

import { ArrowLeft, ArrowRight, Check, Keyboard, Languages, Mic, RotateCcw, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { enrollLearnedCards } from "@/app/(app)/sets/review-actions";
import { AudioRecorder, type RecordedAudio } from "@/components/audio/audio-recorder";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import {
  buildCloze,
  createRecallQueue,
  isFillAnswerCorrect,
  matchVietnameseMeaning,
  nextRecallItem,
  normalizeMeaning,
  recallMasteryCount,
  recordRecallAnswer,
  vocabStepDescriptor,
  type CourseGrammarPoint,
  type RecallQueueState,
} from "@/lib/courses/lesson-activities";
import type { FeedbackTone, LessonFeedback, LessonIdea } from "@/lib/courses/lesson-player-types";
import type { PronunciationResult } from "@/lib/speech/client";
import { playTts, type TtsSpeed } from "@/lib/speech/play-tts";
import { pronunciationHint } from "@/lib/speech/pronunciation-hints";
import type { LessonCard } from "@/components/vocab/vocab-lesson";
import { FlipFlashcard } from "@/components/vocab/flip-flashcard";
import { PASS_SCORE } from "@/components/vocab/pronounce-step";
import { cn } from "@/lib/utils";
import { CourseV2Speaking } from "./course-v2-speaking";
import type { ActivityPostFn } from "./use-lesson-activities";

const panel = "space-y-5 rounded-3xl border-2 bg-card p-5 sm:p-7";
const percent = (score: number) => Math.round(score * 100);

/** POST helper shared with the lesson shell (see use-lesson-activities.ts). */
export type { ActivityPostFn };

export interface CourseV2VocabularyProps {
  lessonId: string;
  activity: 2 | 5;
  group: "A" | "B";
  /** Exactly the 4 word cards of this group, in lesson order. */
  cards: LessonCard[];
  grammar: CourseGrammarPoint | null;
  speech: boolean;
  ai: boolean;
  tone: FeedbackTone;
  /** Persisted small_step (1..18) to resume at. */
  initialStep: number;
  /** Persisted checkpoint state blob, or null on first visit. */
  initialState: Record<string, unknown> | null;
  busy: boolean;
  post: ActivityPostFn;
}

// ---------------------------------------------------------------------------
// Persisted checkpoint state (JSON-safe; stored in course_activity_progress.state)
// ---------------------------------------------------------------------------

interface ReviewState {
  /** 0..4 word cards reviewed so far; 4 means the grammar card is next. */
  cardIndex: number;
  flipped: boolean;
  /** "card" shows the flip card; "speak" asks the learner to say the word. */
  phase: "card" | "speak";
  /** Card ids whose pronunciation step already finished (resume skips them). */
  speakDone: string[];
}

interface RecallState {
  queue: RecallQueueState;
}

interface FillState {
  /** Index into the 4 fill slots (steps 10,12,14,16). */
  index: number;
  results: Record<string, "correct" | "wrong" | "skipped">;
}

interface SpeakState {
  /** Index into the 4 word-speaking slots (steps 11,13,15,17). */
  index: number;
  results: Record<string, { attemptId?: string; usedTarget?: boolean }>;
}

interface ShadowState {
  done: boolean;
  typed?: boolean;
  pronScore?: number | null;
}

interface VocabState {
  review: ReviewState;
  recall: RecallState | null;
  fill: FillState;
  speak: SpeakState;
  shadow: ShadowState;
}

function freshState(): VocabState {
  return {
    review: { cardIndex: 0, flipped: false, phase: "card", speakDone: [] },
    recall: null,
    fill: { index: 0, results: {} },
    speak: { index: 0, results: {} },
    shadow: { done: false },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function restoreState(raw: Record<string, unknown> | null, cardCount: number): VocabState {
  const base = freshState();
  if (!raw) return base;
  const review = asRecord(raw.review);
  if (review) {
    const cardIndex = typeof review.cardIndex === "number" ? Math.min(Math.max(Math.trunc(review.cardIndex), 0), cardCount) : 0;
    base.review = {
      cardIndex,
      flipped: review.flipped === true,
      phase: review.phase === "speak" ? "speak" : "card",
      speakDone: asStringArray(review.speakDone),
    };
  }
  const recall = asRecord(raw.recall);
  if (recall && Array.isArray(recall.queue)) {
    // Rebuild the recall queue from the persisted item list; malformed entries drop out.
    const queue = (recall.queue as unknown[])
      .map((item) => {
        const row = asRecord(item);
        const cardIndex = row && typeof row.cardIndex === "number" ? Math.trunc(row.cardIndex) : -1;
        if (cardIndex < 0 || cardIndex >= cardCount) return null;
        return {
          cardIndex,
          streak: typeof row?.streak === "number" ? row.streak : 0,
          misses: typeof row?.misses === "number" ? row.misses : 0,
          ...(row?.overridden === true ? { overridden: true } : {}),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const masteredRaw = Array.isArray((recall as { mastered?: unknown }).mastered)
      ? ((recall as { mastered: unknown[] }).mastered)
      : [];
    const mastered = masteredRaw
      .map((item) => {
        const row = asRecord(item);
        const cardIndex = row && typeof row.cardIndex === "number" ? Math.trunc(row.cardIndex) : -1;
        if (cardIndex < 0 || cardIndex >= cardCount) return null;
        return {
          cardIndex,
          streak: typeof row?.streak === "number" ? row.streak : 2,
          misses: typeof row?.misses === "number" ? row.misses : 0,
          ...(row?.overridden === true ? { overridden: true } : {}),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (queue.length || mastered.length) base.recall = { queue: { queue, mastered } };
  }
  const fill = asRecord(raw.fill);
  if (fill) {
    base.fill = {
      index: typeof fill.index === "number" ? Math.min(Math.max(Math.trunc(fill.index), 0), 4) : 0,
      results: (asRecord(fill.results) ?? {}) as FillState["results"],
    };
  }
  const speak = asRecord(raw.speak);
  if (speak) {
    base.speak = {
      index: typeof speak.index === "number" ? Math.min(Math.max(Math.trunc(speak.index), 0), 4) : 0,
      results: (asRecord(speak.results) ?? {}) as SpeakState["results"],
    };
  }
  const shadow = asRecord(raw.shadow);
  if (shadow) {
    base.shadow = {
      done: shadow.done === true,
      typed: shadow.typed === true ? true : shadow.typed === false ? false : undefined,
      pronScore: typeof shadow.pronScore === "number" ? shadow.pronScore : shadow.pronScore === null ? null : undefined,
    };
  }
  return base;
}

function serializeState(state: VocabState): Record<string, unknown> {
  return {
    review: state.review,
    recall: state.recall,
    fill: state.fill,
    speak: state.speak,
    shadow: state.shadow,
  };
}

// ---------------------------------------------------------------------------
// Step helpers (pure, exported for tests)
// ---------------------------------------------------------------------------

/** Maps a persisted small_step (1..18) to its descriptor kind via the shared plan. */
export function vocabStepKind(step: number) {
  return vocabStepDescriptor(step)?.kind ?? null;
}

/**
 * Next persisted step after finishing `step`. Recall (6-9) is the only phase that
 * can repeat: while the queue still has cards the step stays put; once every card
 * is mastered it advances to step 10. Every other step moves forward by one.
 */
export function nextVocabStep(step: number, recallDone: boolean, masteredCount = 0): number {
  if (step >= 6 && step <= 9) {
    // Recall advances one step per mastered card (6->7->8->9->10); missed words stay.
    if (recallDone) return 10;
    return Math.min(6 + masteredCount, 9);
  }
  return Math.min(step + 1, 18);
}

/** Vietnamese alternates for meaning matching: definition_en plus synonyms. */
function meaningAlternates(card: LessonCard): string[] {
  return [card.definition_en ?? "", ...(card.synonyms ?? [])].filter((value): value is string => Boolean(value?.trim()));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CourseV2Vocabulary({
  lessonId, activity, group, cards, grammar, speech, ai, tone, initialStep, initialState, busy, post,
}: CourseV2VocabularyProps) {
  const cardCount = Math.min(cards.length, 4);
  const [step, setStep] = useState(() => Math.min(Math.max(initialStep, 1), 18));
  const [state, setState] = useState<VocabState>(() => restoreState(initialState, cardCount));
  const [localError, setLocalError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const pending = useRef(false);

  const descriptor = vocabStepDescriptor(step);
  const kind = descriptor?.kind ?? "review";

  /** Persist `next` as the new small_step with the current state snapshot. Returns true on success. */
  async function checkpoint(next: number, snapshot: VocabState): Promise<boolean> {
    if (pending.current || busy) return false;
    pending.current = true;
    setLocalError("");
    try {
      await post("checkpoint", activity, next, { previousStep: step, state: serializeState(snapshot) });
      setStep(next);
      setState(snapshot);
      return true;
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Chưa lưu được tiến độ.");
      return false;
    } finally {
      pending.current = false;
    }
  }

  /** Advance one step, persisting the transition. */
  function advance(snapshot: VocabState = state) {
    const recallDone = kind === "recall" ? nextRecallItem(snapshot.recall?.queue ?? createRecallQueue()) === null : true;
    const masteredCount = snapshot.recall?.queue.mastered.length ?? 0;
    const next = nextVocabStep(step, recallDone, masteredCount);
    void checkpoint(next, snapshot);
  }

  /** Finish the whole activity: enroll this group's cards, then mark complete. */
  async function finish() {
    if (pending.current || busy || finishing) return;
    pending.current = true;
    setFinishing(true);
    setLocalError("");
    try {
      const ids = cards.slice(0, cardCount).map((card) => card.id);
      const enrolled = await enrollLearnedCards(ids);
      if (enrolled.error) throw new Error(enrolled.error);
      await post("complete", activity, 18, {});
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Chưa hoàn thành được hoạt động.");
      setFinishing(false);
    } finally {
      pending.current = false;
    }
  }

  /** Retry finish after a failed checkpoint or enrollment. */
  function retryFinish() {
    setLocalError("");
    void finish();
  }

  if (!cardCount) {
    return <section className={panel}><p>Chưa có từ trong nhóm này.</p></section>;
  }

  const phaseBusy = busy || finishing;

  return (
    <section className={kind === "review" || kind === "speak" ? "space-y-5" : panel} aria-label={`Hoạt động từ vựng nhóm ${group}`}>
      {kind === "review" && (
        <ReviewPhase
          key={`review-${step}`}
          cards={cards.slice(0, cardCount)}
          grammar={grammar}
          speech={speech}
          post={post}
          activity={activity}
          step={step}
          state={state.review}
          busy={phaseBusy}
          onAdvance={(review, finished = false) => {
            const next = { ...state, review };
            if (finished) advance(next);
            else setState(next);
          }}
        />
      )}
      {kind === "recall" && (
        <RecallPhase
          key={`recall-${step}`}
          cards={cards.slice(0, cardCount)}
          state={state.recall?.queue ?? createRecallQueue()}
          busy={phaseBusy}
          onAnswer={(queue) => {
            const next: VocabState = { ...state, recall: { queue } };
            const mastered = queue.mastered.length;
            const done = nextRecallItem(queue) === null;
            const target = nextVocabStep(step, done, mastered);
            void checkpoint(target, next);
          }}
        />
      )}
      {kind === "fill" && (
        <FillPhase
          key={`fill-${step}`}
          step={step}
          cards={cards.slice(0, cardCount)}
          state={state.fill}
          busy={phaseBusy}
          onAdvance={(fill) => {
            const next = { ...state, fill };
            advance(next);
          }}
        />
      )}
      {kind === "speak" && (
        <WordSpeakingPhase
          key={`speak-${step}`}
          lessonId={lessonId}
          step={step}
          cards={cards.slice(0, cardCount)}
          state={state.speak}
          speech={speech}
          ai={ai}
          tone={tone}
          post={post}
          activity={activity}
          busy={phaseBusy}
          onAdvance={(speak) => {
            const next = { ...state, speak };
            advance(next);
          }}
        />
      )}
      {kind === "shadow" && (
        <ShadowPhase
          grammar={grammar}
          speech={speech}
          post={post}
          activity={activity}
          busy={phaseBusy}
          done={state.shadow.done}
          onDone={(shadow) => {
            const next = { ...state, shadow };
            void checkpoint(18, next).then((ok) => { if (ok) void finish(); });
          }}
        />
      )}
      {(localError || finishing) && (
        <div className="space-y-2">
          {finishing && <LogoLoader size="sm" label="Đang lưu thẻ ôn tập" />}
          {localError && <p role="alert" className="text-destructive">{localError}</p>}
          {localError && kind === "shadow" && <Button type="button" variant="outline" size="sm" onClick={retryFinish}>Thử lại</Button>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Steps 1-5: Review Cards + say each word + grammar card
// ---------------------------------------------------------------------------

function ReviewPhase({ cards, grammar, speech, post, activity, step, state, busy, onAdvance }: {
  cards: LessonCard[];
  grammar: CourseGrammarPoint | null;
  speech: boolean;
  post: ActivityPostFn;
  activity: number;
  step: number;
  state: ReviewState;
  busy: boolean;
  onAdvance: (review: ReviewState, finished?: boolean) => void;
}) {
  const total = cards.length + 1; // 4 words + grammar card
  const onGrammar = state.cardIndex >= cards.length;
  const card = onGrammar ? null : cards[state.cardIndex];
  const position = Math.min(state.cardIndex + 1, total);

  const reviewing = position < step;
  function nextCard(review: ReviewState) {
    onAdvance({ ...review, cardIndex: review.cardIndex + 1, flipped: false, phase: "card" }, !reviewing);
  }
  function forward() {
    if (reviewing) nextCard(state);
    else onAdvance({ ...state, phase: "speak" });
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (busy || onGrammar || state.phase !== "card" || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowRight") { event.preventDefault(); forward(); }
    if (event.key === "ArrowLeft" && state.cardIndex > 0) {
      event.preventDefault();
      onAdvance({ ...state, cardIndex: state.cardIndex - 1, flipped: false, phase: "card" });
    }
  }

  return (
    <div className="space-y-5" onKeyDown={handleKey}>
      {onGrammar ? (
        <>
          <GrammarCard grammar={grammar} busy={busy} onStart={() => onAdvance(state, true)} last
            onPrevious={() => onAdvance({ ...state, cardIndex: cards.length - 1, flipped: false, phase: "card" })} />
        </>
      ) : card ? (
        state.phase === "card" ? (
          <>
            <FlipFlashcard key={card.id} card={card} flipped={state.flipped} onFlip={() => onAdvance({ ...state, flipped: !state.flipped })} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" size="sm" variant="outline" disabled={busy || state.cardIndex === 0}
                onClick={() => onAdvance({ ...state, cardIndex: state.cardIndex - 1, flipped: false, phase: "card" })}>
                Trước
              </Button>
              <div className="flex flex-wrap justify-center gap-1" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={cn("size-2.5 rounded-full", i < state.cardIndex ? "bg-primary/50" : i === state.cardIndex ? "bg-primary" : "bg-muted-foreground/30")} />
                ))}
              </div>
              <Button type="button" size="sm" disabled={busy} onClick={forward}>
                {reviewing ? "Thẻ tiếp" : "Luyện phát âm"} <ArrowRight aria-hidden="true" />
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">Space/Enter lật thẻ · → luyện phát âm · ← thẻ trước</p>
          </>
        ) : (
          <SayWordStep
            key={card.id}
            card={card}
            speech={speech}
            post={post}
            activity={activity}
            smallStep={state.cardIndex + 1}
            busy={busy}
            onDone={(passed) => {
              const speakDone = passed ? [...state.speakDone, card.id] : state.speakDone;
              nextCard({ ...state, speakDone });
            }}
          />
        )
      ) : null}
    </div>
  );
}

/** Grammar flashcard: front shows the structure name, back the explanation + example. */
function GrammarCard({ grammar, busy, onStart, onPrevious, last }: {
  grammar: CourseGrammarPoint | null;
  busy: boolean;
  onStart: () => void;
  onPrevious?: () => void;
  last?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  if (!grammar) {
    return <div className="space-y-4"><p>Chưa có điểm ngữ pháp cho nhóm này.</p>
      <Button type="button" disabled={busy} onClick={onStart}>Bắt đầu luyện tập{last && <ArrowRight aria-hidden="true" />}</Button></div>;
  }
  return (
    <div className="space-y-5">
      <div className="mx-auto h-80 w-full max-w-lg [perspective:1200px]">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          aria-label={flipped ? "Mặt giải thích ngữ pháp. Bấm để lật lại" : `${grammar.title}. Bấm để xem giải thích`}
          onClick={() => setFlipped((v) => !v)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === " " || event.key === "Enter") { event.preventDefault(); setFlipped((v) => !v); }
          }}
          className="relative h-full w-full cursor-pointer rounded-3xl outline-none [transform-style:preserve-3d] focus-visible:ring-4 focus-visible:ring-ring/40"
          style={{ transform: `rotateY(${flipped ? 180 : 0}deg)`, transition: "transform 0.5s" }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-secondary/40 bg-card p-6 text-center shadow-[0_6px_0_var(--border)] [backface-visibility:hidden]">
            <span className="bg-secondary/10 text-secondary rounded-full px-3 py-1 text-xs font-extrabold">Grammar</span>
            <p lang="en" className="text-3xl font-black break-words">{grammar.title}</p>
            <span className="text-muted-foreground text-sm font-bold">Chạm hoặc Space để lật</span>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-primary/40 bg-sidebar-accent p-6 text-center shadow-[0_6px_0_var(--primary-edge)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-base font-semibold">{grammar.explanationVi}</p>
            <div className="bg-card w-full space-y-1 rounded-2xl p-3 text-left">
              <p lang="en" className="font-semibold">{grammar.exampleEn}</p>
              <p className="text-muted-foreground text-sm">{grammar.exampleVi}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); void playTts(grammar.exampleEn); }}>
              <Volume2 aria-hidden="true" /> Nghe ví dụ
            </Button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        {onPrevious ? (
          <Button type="button" size="lg" variant="outline" disabled={busy} onClick={onPrevious}>
            <ArrowLeft aria-hidden="true" /> Thẻ trước
          </Button>
        ) : null}
        <Button type="button" size="lg" disabled={busy} onClick={onStart}>
          Start Practice <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** "Hãy nói từ sau": record the word; it is scored as soon as the recording stops. */
function SayWordStep({ card, speech, post, activity, smallStep, busy, onDone }: {
  card: LessonCard;
  speech: boolean;
  post: ActivityPostFn;
  activity: number;
  smallStep: number;
  busy: boolean;
  onDone: (passed: boolean) => void;
}) {
  const [result, setResult] = useState<PronunciationResult>();
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [attempt, setAttempt] = useState(0);

  async function score(recording: RecordedAudio | null) {
    if (!recording || scoring) return;
    setScoring(true);
    setError("");
    try {
      const body = await post<{ pron: PronunciationResult; attemptId: string }>(
        "pronunciation", activity, smallStep, {}, recording.audio,
      );
      setResult(body.pron);
      if (body.pron.score < PASS_SCORE) setFailures((v) => v + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa chấm được phát âm.");
    } finally {
      setScoring(false);
    }
  }

  function retry() {
    setResult(undefined);
    setAttempt((value) => value + 1);
  }

  const passed = result != null && result.score >= PASS_SCORE;
  const canSkip = failures >= 3 && !passed;
  const hints = result ? [...new Set(result.issues.map(pronunciationHint).filter(Boolean))].slice(0, 3) : [];
  const bars = result ? ([["Chính xác", result.accuracy], ["Trôi chảy", result.fluency], ["Đầy đủ", result.completeness]] as const) : [];

  return (
    <div className="bg-card space-y-5 rounded-3xl border-2 p-5 text-center shadow-[0_4px_0_var(--border)] sm:p-7">
      <p className="text-muted-foreground text-sm font-extrabold">Hãy nói từ sau</p>
      <div className="space-y-1">
        <p lang="en" className="text-4xl font-black sm:text-5xl">{card.term}</p>
        <p className="text-muted-foreground flex items-center justify-center gap-2 text-lg">
          {card.ipa}
          <button type="button" aria-label={`Nghe ${card.term}`} onClick={() => void playTts(card.term)} className="text-secondary hover:bg-muted grid size-9 place-items-center rounded-full">
            <Volume2 aria-hidden="true" className="size-5" />
          </button>
        </p>
        {card.definition_vi ? <p className="font-semibold">{card.definition_vi}</p> : null}
      </div>

      {!speech ? (
        <p role="status" className="text-muted-foreground">Chưa có dịch vụ chấm. Hãy nghe mẫu và đọc theo.</p>
      ) : result ? (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-col items-center gap-1">
            <span className={cn("grid size-20 place-items-center rounded-full text-2xl font-black text-white", passed ? "bg-primary shadow-[0_5px_0_var(--primary-edge)]" : "bg-accent text-accent-foreground shadow-[0_5px_0_var(--accent-edge)]")}>
              {percent(result.score)}
            </span>
            <p className={cn("font-black", passed ? "text-primary-edge" : "text-accent-edge")}>{passed ? "Tốt lắm!" : "Gần đúng rồi, thử lại nhé"}</p>
          </div>
          <p lang="en" className="flex flex-wrap justify-center gap-x-2 text-xl font-bold">
            {result.words.map((word, index) => {
              const weak = word.omitted || word.score < PASS_SCORE;
              return <span key={index} className={weak ? "text-destructive underline decoration-wavy" : "text-primary-edge"}>{word.text}</span>;
            })}
          </p>
          <div className="mx-auto grid max-w-sm gap-2 text-left">
            {bars.map(([label, value]) => value == null ? null : (
              <div key={label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-sm font-bold">
                <span className="text-muted-foreground">{label}</span>
                <span className="bg-muted h-2 overflow-hidden rounded-full"><span className="bg-primary block h-full rounded-full" style={{ width: `${percent(value)}%` }} /></span>
                <span className="text-right tabular-nums">{percent(value)}</span>
              </div>
            ))}
          </div>
          {hints.length > 0 ? <ul className="text-muted-foreground mx-auto max-w-sm list-disc space-y-1 pl-5 text-left text-sm">{hints.map((hint) => <li key={hint}>{hint}</li>)}</ul> : null}
        </div>
      ) : (
        <div className="mx-auto max-w-xs space-y-2">
          <AudioRecorder key={attempt} variant="wide" onRecording={(value) => void score(value)} disabled={scoring || busy} startLabel="Bắt đầu nói" />
          {scoring ? <LogoLoader size="sm" label="Đang chấm phát âm" /> : null}
        </div>
      )}
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" variant="outline" disabled={busy || scoring || !result} onClick={retry}>
          <RotateCcw aria-hidden="true" /> Thử lại
        </Button>
        <Button type="button" size="lg" disabled={busy || scoring || (speech && !passed && !canSkip)} onClick={() => onDone(passed)}>
          {passed || !speech ? "Tiếp tục" : canSkip ? "Bỏ qua" : "Tiếp tục"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps 6-9: recall meanings until all 4 mastered
// ---------------------------------------------------------------------------

/** Result panel shared by recall and fill: verdict, the right answer and the example sentence. */
function AnswerPanel({ correct, answerLabel, answer, card }: {
  correct: boolean;
  answerLabel: string;
  answer: string;
  card: LessonCard;
}) {
  const [showVi, setShowVi] = useState(false);
  return (
    <div
      role="status"
      className={cn("space-y-3 rounded-2xl border-2 p-4", correct ? "border-primary/40 bg-primary/10" : "border-destructive/30 bg-destructive/5")}
    >
      <p className={cn("flex items-center gap-2 font-black", correct ? "text-primary-edge" : "text-destructive")}>
        {correct ? <Check aria-hidden="true" className="size-5 stroke-[3]" /> : <X aria-hidden="true" className="size-5 stroke-[3]" />}
        {correct ? "Chính xác!" : <>{answerLabel}: <span lang="en" className="text-foreground">{answer}</span></>}
      </p>
      {card.example_en ? (
        <div className={cn("space-y-1 border-t pt-3", correct ? "border-primary/20" : "border-destructive/20")}>
          <div className="flex items-start gap-2">
            <p lang="en" className="flex-1"><span className="font-bold">Ví dụ:</span> {card.example_en}</p>
            <button type="button" aria-label="Nghe câu ví dụ" onClick={() => void playTts(card.example_en!)} className="text-secondary hover:bg-card grid size-8 shrink-0 place-items-center rounded-full">
              <Volume2 aria-hidden="true" className="size-4" />
            </button>
            {card.example_vi ? (
              <button type="button" aria-label="Dịch câu ví dụ" aria-pressed={showVi} onClick={() => setShowVi(!showVi)} className="text-secondary hover:bg-card grid size-8 shrink-0 place-items-center rounded-full">
                <Languages aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
          {showVi && card.example_vi ? <p className="text-muted-foreground text-sm">{card.example_vi}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Large single-line answer box with Check and "I don't know" buttons. */
function AnswerForm({ id, lang, placeholder, value, onChange, busy, onCheck, onSkip }: {
  id: string;
  lang?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  onCheck: () => void;
  onSkip: () => void;
}) {
  return (
    <form className="space-y-2.5" onSubmit={(event) => { event.preventDefault(); if (value.trim()) onCheck(); }}>
      <input
        id={id}
        lang={lang}
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={busy}
        autoComplete="off"
        autoFocus
        placeholder={placeholder}
        className="bg-muted/40 focus-visible:border-primary h-14 w-full rounded-2xl border-2 px-4 text-center text-lg font-semibold outline-none"
      />
      <Button type="submit" size="lg" className="w-full" disabled={busy || !value.trim()}>Kiểm tra</Button>
      <Button type="button" size="lg" variant="outline" className="w-full" disabled={busy} onClick={onSkip}>Tôi không biết</Button>
    </form>
  );
}

/** Continue (Enter) and, after a miss, "I was right" (Tab) under a revealed answer. */
function AnswerActions({ busy, onContinue, onOverride }: { busy: boolean; onContinue: () => void; onOverride?: () => void }) {
  return (
    <div
      className="space-y-2.5"
      onKeyDown={(event) => {
        if (event.key === "Tab" && !event.shiftKey && onOverride) { event.preventDefault(); onOverride(); }
      }}
    >
      <Button type="button" size="lg" className="w-full" autoFocus disabled={busy} onClick={onContinue}>
        Tiếp tục <ArrowRight aria-hidden="true" />
      </Button>
      {onOverride ? (
        <Button type="button" size="lg" variant="ghost" className="w-full" disabled={busy} onClick={onOverride}>
          Tôi trả lời đúng <kbd className="bg-muted rounded px-1.5 py-0.5 text-xs">Tab</kbd>
        </Button>
      ) : null}
    </div>
  );
}

function WordHeading({ card }: { card: LessonCard }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p lang="en" className="text-3xl font-black sm:text-4xl">{card.term}</p>
        <button type="button" aria-label={`Nghe ${card.term}`} onClick={() => void playTts(card.term)} className="text-secondary hover:bg-muted grid size-10 place-items-center rounded-full">
          <Volume2 aria-hidden="true" className="size-5" />
        </button>
      </div>
      <p className="text-muted-foreground text-sm">{card.part_of_speech ?? "word"}{card.ipa ? ` - ${card.ipa}` : ""}</p>
    </div>
  );
}

/**
 * Steps 6-9: type the Vietnamese meaning until all words are mastered. The answer is revealed
 * first; the queue only advances (and is saved) when the learner presses Continue, so the panel
 * always explains the word that was just answered.
 */
function RecallPhase({ cards, state, busy, onAnswer }: {
  cards: LessonCard[];
  state: RecallQueueState;
  busy: boolean;
  onAnswer: (queue: RecallQueueState) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<{ cardIndex: number; correct: boolean } | null>(null);
  const item = nextRecallItem(state);
  const { mastered, total } = recallMasteryCount(state, cards.length);
  const cardIndex = verdict?.cardIndex ?? item?.cardIndex;
  const card = cardIndex == null ? null : cards[cardIndex];

  function check(skip = false) {
    if (!item || !card || busy) return;
    const correct = !skip && matchVietnameseMeaning(answer, card.definition_vi ?? "", meaningAlternates(card));
    setVerdict({ cardIndex: item.cardIndex, correct });
  }

  function commit(override = false) {
    if (!verdict || busy) return;
    const next = recordRecallAnswer(state, verdict.cardIndex, verdict.correct || override, { override });
    setAnswer("");
    setVerdict(null);
    onAnswer(next);
  }

  if (!card) {
    return <div className="space-y-2 text-center">
      <h2 className="text-xl font-black">Đã thuộc cả {total} từ</h2>
      <p className="text-muted-foreground">Bạn sẽ gặp lại các từ này ở bước điền từ và nói câu.</p>
    </div>;
  }

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-center text-sm font-extrabold tabular-nums" aria-live="polite">{mastered} / {total} mastered</p>
      <WordHeading card={card} />
      {verdict ? (
        <>
          <AnswerPanel correct={verdict.correct} answerLabel="Đáp án đúng" answer={card.definition_vi ?? card.definition_en ?? "Chưa có nghĩa"} card={card} />
          <AnswerActions busy={busy} onContinue={() => commit()} onOverride={verdict.correct ? undefined : () => commit(true)} />
        </>
      ) : (
        <AnswerForm id="recall-answer" placeholder="Nhập nghĩa tiếng Việt..." value={answer} onChange={setAnswer} busy={busy}
          onCheck={() => check()} onSkip={() => check(true)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps 10,12,14,16: fill in the blank
// ---------------------------------------------------------------------------

function FillPhase({ step, cards, state, busy, onAdvance }: {
  step: number;
  cards: LessonCard[];
  state: FillState;
  busy: boolean;
  onAdvance: (fill: FillState) => void;
}) {
  // Steps 10,12,14,16 test cards 0..3; the step plan is the single source of that mapping.
  const slot = vocabStepDescriptor(step)?.cardIndex ?? 0;
  const card = cards[slot];
  const cloze = card?.example_en ? buildCloze(card.example_en, card.term) : null;
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | "skipped" | null>(null);

  if (!card) return null;

  function check(skip = false) {
    if (busy) return;
    setResult(skip ? "skipped" : isFillAnswerCorrect(answer, card.term) ? "correct" : "wrong");
  }

  function commit(verdict: "correct" | "wrong" | "skipped") {
    onAdvance({ ...state, index: slot + 1, results: { ...state.results, [card.id]: verdict } });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p lang="en" className="text-2xl leading-snug font-black sm:text-3xl">
          {cloze ? <>{cloze.before} <span className="border-foreground/60 inline-block min-w-24 border-b-4 align-baseline" aria-label="chỗ trống">&nbsp;</span> {cloze.after}</> : card.example_en}
        </p>
        <p className="text-muted-foreground text-sm">{card.part_of_speech ?? "word"}{card.ipa ? ` - ${card.ipa}` : ""}</p>
      </div>
      {result ? (
        <>
          <AnswerPanel correct={result === "correct"} answerLabel="Đáp án đúng" answer={cloze?.answer ?? card.term} card={card} />
          <AnswerActions busy={busy} onContinue={() => commit(result)} onOverride={result === "correct" ? undefined : () => commit("correct")} />
        </>
      ) : (
        <AnswerForm id="fill-answer" lang="en" placeholder="Nhập câu trả lời của bạn..." value={answer} onChange={setAnswer} busy={busy}
          onCheck={() => check()} onSkip={() => check(true)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps 11,13,15,17: word-specific generated speaking
// ---------------------------------------------------------------------------

interface WordQuestion { en: string; vi: string; part: 1 }

function WordSpeakingPhase({ lessonId, step, cards, state, speech, ai, tone, post, activity, busy, onAdvance }: {
  lessonId: string;
  step: number;
  cards: LessonCard[];
  state: SpeakState;
  speech: boolean;
  ai: boolean;
  tone: FeedbackTone;
  post: ActivityPostFn;
  activity: number;
  busy: boolean;
  onAdvance: (speak: SpeakState) => void;
}) {
  const slot = vocabStepDescriptor(step)?.cardIndex ?? 0; // steps 11,13,15,17 -> cards 0..3
  const card = cards[slot];
  const [question, setQuestion] = useState<WordQuestion | null>(null);
  const [questionError, setQuestionError] = useState("");
  const [questionNonce, setQuestionNonce] = useState(0);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    post<{ question: WordQuestion }>("word_question", activity, step)
      .then((body) => { if (!cancelled) setQuestion(body.question); })
      .catch((cause) => { if (!cancelled) setQuestionError(cause instanceof Error ? cause.message : "Chưa tạo được câu hỏi."); });
    return () => { cancelled = true; };
  }, [card, post, activity, step, questionNonce]);

  if (!card) return null;

  if (questionError) {
    return (
      <div className="space-y-3 text-center">
        <p role="alert" className="text-destructive font-bold">{questionError}</p>
        <Button type="button" variant="outline" onClick={() => { setQuestionError(""); setQuestionNonce((n) => n + 1); }}>
          <RotateCcw aria-hidden="true" /> Thử lại
        </Button>
      </div>
    );
  }
  if (!question) return <LogoLoader label={`Đang tạo câu hỏi Speaking cho từ "${card.term}"...`} />;

  return (
    <CourseV2Speaking
      key={`${card.id}-${step}`}
      lessonId={lessonId}
      activity={activity}
      smallStep={step}
      question={question}
      targetTerm={card.term}
      targetIpa={card.ipa}
      terms={[card.term]}
      speech={speech}
      ai={ai}
      busy={busy}
      tone={tone}
      onAnswered={() => {}}
      onFeedback={async (attemptId, nextTone) => {
        const result = await post<{ feedback: LessonFeedback | null }>("feedback", activity, step, { attemptId, ...(nextTone ? { tone: nextTone } : {}) });
        return result.feedback;
      }}
      getIdeas={async () => (await post<{ ideas: LessonIdea[] }>("ideas", activity, step)).ideas}
      onComplete={() => onAdvance({ index: slot + 1, results: { ...state.results, [card.id]: { usedTarget: true } } })}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 18: Listen & Speak shadowing on the grammar example
// ---------------------------------------------------------------------------

function ShadowPhase({ grammar, speech, post, activity, busy, done, onDone }: {
  grammar: CourseGrammarPoint | null;
  speech: boolean;
  post: ActivityPostFn;
  activity: number;
  busy: boolean;
  done: boolean;
  onDone: (shadow: ShadowState) => void;
}) {
  const sentence = grammar?.exampleEn ?? "";
  const [mode, setMode] = useState<"voice" | "text">(speech ? "voice" : "text");
  const [typed, setTyped] = useState("");
  const [typedChecked, setTypedChecked] = useState(false);
  const [result, setResult] = useState<PronunciationResult>();
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [speed, setSpeed] = useState<TtsSpeed>(0.9);
  const [attempt, setAttempt] = useState(0);

  // The sentence is heard first (text hidden), like a real shadowing drill.
  useEffect(() => {
    if (sentence && !done) void playTts(sentence, { speed: 0.9 });
  }, [sentence, done]);

  async function score(recording: RecordedAudio | null) {
    if (!recording || scoring) return;
    setScoring(true);
    setError("");
    try {
      const body = await post<{ pron: PronunciationResult; attemptId: string }>("pronunciation", activity, 18, {}, recording.audio);
      setResult(body.pron);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa chấm được phát âm.");
    } finally {
      setScoring(false);
    }
  }

  if (done) {
    return <div className="space-y-3 text-center">
      <h2 className="text-xl font-black">Đã hoàn thành shadowing</h2>
      <Button type="button" size="lg" disabled={busy} onClick={() => onDone({ done: true, typed: true })}>Hoàn thành hoạt động</Button>
    </div>;
  }

  const passed = result != null && result.score >= PASS_SCORE;
  const typedMatch = typed.trim().length > 0 && normalizeMeaning(typed) === normalizeMeaning(sentence);
  const revealed = Boolean(result) || typedChecked;

  return (
    <div className="space-y-6 text-center">
      <p className="text-muted-foreground font-extrabold">Nghe và nói lại (Shadowing)</p>

      <button
        type="button"
        aria-label="Nghe câu mẫu"
        onClick={() => void playTts(sentence, { speed })}
        className="bg-secondary/15 text-secondary-edge hover:bg-secondary/25 mx-auto grid size-24 place-items-center rounded-full transition-colors"
      >
        <Volume2 aria-hidden="true" className="size-10" />
      </button>
      <div className="flex justify-center">
        <div className="flex rounded-xl border-2" role="group" aria-label="Tốc độ đọc">
          {([0.75, 0.9, 1] as TtsSpeed[]).map((s) => (
            <button key={s} type="button" onClick={() => { setSpeed(s); void playTts(sentence, { speed: s }); }} aria-pressed={speed === s}
              className={cn("px-3 py-1 text-sm font-bold first:rounded-l-[10px] last:rounded-r-[10px]", speed === s ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
              {s}×
            </button>
          ))}
        </div>
      </div>

      {revealed ? (
        <div className="space-y-2" aria-live="polite">
          {result ? (
            <>
              <span className={cn("mx-auto grid size-16 place-items-center rounded-full text-xl font-black", passed ? "bg-primary text-white shadow-[0_4px_0_var(--primary-edge)]" : "bg-accent text-accent-foreground shadow-[0_4px_0_var(--accent-edge)]")}>
                {percent(result.score)}
              </span>
              <p lang="en" className="flex flex-wrap justify-center gap-x-2 text-xl font-bold">
                {result.words.map((word, index) => {
                  const weak = word.omitted || word.score < PASS_SCORE;
                  return <span key={index} className={weak ? "text-destructive underline decoration-wavy" : "text-primary-edge"}>{word.text}</span>;
                })}
              </p>
            </>
          ) : (
            <p className={cn("font-black", typedMatch ? "text-primary-edge" : "text-destructive")}>{typedMatch ? "Khớp với câu mẫu!" : "Chưa khớp, so lại với câu mẫu nhé"}</p>
          )}
          {!result || !passed ? <p lang="en" className="text-lg font-semibold">{sentence}</p> : null}
          {grammar?.exampleVi ? <p className="text-muted-foreground text-sm">{grammar.exampleVi}</p> : null}
        </div>
      ) : null}

      {!revealed ? (
        mode === "voice" ? (
          <div className="mx-auto grid max-w-md grid-cols-[auto_1fr] gap-2">
            <Button type="button" size="lg" variant="outline" aria-label="Gõ lại câu" onClick={() => setMode("text")}><Keyboard aria-hidden="true" /></Button>
            <AudioRecorder key={attempt} variant="wide" startLabel="Bắt đầu nói" disabled={scoring || busy} onRecording={(value) => void score(value)} />
          </div>
        ) : (
          <form className="mx-auto flex max-w-md items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (typed.trim()) setTypedChecked(true); }}>
            {speech ? <Button type="button" size="icon-lg" variant="outline" aria-label="Nói thay vì gõ" onClick={() => setMode("voice")}><Mic aria-hidden="true" /></Button> : null}
            <input lang="en" value={typed} onChange={(event) => setTyped(event.target.value)} disabled={busy} autoFocus aria-label="Gõ lại câu vừa nghe"
              placeholder="Gõ lại câu vừa nghe..." className="bg-muted/40 focus-visible:border-primary h-12 min-w-0 flex-1 rounded-2xl border-2 px-4 font-semibold outline-none" />
            <Button type="submit" size="lg" disabled={!typed.trim()}>Kiểm tra</Button>
          </form>
        )
      ) : null}
      {scoring ? <LogoLoader size="sm" label="Đang chấm phát âm" /> : null}
      {error ? <p role="alert" className="text-destructive text-sm font-bold">{error}</p> : null}

      {revealed ? (
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <Button type="button" size="lg" variant="outline" disabled={busy} onClick={() => { setResult(undefined); setTypedChecked(false); setTyped(""); setAttempt((n) => n + 1); }}>
            <RotateCcw aria-hidden="true" /> Thử lại
          </Button>
          <Button type="button" size="lg" disabled={busy} onClick={() => onDone({ done: true, typed: typedMatch || undefined, pronScore: result?.score ?? null })}>
            Hoàn thành <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Small helpers duplicated from course-speaking to keep this file self-contained.
