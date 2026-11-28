"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Lightbulb, Snail, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { choiceOptions, shuffled } from "@/lib/study/question-generator";
import { expectedAnswer, gradeAttempt } from "@/lib/study/answer-matcher";
import { cardDefinition, type StudyAttempt, type StudyCard } from "@/lib/study/study-types";
import type { StudyQuestion as Question } from "@/lib/study/build-questions";
import { playTts } from "@/lib/speech/play-tts";
import { Ipa } from "@/components/vocab/ipa-text";

type Props = {
  question: Question;
  card: StudyCard;
  cards: StudyCard[];
  onAnswer: (answer: string) => void;
};

const GAME_SECONDS = 15;
const GAME_FLASH_MS = 650;

const TYPE_LABELS: Record<Question["type"], string> = {
  multiple_choice: "Chọn nghĩa đúng",
  game: "Chọn nghĩa đúng",
  true_false: "Đúng hay sai",
  match: "Chọn từ tiếng Anh",
  fill: "Điền vào chỗ trống",
  writing: "Gõ từ tiếng Anh",
  learn_type: "Gõ từ tiếng Anh",
  dictation_term: "Nghe và gõ từ",
  dictation_example: "Nghe và gõ câu",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One question of a study session. The learner answers, sees whether it was right together with
 * the correct answer, and moves on with "Tiếp tục" (or Enter). In the speed game the result only
 * flashes, so the pace stays fast. Choices can be picked with the number keys.
 */
export function StudyQuestion({ question, card, cards, onAnswer }: Props) {
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const continueRef = useRef<HTMLButtonElement>(null);
  const isGame = question.type === "game";

  const choices = useMemo(() => {
    if (question.type === "match") {
      return shuffled([{ id: card.id, label: card.term }, ...cards.filter((item) => item.id !== card.id)
        .slice(0, 3).map((item) => ({ id: item.id, label: item.term }))]);
    }
    return shuffled(choiceOptions(card, cards));
  }, [question.type, card, cards]);
  const isChoice = ["multiple_choice", "game", "match"].includes(question.type);
  const isDictation = question.type.startsWith("dictation");
  const statement = question.statement ?? cardDefinition(card);
  const audioText = question.type === "dictation_example" ? card.example_en ?? card.term : card.term;

  const attemptFor = useCallback((answer: string): StudyAttempt => ({
    card_id: card.id,
    question_type: question.type,
    answer,
    ...(question.type === "true_false" ? { statement } : {}),
  }), [card.id, question.type, statement]);

  const correct = picked === null ? null : gradeAttempt(attemptFor(picked), card);
  const expected = expectedAnswer(attemptFor(picked ?? ""), card);

  const englishChoices = question.type === "match";
  const answer = useCallback((value: string) => {
    if (picked !== null) return;
    setPicked(value);
    // English answer choices are read aloud when picked, like a flashcard.
    if (englishChoices) void playTts(value);
  }, [picked, englishChoices]);

  // Speed game: a ticking timer that answers blank at zero, and a short flash before moving on.
  useEffect(() => {
    if (!isGame || picked !== null) return;
    const ticker = window.setInterval(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    const timer = window.setTimeout(() => setPicked(""), GAME_SECONDS * 1000);
    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(timer);
    };
  }, [isGame, picked]);
  useEffect(() => {
    if (!isGame || picked === null) return;
    const timer = window.setTimeout(() => onAnswer(picked), GAME_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [isGame, picked, onAnswer]);

  // Dictation plays the audio as soon as the question appears.
  useEffect(() => {
    if (isDictation) void playTts(audioText);
  }, [isDictation, audioText]);

  useEffect(() => {
    if (picked !== null && !isGame) continueRef.current?.focus();
  }, [picked, isGame]);

  // Number keys pick a choice; Enter continues after the feedback.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (picked === null && isChoice) {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < choices.length) answer(choices[index].label);
      } else if (picked === null && question.type === "true_false") {
        if (event.key === "1") answer("true");
        if (event.key === "2") answer("false");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, isChoice, choices, answer, question.type]);

  function speak(slow = false) {
    void playTts(audioText, slow ? { speed: 0.7 } : undefined);
  }

  function choiceState(label: string) {
    if (picked === null) return "idle";
    if (label === picked) return correct ? "correct" : "wrong";
    if (gradeAttempt(attemptFor(label), card)) return "answer";
    return "dim";
  }

  return (
    <div className="space-y-4">
      <section className="bg-card rounded-[2rem] border-2 p-6 shadow-[0_6px_0_var(--border)] sm:p-8">
        <p className="text-muted-foreground text-xs font-extrabold tracking-wide uppercase">{TYPE_LABELS[question.type]}</p>

        {isGame ? (
          <div className="mt-4 flex items-center gap-3" aria-label={`Còn ${timeLeft} giây`}>
            <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", timeLeft <= 5 ? "bg-destructive" : "bg-brand-orange")}
                style={{ width: `${(timeLeft / GAME_SECONDS) * 100}%` }}
              />
            </div>
            <span className={cn("w-8 text-right text-sm font-black tabular-nums", timeLeft <= 5 && "text-destructive")}>{timeLeft}s</span>
          </div>
        ) : null}

        <div className="mt-5">
          <Prompt question={question} card={card} statement={statement} onSpeak={() => speak()} />
        </div>

        {isDictation ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => speak()}
              aria-label="Nghe lại"
              className="bg-secondary text-secondary-foreground grid size-20 place-items-center rounded-full shadow-[0_6px_0_var(--secondary-edge)] transition-transform active:translate-y-1 active:shadow-none"
            >
              <Volume2 className="size-9" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => speak(true)}
              aria-label="Nghe chậm"
              className="bg-card text-secondary grid size-14 place-items-center rounded-full border-2 shadow-[0_4px_0_var(--border)] active:translate-y-1 active:shadow-none"
            >
              <Snail className="size-6" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="mt-7">
          {isChoice ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {choices.map((choice, index) => (
                <ChoiceTile
                  key={choice.id}
                  index={index}
                  label={choice.label}
                  state={choiceState(choice.label)}
                  english={englishChoices}
                  ipa={englishChoices ? [card, ...cards].find((item) => item.id === choice.id)?.ipa : undefined}
                  // After answering, English choices stay clickable to hear them again.
                  disabled={picked !== null && !englishChoices}
                  onClick={() => (picked === null ? answer(choice.label) : void playTts(choice.label))}
                />
              ))}
            </div>
          ) : question.type === "true_false" ? (
            <div className="grid grid-cols-2 gap-3">
              {(["true", "false"] as const).map((value, index) => (
                <ChoiceTile
                  key={value}
                  index={index}
                  label={value === "true" ? "Đúng" : "Sai"}
                  icon={value === "true" ? <Check className="size-5" aria-hidden="true" /> : <X className="size-5" aria-hidden="true" />}
                  state={picked === null ? "idle" : value === picked ? (correct ? "correct" : "wrong") : gradeAttempt(attemptFor(value), card) ? "answer" : "dim"}
                  disabled={picked !== null}
                  onClick={() => answer(value)}
                />
              ))}
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (typed.trim()) answer(typed);
              }}
            >
              <input
                autoFocus
                value={typed}
                readOnly={picked !== null}
                onChange={(event) => setTyped(event.target.value)}
                aria-label="Câu trả lời"
                placeholder={isDictation ? "Gõ những gì bạn nghe được..." : "Gõ câu trả lời..."}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                lang="en"
                className={cn(
                  "bg-background h-16 w-full rounded-2xl border-2 px-5 text-xl font-bold outline-none transition-colors",
                  picked === null && "focus:border-secondary",
                  picked !== null && (correct ? "border-primary bg-primary/10" : "border-destructive bg-destructive/10"),
                )}
              />
              {picked === null ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {isDictation || question.type === "writing" || question.type === "learn_type" ? (
                    <button
                      type="button"
                      onClick={() => setTyped(expected.slice(0, Math.max(1, typed.length + 1)))}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-extrabold"
                    >
                      <Lightbulb className="size-4" aria-hidden="true" /> Gợi ý thêm một chữ
                    </button>
                  ) : <span />}
                  <Button type="submit" size="lg" disabled={!typed.trim()}>Kiểm tra</Button>
                </div>
              ) : null}
            </form>
          )}
        </div>
      </section>

      {picked !== null && !isGame ? (
        <Feedback
          correct={Boolean(correct)}
          expected={expected}
          example={!correct && question.type !== "dictation_example" ? card.example_en : null}
          continueRef={continueRef}
          onContinue={() => onAnswer(picked)}
        />
      ) : null}
    </div>
  );
}

function Prompt({ question, card, statement, onSpeak }: { question: Question; card: StudyCard; statement: string; onSpeak: () => void }) {
  const speaker = (
    <button
      type="button"
      onClick={onSpeak}
      aria-label={`Nghe phát âm ${card.term}`}
      className="bg-secondary/15 text-secondary hover:bg-secondary/25 grid size-11 shrink-0 place-items-center rounded-2xl transition-colors"
    >
      <Volume2 className="size-5" aria-hidden="true" />
    </button>
  );
  switch (question.type) {
    case "multiple_choice":
    case "game":
      return (
        <div className="flex items-center gap-3">
          {speaker}
          <h2 lang="en" className="text-4xl font-black tracking-tight break-words">{card.term}</h2>
        </div>
      );
    case "true_false":
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {speaker}
            <h2 lang="en" className="text-4xl font-black tracking-tight break-words">{card.term}</h2>
          </div>
          <p className="bg-muted/70 rounded-2xl px-5 py-4 text-xl font-bold">có nghĩa là &ldquo;{statement}&rdquo;</p>
        </div>
      );
    case "match":
      return <h2 className="text-3xl font-black tracking-tight text-balance">{cardDefinition(card)}</h2>;
    case "fill": {
      // Blank the term inside the example. The term may end in punctuation the sentence lacks
      // ("let's play a game!"), so match without it; if the example still does not contain the
      // term, ask by meaning instead so the answer is never shown.
      const core = card.term.trim().replace(/[\s.!?,;:]+$/u, "");
      const parts = card.example_en && core ? card.example_en.split(new RegExp(`(${escapeRegExp(core)})`, "i")) : [];
      if (parts.length < 3) return <h2 className="text-3xl font-black tracking-tight text-balance">{cardDefinition(card)}</h2>;
      return (
        <div className="space-y-3">
          <h2 lang="en" className="text-2xl leading-relaxed font-extrabold sm:text-3xl">
            {parts.map((part, index) => part.toLowerCase() === core.toLowerCase()
              ? <span key={index} aria-label="chỗ trống" className="border-secondary bg-secondary/10 mx-1 inline-block min-w-24 rounded-lg border-b-4 align-baseline">&nbsp;</span>
              : <span key={index}>{part}</span>)}
          </h2>
          <p className="text-muted-foreground font-bold">Gợi ý nghĩa: {cardDefinition(card)}</p>
        </div>
      );
    }
    case "writing":
    case "learn_type":
      return <h2 className="text-3xl font-black tracking-tight text-balance">{cardDefinition(card)}</h2>;
    default:
      return <h2 className="text-center text-2xl font-black tracking-tight">Bấm để nghe lại bất cứ lúc nào</h2>;
  }
}

type TileState = "idle" | "correct" | "wrong" | "answer" | "dim";

function ChoiceTile({ index, label, state, disabled, english = false, ipa, icon, onClick }: {
  index: number;
  label: string;
  ipa?: string | null;
  state: TileState;
  disabled: boolean;
  english?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      lang={english ? "en" : undefined}
      className={cn(
        "flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-bold transition-all",
        state === "idle" && "bg-card hover:border-secondary/60 hover:bg-secondary/5 shadow-[0_4px_0_var(--border)] active:translate-y-1 active:shadow-none",
        state === "correct" && "border-primary bg-primary/15 text-primary-edge shadow-[0_4px_0_var(--primary-edge)]",
        state === "answer" && "border-primary bg-primary/10 text-primary-edge",
        state === "wrong" && "border-destructive bg-destructive/10 text-destructive animate-[study-shake_0.35s_ease-in-out]",
        state === "dim" && "opacity-45",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-xl border-2 text-sm font-black",
          state === "correct" || state === "answer" ? "border-primary bg-primary text-primary-foreground" : state === "wrong" ? "border-destructive bg-destructive text-white" : "text-muted-foreground",
        )}
      >
        {state === "correct" || state === "answer" ? <Check className="size-4" /> : state === "wrong" ? <X className="size-4" /> : icon ?? index + 1}
      </span>
      <span className="min-w-0 flex-1 break-words">
        {label}
        {ipa ? <Ipa value={ipa} className="block text-sm font-semibold opacity-70" /> : null}
      </span>
      {english && state !== "idle" ? <Volume2 className="size-4 shrink-0 opacity-60" aria-hidden="true" /> : null}
    </button>
  );
}

function Feedback({ correct, expected, example, continueRef, onContinue }: {
  correct: boolean;
  expected: string;
  example: string | null;
  continueRef: React.RefObject<HTMLButtonElement | null>;
  onContinue: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "sticky bottom-4 z-10 flex flex-col gap-4 rounded-3xl border-2 p-5 sm:flex-row sm:items-center animate-[study-rise_0.25s_ease-out]",
        correct ? "border-primary/40 bg-primary/12" : "border-destructive/40 bg-destructive/10",
      )}
    >
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-full text-white", correct ? "bg-primary" : "bg-destructive")}>
        {correct ? <Check className="size-7" aria-hidden="true" /> : <X className="size-7" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-xl font-black", correct ? "text-primary-edge" : "text-destructive")}>{correct ? "Chính xác!" : "Chưa đúng"}</p>
        {!correct ? (
          <p className="mt-0.5 font-bold">Đáp án: <span lang="en">{expected}</span></p>
        ) : null}
        {example ? <p lang="en" className="text-muted-foreground mt-1 text-sm font-semibold italic">{example}</p> : null}
      </div>
      <button
        ref={continueRef}
        type="button"
        onClick={onContinue}
        className={cn(
          "h-12 shrink-0 rounded-2xl px-8 font-extrabold text-white uppercase active:translate-y-1 active:shadow-none",
          correct ? "bg-primary shadow-[0_4px_0_var(--primary-edge)]" : "bg-destructive shadow-[0_4px_0_oklch(0.5_0.2_25)]",
        )}
      >
        Tiếp tục
      </button>
    </div>
  );
}
