"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Check, Eye, Mic, Quote, Volume2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { enrollLearnedCards } from "@/app/(app)/sets/review-actions";
import { playTts, type TtsAccent } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";
import { PASS_SCORE, PronounceStep } from "./pronounce-step";
import { Ipa } from "@/components/vocab/ipa-text";

export type LessonCard = {
  id: string;
  term: string;
  ipa: string | null;
  part_of_speech: string | null;
  definition_vi: string | null;
  definition_en: string | null;
  example_en: string | null;
  example_vi: string | null;
  synonyms: string[] | null;
  image_url?: string | null;
};

type Step = "learn" | "word" | "example";
type Scores = Record<string, { word?: number; example?: number }>;

const STEP_LABELS: Record<Step, string> = { learn: "Xem từ", word: "Đọc từ", example: "Đọc câu ví dụ" };
const STEP_ICONS = { learn: Eye, word: Mic, example: Quote } as const;

/**
 * Vocabulary lesson, one word at a time: learn the word (IPA, meaning, synonyms) → read it aloud and get
 * scored → read the stored example sentence aloud and get scored → next word. Finished words are added
 * to the review queue at the end.
 */
export function VocabLesson({ setId, title, cards, speechEnabled, onComplete }: {
  setId: string;
  title: string;
  cards: LessonCard[];
  speechEnabled: boolean;
  onComplete?: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>("learn");
  const [accent, setAccent] = useState<TtsAccent>("en-US");
  const [scores, setScores] = useState<Scores>({});
  const [done, setDone] = useState<string[]>([]);
  const [finish, setFinish] = useState<{ added?: number; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (!cards.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-2xl font-black">Bộ từ chưa có thẻ</h1>
        <Link href={`/sets/${setId}`} className={buttonVariants()}>Thêm thẻ</Link>
      </div>
    );
  }

  const card = cards[index];
  const steps: Step[] = card.example_en ? ["learn", "word", "example"] : ["learn", "word"];
  const stepIndex = steps.indexOf(step);
  const isLastStep = stepIndex === steps.length - 1;
  const cardScores = scores[card.id] ?? {};
  const currentScore = step === "word" ? cardScores.word : step === "example" ? cardScores.example : undefined;

  function record(kind: "word" | "example", value: number) {
    setScores((old) => ({ ...old, [card.id]: { ...old[card.id], [kind]: value } }));
  }

  async function next() {
    if (saving) return;
    if (!isLastStep) {
      setStep(steps[stepIndex + 1]);
      return;
    }
    const learned = [...done, card.id];
    if (index + 1 < cards.length) {
      setDone(learned);
      setIndex(index + 1);
      setStep("learn");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const result = await enrollLearnedCards(learned);
      if (onComplete) {
        if (result.error) throw new Error(result.error);
        await onComplete();
      } else setFinish(result);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Chưa lưu được từ đã học.");
    } finally { setSaving(false); }
  }

  if (finish) {
    return <LessonSummary setId={setId} cards={cards} scores={scores} result={finish} />;
  }

  const progress = done.length + stepIndex / steps.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      {/* Session bar: close, progress through the words, counter and voice. */}
      <div className="flex items-center gap-3">
        <Link
          href={`/sets/${setId}`}
          aria-label={`Thoát, về bộ từ ${title}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-10 shrink-0 place-items-center rounded-xl transition-colors"
        >
          <X className="size-6" aria-hidden="true" />
        </Link>
        <div
          role="progressbar"
          aria-label="Tiến độ bài học"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={done.length}
          className="bg-muted h-4 flex-1 overflow-hidden rounded-full"
        >
          <div className="bg-primary relative h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(4, (progress / cards.length) * 100)}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
          </div>
        </div>
        <span className="text-muted-foreground w-12 text-right text-sm font-black tabular-nums">{index + 1}/{cards.length}</span>
        <div role="radiogroup" aria-label="Giọng đọc" className="bg-muted hidden rounded-xl p-1 sm:flex">
          {(["en-US", "en-GB"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={accent === value}
              onClick={() => setAccent(value)}
              className={cn("rounded-lg px-2.5 py-1 text-xs font-black", accent === value ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {value === "en-US" ? "US" : "UK"}
            </button>
          ))}
        </div>
      </div>

      {/* Steps for the current word. */}
      <ol className="flex items-center" aria-label="Các bước">
        {steps.map((s, i) => {
          const Icon = STEP_ICONS[s];
          const state = i < stepIndex ? "done" : s === step ? "current" : "todo";
          return (
            <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex flex-1 items-center last:flex-none">
              <span className="flex items-center gap-2">
                <span className={cn(
                  "grid size-9 place-items-center rounded-full border-2",
                  state === "done" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-secondary bg-secondary text-secondary-foreground",
                  state === "todo" && "text-muted-foreground",
                )}>
                  {state === "done" ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                </span>
                <span className={cn("hidden text-sm font-extrabold sm:inline", state === "todo" && "text-muted-foreground")}>{STEP_LABELS[s]}</span>
              </span>
              {i < steps.length - 1 ? <span className={cn("mx-3 h-1 flex-1 rounded-full", i < stepIndex ? "bg-primary" : "bg-muted")} /> : null}
            </li>
          );
        })}
      </ol>

      <section key={`${card.id}:${step}`} className="bg-card rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)] animate-[study-rise_0.25s_ease-out] sm:p-8">
        {step === "learn" ? (
          <WordDetails card={card} accent={accent} />
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase">
              {step === "word" ? <Mic aria-hidden="true" className="size-4" /> : <Quote aria-hidden="true" className="size-4" />}
              {step === "word" ? "Đọc to từ này" : "Đọc to câu ví dụ"}
            </p>
            <PronounceStep
              text={step === "word" ? card.term : card.example_en!}
              cardId={card.id}
              accent={accent}
              enabled={speechEnabled}
              onScored={(value) => record(step as "word" | "example", value)}
            />
            {step === "example" && card.example_vi ? <p className="text-muted-foreground text-center font-semibold">{card.example_vi}</p> : null}
          </div>
        )}
      </section>

      {saveError ? <p role="alert" className="text-destructive font-bold">{saveError}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {step !== "learn" && speechEnabled && currentScore === undefined ? (
          <button type="button" disabled={saving} className="text-muted-foreground hover:text-foreground text-sm font-extrabold" onClick={() => void next()}>
            Bỏ qua bước này
          </button>
        ) : <span />}
        <Button
          type="button"
          size="lg"
          className="h-14 px-10 text-base"
          onClick={() => void next()}
          disabled={saving || (step !== "learn" && speechEnabled && currentScore === undefined)}
        >
          {saving ? "Đang lưu..." : isLastStep && index + 1 === cards.length ? "Hoàn thành" : "Tiếp tục"}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The example sentence with the learned word highlighted (matched without trailing punctuation). */
function HighlightedExample({ text, term }: { text: string; term: string }) {
  const core = term.trim().replace(/[\s.!?,;:]+$/u, "");
  const parts = core ? text.split(new RegExp(`(${escapeRegExp(core)})`, "i")) : [text];
  return (
    <>
      {parts.map((part, index) => part.toLowerCase() === core.toLowerCase()
        ? <mark key={index} className="bg-primary/20 text-foreground rounded px-1">{part}</mark>
        : <span key={index}>{part}</span>)}
    </>
  );
}

function WordDetails({ card, accent }: { card: LessonCard; accent: TtsAccent }) {
  const synonyms = card.synonyms?.filter(Boolean) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        {card.part_of_speech ? (
          <span className="bg-secondary/15 text-secondary rounded-full px-3 py-1 text-xs font-extrabold">{card.part_of_speech}</span>
        ) : null}
        {card.image_url ? (
          // Learner-chosen illustration (remote or uploaded), kept at its own aspect ratio.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image_url} alt="" className="h-auto max-h-44 w-auto max-w-[80%] rounded-2xl shadow-sm" />
        ) : null}
        <h2 lang="en" className="text-5xl font-black tracking-tight text-balance break-words">{card.term}</h2>
        {card.ipa ? <p className="text-muted-foreground text-xl"><Ipa value={card.ipa} /></p> : null}
        <button
          type="button"
          aria-label={`Nghe phát âm ${card.term}`}
          onClick={() => void playTts(card.term, { accent })}
          className="bg-secondary text-secondary-foreground grid size-16 place-items-center rounded-full shadow-[0_5px_0_var(--secondary-edge)] active:translate-y-1 active:shadow-none"
        >
          <Volume2 className="size-8" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1 border-t-2 pt-5 text-center">
        {card.definition_vi ? <p className="text-2xl font-black">{card.definition_vi}</p> : null}
        {card.definition_en ? <p lang="en" className="text-muted-foreground text-lg">{card.definition_en}</p> : null}
      </div>

      {card.example_en ? (
        <div className="bg-muted/60 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label="Nghe câu ví dụ"
              onClick={() => void playTts(card.example_en!, { accent })}
              className="bg-card text-secondary grid size-10 shrink-0 place-items-center rounded-full border-2"
            >
              <Volume2 className="size-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p lang="en" className="text-lg font-bold"><HighlightedExample text={card.example_en} term={card.term} /></p>
              {card.example_vi ? <p className="text-muted-foreground mt-1 font-semibold">{card.example_vi}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {synonyms.length ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-extrabold tracking-wide uppercase">Từ đồng nghĩa</p>
          <div className="flex flex-wrap gap-2">
            {synonyms.map((word) => (
              <button
                key={word}
                type="button"
                lang="en"
                onClick={() => void playTts(word, { accent })}
                className="hover:bg-muted flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold"
              >
                <Volume2 className="text-muted-foreground size-3.5" aria-hidden="true" />{word}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LessonSummary({ setId, cards, scores, result }: {
  setId: string;
  cards: LessonCard[];
  scores: Scores;
  result: { added?: number; error?: string };
}) {
  const weak = cards.filter((card) => {
    const s = scores[card.id];
    return (s?.word ?? 1) < PASS_SCORE || (s?.example ?? 1) < PASS_SCORE;
  });
  const scored = Object.values(scores).flatMap((s) => [s.word, s.example]).filter((value): value is number => value !== undefined);
  const average = scored.length ? Math.round((scored.reduce((sum, value) => sum + value, 0) / scored.length) * 100) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-4">
      <section className="bg-card relative overflow-hidden rounded-[2rem] border-2 p-8 text-center shadow-[0_6px_0_var(--border)]">
        <div aria-hidden="true" className="bg-primary/15 absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl" />
        <span className="bg-primary text-primary-foreground relative mx-auto grid size-20 place-items-center rounded-3xl shadow-[0_5px_0_var(--primary-edge)]">
          <BookOpenCheck className="size-10" aria-hidden="true" />
        </span>
        <h1 className="relative mt-5 text-3xl font-black tracking-tight">Xong {cards.length} từ mới!</h1>
        <p role="status" className={cn("relative mt-1 text-lg", result.error ? "text-destructive font-bold" : "text-muted-foreground")}>
          {result.error ?? `Đã thêm ${result.added ?? 0} từ vào lịch ôn tập. Ôn đúng lúc để nhớ lâu.`}
        </p>
        <div className="relative mt-6 grid grid-cols-3 gap-3">
          <SummaryStat value={cards.length} label="Từ đã học" />
          <SummaryStat value={average === null ? "–" : `${average}%`} label="Phát âm TB" />
          <SummaryStat value={weak.length} label="Cần luyện thêm" />
        </div>
        <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/review" className={buttonVariants({ size: "lg" })}>Ôn tập ngay</Link>
          <Link href={`/sets/${setId}`} className={buttonVariants({ size: "lg", variant: "outline" })}>Về bộ từ</Link>
        </div>
      </section>
      {weak.length ? (
        <section className="bg-card rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)]">
          <h2 className="text-lg font-black">Nên luyện phát âm thêm</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {weak.map((card) => (
              <li key={card.id}>
                <button type="button" onClick={() => void playTts(card.term)} lang="en" className="border-brand-orange/40 bg-brand-orange/10 text-brand-orange flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-bold">
                  <Volume2 className="size-4" aria-hidden="true" />{card.term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SummaryStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-muted/60 rounded-2xl p-3">
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs font-extrabold uppercase">{label}</p>
    </div>
  );
}
