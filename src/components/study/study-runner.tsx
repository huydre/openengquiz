"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Flame, Layers, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoLoader } from "@/components/layout/logo-loader";
import { cn } from "@/lib/utils";
import { StudyQuestion } from "./study-question";
import { ResultSummary } from "./result-summary";
import { useStudySession } from "./use-study-session";
import { STUDY_MODE_META } from "./study-mode-meta";
import { ModeIntro, OptionPill } from "./mode-shell";
import type { QuestionType, StudyCard, StudyMode } from "@/lib/study/study-types";

const STAGE_LABELS = { recognition: "Nhận diện", recall: "Nhớ lại", review: "Ôn lại từ đã thuộc" } as const;

const QUIZ_TYPES: { type: QuestionType; label: string }[] = [
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
  const [quizTypes, setQuizTypes] = useState<QuestionType[]>(QUIZ_TYPES.map((item) => item.type));
  const session = useStudySession(setId, mode, cards);
  const meta = STUDY_MODE_META[mode];
  const card = cards.find((item) => item.id === session.current?.cardId);
  const progress = mode === "learn" ? session.learn.mastered.length : session.index;
  const total = mode === "learn" ? cards.length : session.questions.length;
  const inSession = session.status === "active" && card && session.current;

  // Live game score and streak, mirroring the server's scoring (100 points plus 20 per streak step, capped).
  const gameScore = session.attempts.reduce(({ sum, combo }, attempt) => {
    const streak = attempt.correct ? combo + 1 : 0;
    return { sum: sum + (attempt.correct ? 100 + Math.min(streak - 1, 5) * 20 : 0), combo: streak };
  }, { sum: 0, combo: 0 }).sum;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Session bar: close, progress and counter. */}
      <div className="flex items-center gap-3">
        <Link
          href={`/sets/${setId}`}
          aria-label={`Thoát, về bộ từ ${title}`}
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-10 shrink-0 place-items-center rounded-xl transition-colors"
        >
          <X className="size-6" aria-hidden="true" />
        </Link>
        {inSession ? (
          <>
            <div
              role="progressbar"
              aria-label="Tiến độ"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={progress}
              className="bg-muted h-4 flex-1 overflow-hidden rounded-full"
            >
              <div
                className={cn("relative h-full rounded-full transition-[width] duration-500 ease-out", mode === "game" ? "bg-brand-orange" : "bg-primary")}
                style={{ width: `${total ? Math.max(4, (progress / total) * 100) : 0}%` }}
              >
                <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
              </div>
            </div>
            {mode === "game" ? (
              <span className="flex items-center gap-1.5 text-sm font-black tabular-nums">
                <Flame className="text-brand-orange size-5" aria-hidden="true" />{gameScore}
              </span>
            ) : (
              <span className="text-muted-foreground w-14 text-right text-sm font-black tabular-nums">{progress}/{total}</span>
            )}
          </>
        ) : (
          <p className="text-muted-foreground truncate text-sm font-extrabold">{title}</p>
        )}
      </div>

      {!cards.length ? (
        <EmptySet setId={setId} />
      ) : session.status === "setup" || session.status === "starting" ? (
        <ModeIntro
          icon={meta.icon}
          tone={meta.tone}
          title={meta.label}
          description={meta.description}
          badges={
            <>
              <span className="bg-card flex items-center gap-1.5 rounded-full border-2 px-3 py-1"><Layers className="size-4" aria-hidden="true" />{cards.length} thẻ · {title}</span>
              {mode === "game" && highScore > 0 ? (
                <span className="bg-accent/20 text-accent-foreground flex items-center gap-1.5 rounded-full px-3 py-1"><Trophy className="size-4" aria-hidden="true" />Kỷ lục {highScore}</span>
              ) : null}
            </>
          }
          footer={
            <>
              <p className="text-muted-foreground text-sm font-bold">Mẹo: dùng phím số để chọn đáp án, Enter để tiếp tục.</p>
              <Button
                type="button"
                size="lg"
                className="h-14 px-10 text-base"
                disabled={session.status === "starting" || (mode === "quiz" && !quizTypes.length)}
                onClick={() => session.start(count, quizTypes)}
              >
                {session.status === "starting" ? "Đang bắt đầu..." : <>Bắt đầu <ArrowRight aria-hidden="true" /></>}
              </Button>
            </>
          }
        >
          {mode === "quiz" || session.error ? (<>{mode === "quiz" ? (
            <>
              <div>
                <p id="quiz-count" className="mb-2 font-extrabold">Số câu</p>
                <div role="group" aria-labelledby="quiz-count" className="flex flex-wrap gap-2">
                  {[5, 10, 20, cards.length].filter((value, index, values) => value <= cards.length && values.indexOf(value) === index).map((value) => (
                    <OptionPill key={value} selected={count === value} onClick={() => setCount(value)}>
                      {value === cards.length && value > 20 ? `Tất cả (${value})` : value}
                    </OptionPill>
                  ))}
                </div>
              </div>
              <div>
                <p id="quiz-types" className="mb-2 font-extrabold">Dạng câu</p>
                <div role="group" aria-labelledby="quiz-types" className="flex flex-wrap gap-2">
                  {QUIZ_TYPES.map((choice) => {
                    const on = quizTypes.includes(choice.type);
                    return (
                      <OptionPill key={choice.type} tone="primary" selected={on}
                        onClick={() => setQuizTypes((current) => on ? current.filter((item) => item !== choice.type) : [...current, choice.type])}>
                        {choice.label}
                      </OptionPill>
                    );
                  })}
                </div>
                {!quizTypes.length ? <p className="text-destructive mt-2 text-sm font-bold">Chọn ít nhất một dạng câu.</p> : null}
              </div>
            </>
          ) : null}
          {session.error ? <p role="alert" className="text-destructive font-bold">{session.error}</p> : null}</>) : null}
        </ModeIntro>
      ) : session.status === "finished" && session.result ? (
        <ResultSummary
          mode={mode}
          setId={setId}
          cards={cards}
          attempts={session.attempts}
          score={session.result.score}
          total={session.result.total}
          onRestart={() => session.start(count, quizTypes)}
        />
      ) : session.status === "saving" ? (
        <LogoLoader label="Đang lưu kết quả..." />
      ) : session.status === "save-error" ? (
        <section className="bg-card space-y-4 rounded-[2rem] border-2 p-8 text-center shadow-[0_6px_0_var(--border)]">
          <p role="alert" className="text-destructive text-lg font-bold">{session.error}</p>
          <Button type="button" size="lg" onClick={session.retry}>Thử lưu lại</Button>
        </section>
      ) : inSession ? (
        <>
          {mode === "learn" ? (
            <p className="text-muted-foreground text-sm font-extrabold">
              Đợt {session.learn.batch} · {STAGE_LABELS[session.learn.queue[0]?.stage ?? "recognition"]}
            </p>
          ) : null}
          <StudyQuestion
            key={`${session.index}-${session.attempts.length}`}
            question={session.current!}
            card={card!}
            cards={cards}
            onAnswer={session.submit}
          />
        </>
      ) : null}
    </div>
  );
}

function EmptySet({ setId }: { setId: string }) {
  return (
    <section className="bg-card space-y-4 rounded-[2rem] border-2 p-8 text-center shadow-[0_6px_0_var(--border)]">
      <p role="status" className="text-xl font-black">Bộ từ chưa có thẻ nào</p>
      <p className="text-muted-foreground">Thêm vài thẻ rồi quay lại học nhé.</p>
      <Link href={`/sets/${setId}`} className="text-primary-edge inline-block font-extrabold underline">Thêm thẻ</Link>
    </section>
  );
}
