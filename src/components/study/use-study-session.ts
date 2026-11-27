"use client";

import { useRef, useState } from "react";
import { gradeAttempt } from "@/lib/study/answer-matcher";
import { cardDefinition } from "@/lib/study/study-types";
import { buildQuestions, type StudyQuestion } from "@/lib/study/build-questions";
import { advanceLearn, createLearnState } from "@/lib/study/learn-algorithm";
import type { QuestionType, StudyAttempt, StudyCard, StudyMode } from "@/lib/study/study-types";

type RecordedAttempt = StudyAttempt & { correct: boolean };
type Result = { status: string; score: number; total: number };

export function useStudySession(setId: string, mode: StudyMode, cards: StudyCard[]) {
  const [status, setStatus] = useState<"setup" | "starting" | "active" | "saving" | "save-error" | "finished">("setup");
  const attemptGuard = useRef(-1);
  const [sessionId, setSessionId] = useState("");
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [learn, setLearn] = useState(() => createLearnState(cards.map((card) => card.id)));
  const [attempts, setAttempts] = useState<RecordedAttempt[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const current: StudyQuestion | undefined = mode === "learn"
    ? learn.queue[0] && {
      cardId: learn.queue[0].cardId,
      type: learn.queue[0].stage === "choice" ? "multiple_choice" : "learn_type",
    }
    : questions[index];

  async function start(count: number, quizTypes: QuestionType[]) {
    setError("");
    setStatus("starting");
    try {
      const response = await fetch("/api/study/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, mode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setSessionId(payload.sessionId);
      setQuestions(buildQuestions(mode, cards, count, quizTypes));
      setIndex(0);
      setAttempts([]);
      attemptGuard.current = -1;
      setLearn(createLearnState(cards.map((card) => card.id)));
      setStatus("active");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không bắt đầu được phiên học.");
      setStatus("setup");
    }
  }

  async function save(recorded: RecordedAttempt[]) {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/study/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, attempts: recorded }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setResult(payload as Result);
      setStatus("finished");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được kết quả.");
      setStatus("save-error");
    }
  }

  async function submit(answer: string) {
    if (!current || status !== "active" || attemptGuard.current === attempts.length) return;
    const card = cards.find((item) => item.id === current.cardId);
    if (!card) return;
    attemptGuard.current = attempts.length;
    const attempt: StudyAttempt = {
      card_id: card.id,
      question_type: current.type,
      answer,
      ...(current.type === "true_false" ? {
        statement: current.statement ?? cardDefinition(card),
      } : {}),
    };
    const correct = gradeAttempt(attempt, card);
    const recorded = [...attempts, { ...attempt, correct }];
    setAttempts(recorded);
    if (mode === "learn") {
      const next = advanceLearn(learn, correct);
      setLearn(next);
      if (!next.queue.length && !next.remaining.length) await save(recorded);
      return;
    }
    if (mode === "writing" && !correct) {
      setQuestions([...questions, current]);
    }
    setIndex(index + 1);
    if (index + 1 >= questions.length && !(mode === "writing" && !correct)) {
      await save(recorded);
    }
  }

  return {
    status, current, index, learn, questions, attempts, result, error,
    start, submit, retry: () => save(attempts),
  };
}
