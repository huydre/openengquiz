"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { choiceOptions, shuffled } from "@/lib/study/question-generator";
import { cardDefinition, type StudyCard } from "@/lib/study/study-types";
import type { StudyQuestion as Question } from "@/lib/study/build-questions";
import { playTts } from "@/lib/speech/play-tts";

type Props = {
  question: Question;
  card: StudyCard;
  cards: StudyCard[];
  onAnswer: (answer: string) => void;
};

export function StudyQuestion({ question, card, cards, onAnswer }: Props) {
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(15);
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

  useEffect(() => {
    if (question.type !== "game") return;
    const ticker = window.setInterval(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    const timer = window.setTimeout(() => onAnswer(""), 15000);
    return () => {
      window.clearInterval(ticker);
      window.clearTimeout(timer);
    };
  }, [question.type, onAnswer]);

  function speak() {
    void playTts(question.type === "dictation_example" ? card.example_en ?? card.term : card.term);
  }

  function prompt() {
    switch (question.type) {
      case "multiple_choice":
      case "game":
        return <>Chọn nghĩa đúng của <strong>{card.term}</strong></>;
      case "true_false":
        return <>“{card.term}” có nghĩa là “{statement}”?</>;
      case "match":
        return <>Ghép “{cardDefinition(card)}” với từ tiếng Anh</>;
      case "fill":
        return <>{card.example_en?.replace(new RegExp(card.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "_____") ?? cardDefinition(card)}</>;
      case "writing":
      case "learn_type":
        return <>Gõ từ tiếng Anh cho “{cardDefinition(card)}”</>;
      default:
        return <>Nghe rồi gõ {question.type === "dictation_example" ? "câu" : "từ"} bạn nghe được</>;
    }
  }

  return (
    <section className="space-y-5 rounded-3xl border-2 bg-card p-6 shadow-[0_4px_0_var(--border)]">
      <h2 className="text-xl font-extrabold">{prompt()}</h2>
      {question.type === "game" ? (
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`Còn ${timeLeft} giây`}>
          <div className="h-full bg-primary transition-[width] duration-1000"
            style={{ width: `${timeLeft / 15 * 100}%` }} />
        </div>
      ) : null}
      {isDictation ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={speak}>🔊 Phát âm</Button>
          <Button type="button" variant="outline" onClick={() => setAnswer(
            (question.type === "dictation_example" ? card.example_en ?? card.term : card.term).slice(0, 1),
          )}>Gợi ý chữ đầu</Button>
        </div>
      ) : null}
      {isChoice ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {choices.map((choice) => (
            <Button key={choice.id} type="button" variant="outline"
              className="h-auto min-h-14 justify-start whitespace-normal text-left"
              onClick={() => onAnswer(choice.label)}>
              {choice.label}
            </Button>
          ))}
        </div>
      ) : question.type === "true_false" ? (
        <div className="flex gap-3">
          <Button type="button" onClick={() => onAnswer("true")}>Đúng</Button>
          <Button type="button" variant="outline" onClick={() => onAnswer("false")}>Sai</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => {
          event.preventDefault();
          onAnswer(answer);
          setAnswer("");
        }}>
          <input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)}
            aria-label="Câu trả lời" autoComplete="off" spellCheck={false}
            className="min-h-12 flex-1 rounded-2xl border-2 bg-background px-4" />
          <Button type="submit" disabled={!answer.trim()}>Kiểm tra</Button>
        </form>
      )}
    </section>
  );
}
