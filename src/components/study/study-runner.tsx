"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StudyQuestion } from "./study-question";
import { ResultSummary } from "./result-summary";
import { useStudySession } from "./use-study-session";
import type { QuestionType, StudyCard, StudyMode } from "@/lib/study/study-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const labels: Record<StudyMode, string> = {
  learn: "Học từ mới",
  quiz: "Kiểm tra",
  dictation: "Nghe viết",
  writing: "Luyện viết",
  game: "Thử thách tốc độ",
};
const quizChoices: { type: QuestionType; label: string }[] = [
  { type: "multiple_choice", label: "Trắc nghiệm" },
  { type: "true_false", label: "Đúng / Sai" },
  { type: "fill", label: "Điền từ" },
  { type: "match", label: "Nối từ" },
];

export function StudyRunner({ setId, title, mode, cards, highScore = 0 }: {
  setId: string;
  title: string;
  mode: StudyMode;
  cards: StudyCard[];
  highScore?: number;
}) {
  const [count, setCount] = useState(Math.min(10, cards.length));
  const [quizTypes, setQuizTypes] = useState<QuestionType[]>(quizChoices.map((item) => item.type));
  const session = useStudySession(setId, mode, cards);
  const card = cards.find((item) => item.id === session.current?.cardId);
  const progress = mode === "learn"
    ? session.learn.mastered.length
    : session.index;
  const total = mode === "learn" ? cards.length : session.questions.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/sets/${setId}`} className="text-sm font-bold underline">← {title}</Link>
      <header className="space-y-1">
        <p className="text-sm font-bold text-primary">{title}</p>
        <h1 className="text-3xl font-black">{labels[mode]}</h1>
        {mode === "game" && highScore > 0 ? <p>Điểm cao nhất của bạn: {highScore}</p> : null}
      </header>
      {!cards.length ? (
        <p role="status">Bộ từ chưa có thẻ. Hãy thêm thẻ trước khi học.</p>
      ) : session.status === "setup" ? (
        <section className="space-y-5 rounded-3xl border-2 bg-card p-6">
          <p>
            {mode === "learn" ? "Học từng đợt 6 thẻ. Thẻ sai sẽ xuất hiện lại." :
              mode === "writing" ? "Gõ từ theo nghĩa. Từ sai sẽ quay lại." :
                mode === "dictation" ? "Nghe phát âm rồi gõ lại từ hoặc câu ví dụ." :
                  mode === "game" ? "Chọn nghĩa đúng trong 15 giây mỗi câu. Chuỗi đúng tăng điểm." :
                    "Chọn số câu và loại câu để bắt đầu."}
          </p>
          {mode === "quiz" ? (
            <div className="space-y-4">
              <label className="block font-bold">
                Số câu
                <Select value={String(count)} onValueChange={(value) => setCount(Number(value))}>
                  <SelectTrigger className="ml-3 inline-flex">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, cards.length].filter((value, index, values) =>
                      value <= cards.length && values.indexOf(value) === index,
                    ).map((value) => (
                      <SelectItem key={value} value={String(value)}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <fieldset className="flex flex-wrap gap-4">
                <legend className="mb-2 font-bold">Loại câu</legend>
                {quizChoices.map((choice) => (
                  <label key={choice.type} className="flex items-center gap-2">
                    <input type="checkbox" checked={quizTypes.includes(choice.type)}
                      onChange={() => setQuizTypes((current) => current.includes(choice.type)
                        ? current.filter((item) => item !== choice.type)
                        : [...current, choice.type])} />
                    {choice.label}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : null}
          {session.error ? <p role="alert" className="text-destructive">{session.error}</p> : null}
          <Button type="button" disabled={mode === "quiz" && !quizTypes.length}
            onClick={() => session.start(count, quizTypes)}>Bắt đầu</Button>
        </section>
      ) : session.status === "starting" ? (
        <p role="status">Đang bắt đầu...</p>
      ) : session.status === "finished" && session.result ? (
        <ResultSummary mode={mode} setId={setId} cards={cards}
          attempts={session.attempts} score={session.result.score} total={session.result.total} />
      ) : session.status === "saving" ? (
        <p role="status">Đang lưu kết quả...</p>
      ) : session.status === "save-error" ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive">{session.error}</p>
          <Button type="button" onClick={session.retry}>Thử lưu lại</Button>
        </div>
      ) : card && session.current ? (
        <>
          <div aria-label={`Tiến độ ${progress} trên ${total}`}
            className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary"
              style={{ width: `${total ? progress / total * 100 : 0}%` }} />
          </div>
          <p className="text-sm font-bold">Đã hoàn thành {progress}/{total}</p>
          <StudyQuestion key={`${session.index}-${session.attempts.length}`}
            question={session.current} card={card} cards={cards} onAnswer={session.submit} />
        </>
      ) : null}
    </div>
  );
}
