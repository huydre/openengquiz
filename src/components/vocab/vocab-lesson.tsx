"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Mic, Quote, Volume2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enrollLearnedCards } from "@/app/(app)/sets/review-actions";
import { playTts, type TtsAccent } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";
import { PASS_SCORE, PronounceStep } from "./pronounce-step";

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
};

type Step = "learn" | "word" | "example";
type Scores = Record<string, { word?: number; example?: number }>;

const STEP_LABELS: Record<Step, string> = { learn: "Xem từ", word: "Đọc từ", example: "Đọc câu ví dụ" };

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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm font-bold">{title}</p>
          <h1 className="text-2xl font-black">Học từ mới</h1>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span id="lesson-accent">Giọng</span>
          <Select value={accent} onValueChange={(value) => setAccent(value as TtsAccent)}>
            <SelectTrigger aria-labelledby="lesson-accent" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">Mỹ</SelectItem>
              <SelectItem value="en-GB">Anh</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="space-y-2">
        <div className="text-muted-foreground flex justify-between text-sm font-bold">
          <span>Từ {index + 1}/{cards.length}</span>
          <span>{STEP_LABELS[step]}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Tiến độ bài học"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={done.length}
          className="bg-muted h-3 overflow-hidden rounded-full"
        >
          <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${(done.length / cards.length) * 100}%` }} />
        </div>
      </div>

      <section className="bg-card space-y-5 rounded-3xl border-2 p-6 shadow-[0_4px_0_var(--border)]">
        <ol className="flex gap-2" aria-label="Các bước">
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={s === step ? "step" : undefined}
              className={cn(
                "flex-1 rounded-full py-1 text-center text-xs font-extrabold uppercase",
                i < stepIndex ? "bg-primary/20 text-sidebar-accent-foreground" : s === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {STEP_LABELS[s]}
            </li>
          ))}
        </ol>

        {step === "learn" ? (
          <WordDetails card={card} accent={accent} />
        ) : (
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              {step === "word" ? <Mic aria-hidden="true" className="text-destructive size-5" /> : <Quote aria-hidden="true" className="text-secondary size-5" />}
              {step === "word" ? "Đọc to từ này" : "Đọc to câu ví dụ"}
            </h2>
            {step === "example" && card.example_vi ? (
              <p className="text-muted-foreground">{card.example_vi}</p>
            ) : null}
            <PronounceStep
              key={`${card.id}:${step}`}
              text={step === "word" ? card.term : card.example_en!}
              cardId={card.id}
              accent={accent}
              enabled={speechEnabled}
              onScored={(value) => record(step as "word" | "example", value)}
            />
          </div>
        )}

        {saveError && <p role="alert" className="text-destructive">{saveError}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 pt-4">
          {step !== "learn" && speechEnabled && currentScore === undefined ? (
            <button type="button" disabled={saving} className="text-muted-foreground text-sm font-bold underline" onClick={() => void next()}>
              Bỏ qua bước này
            </button>
          ) : null}
          <Button
            type="button"
            onClick={() => void next()}
            disabled={saving || (step !== "learn" && speechEnabled && currentScore === undefined)}
          >
            {isLastStep && index + 1 === cards.length ? "Hoàn thành" : "Tiếp"}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}

function WordDetails({ card, accent }: { card: LessonCard; accent: TtsAccent }) {
  const synonyms = card.synonyms?.filter(Boolean) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h2 lang="en" className="text-4xl font-black">{card.term}</h2>
        {card.ipa ? <span className="text-muted-foreground text-lg">{card.ipa}</span> : null}
        {card.part_of_speech ? (
          <span className="bg-secondary/15 text-secondary rounded-full px-3 py-0.5 text-sm font-bold">{card.part_of_speech}</span>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={() => void playTts(card.term, { accent })}>
          <Volume2 aria-hidden="true" /> Nghe
        </Button>
      </div>

      <div className="space-y-1">
        {card.definition_vi ? <p className="text-xl font-bold">{card.definition_vi}</p> : null}
        {card.definition_en ? <p lang="en" className="text-muted-foreground">{card.definition_en}</p> : null}
      </div>

      {card.example_en ? (
        <div className="bg-muted space-y-1 rounded-2xl p-4">
          <p className="flex items-start gap-2">
            <Quote aria-hidden="true" className="text-secondary mt-1 size-4 shrink-0" />
            <span lang="en" className="font-semibold">{card.example_en}</span>
          </p>
          {card.example_vi ? <p className="text-muted-foreground pl-6 text-sm">{card.example_vi}</p> : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void playTts(card.example_en!, { accent })}>
            <Volume2 aria-hidden="true" /> Nghe câu
          </Button>
        </div>
      ) : null}

      {synonyms.length ? (
        <div className="space-y-2">
          <p className="text-sm font-extrabold uppercase">Từ đồng nghĩa</p>
          <div className="flex flex-wrap gap-2">
            {synonyms.map((word) => (
              <button
                key={word}
                type="button"
                lang="en"
                onClick={() => void playTts(word, { accent })}
                className="hover:bg-muted rounded-full border-2 px-3 py-1 text-sm font-bold"
              >
                {word}
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
  return (
    <div className="mx-auto max-w-2xl space-y-5 text-center">
      <BookOpenCheck aria-hidden="true" className="text-primary mx-auto size-14" />
      <h1 className="text-3xl font-black">Xong {cards.length} từ!</h1>
      <p role="status" className={result.error ? "text-destructive font-bold" : "text-muted-foreground"}>
        {result.error ?? `Đã thêm ${result.added ?? 0} từ mới vào lịch ôn tập.`}
      </p>
      {weak.length ? (
        <div className="bg-card rounded-3xl border-2 p-5 text-left">
          <p className="mb-2 font-extrabold">Nên luyện phát âm thêm</p>
          <ul className="flex flex-wrap gap-2">
            {weak.map((card) => (
              <li key={card.id} lang="en" className="text-destructive rounded-full border-2 px-3 py-1 font-bold">{card.term}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/review" className={buttonVariants()}>Ôn tập ngay</Link>
        <Link href={`/sets/${setId}`} className={buttonVariants({ variant: "outline" })}>Về bộ từ</Link>
      </div>
    </div>
  );
}
