"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  cefrLevelSchema,
  splitHighlightedContent,
  type CefrLevel,
  type ReadingQuestion,
  type ReadingTerm,
} from "@/lib/ai/reading";
import { playTts } from "@/lib/speech/play-tts";

export interface ReadingPassageData {
  id: string;
  level: CefrLevel;
  content: string;
  questions: ReadingQuestion[];
  target_terms: ReadingTerm[];
}

const LEVELS = cefrLevelSchema.options;
const panel = "space-y-4 rounded-3xl border-2 bg-card p-5 shadow-[0_4px_0_var(--border)]";

async function requestPassage(setId: string, level: CefrLevel, fresh: boolean): Promise<ReadingPassageData> {
  const response = await fetch("/api/ai/reading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setId, level, fresh }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.passage) {
    throw new Error(data?.error ?? "Chưa tạo được bài đọc. Hãy thử lại.");
  }
  return data.passage as ReadingPassageData;
}

export function ReadingPractice({
  setId,
  title,
  aiEnabled,
  defaultLevel,
  initialPassage,
}: {
  setId: string;
  title: string;
  aiEnabled: boolean;
  defaultLevel: CefrLevel;
  initialPassage: ReadingPassageData | null;
}) {
  const [level, setLevel] = useState<CefrLevel>(initialPassage?.level ?? defaultLevel);
  const [passage, setPassage] = useState<ReadingPassageData | null>(initialPassage);
  const [busy, setBusy] = useState<"load" | "fresh">();
  const [error, setError] = useState("");
  const [activeTerm, setActiveTerm] = useState<ReadingTerm | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  const segments = useMemo(
    () => (passage ? splitHighlightedContent(passage.content, passage.target_terms) : []),
    [passage],
  );
  const score = useMemo(() => {
    if (!passage || !checked) return null;
    return passage.questions.reduce(
      (total, question, index) => total + (answers[index] === question.answer_index ? 1 : 0),
      0,
    );
  }, [passage, answers, checked]);

  const load = useCallback(async (nextLevel: CefrLevel, fresh: boolean) => {
    setBusy(fresh ? "fresh" : "load");
    setError("");
    setChecked(false);
    setAnswers({});
    setActiveTerm(null);
    try {
      setPassage(await requestPassage(setId, nextLevel, fresh));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa tạo được bài đọc.");
    } finally {
      setBusy(undefined);
    }
  }, [setId]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Đọc hiểu AI</h1>
          <Link href={`/sets/${setId}`} className="text-sm font-bold underline">Về bộ từ: {title}</Link>
        </div>
        <Link href="/history" className={buttonVariants({ variant: "outline" })}>Lịch sử</Link>
      </header>

      {!aiEnabled && <p role="status">AI chưa được bật. Bạn chưa thể tạo bài đọc mới.</p>}

      <section className={panel}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <label htmlFor="reading-level" className="block font-extrabold">Trình độ</label>
            <Select
              value={level}
              disabled={!!busy || !aiEnabled}
              onValueChange={(value) => {
                const next = value as CefrLevel;
                setLevel(next);
                void load(next, false);
              }}
            >
              <SelectTrigger id="reading-level" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!!busy || !aiEnabled}
            onClick={() => void load(level, true)}
          >
            {passage ? "Bài đọc mới" : "Tạo bài đọc"}
          </Button>
        </div>
        {busy && <LogoLoader size="sm" label={busy === "fresh" ? "Đang viết bài đọc mới" : "Đang tải bài đọc"} />}
      </section>

      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}

      {passage && (
        <>
          <section className={panel} aria-label="Bài đọc">
            <p className="text-sm text-muted-foreground">
              Trình độ {passage.level}. Bấm vào từ được tô sáng để xem nghĩa.
            </p>
            <div lang="en" className="text-lg leading-8">
              {segments.map((segment, index) =>
                segment.term ? (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveTerm(segment.term)}
                    className={`mx-0.5 rounded-lg px-1 font-bold underline decoration-dotted underline-offset-4 ${
                      activeTerm?.term === segment.term.term
                        ? "bg-accent text-accent-foreground"
                        : "bg-primary/15 hover:bg-primary/25"
                    }`}
                  >
                    {segment.text}
                  </button>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </div>
            {activeTerm && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-muted p-4">
                <p className="font-extrabold">
                  <span lang="en">{activeTerm.term}</span>
                  {activeTerm.definition_vi && <span className="ml-2 font-bold text-muted-foreground">{activeTerm.definition_vi}</span>}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => void playTts(activeTerm.term)}>
                  Nghe từ
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setActiveTerm(null)}>
                  Đóng
                </Button>
              </div>
            )}
          </section>

          <section className={panel} aria-label="Câu hỏi đọc hiểu">
            <h2 className="text-xl font-extrabold">Câu hỏi đọc hiểu</h2>
            <ol className="space-y-5">
              {passage.questions.map((question, qIndex) => (
                <li key={qIndex} className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
                  <p className="font-bold">{qIndex + 1}. {question.question}</p>
                  <div className="grid gap-2">
                    {question.options.map((option, oIndex) => {
                      const chosen = answers[qIndex] === oIndex;
                      const isAnswer = question.answer_index === oIndex;
                      const showResult = checked;
                      return (
                        <button
                          key={oIndex}
                          type="button"
                          disabled={checked}
                          onClick={() => setAnswers((prev) => ({ ...prev, [qIndex]: oIndex }))}
                          className={`rounded-2xl border-2 px-4 py-2 text-left font-bold ${
                            showResult && isAnswer
                              ? "border-primary bg-primary/15"
                              : showResult && chosen
                                ? "border-destructive bg-destructive/10"
                                : chosen
                                  ? "border-primary bg-primary/10"
                                  : "hover:border-primary/60"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {checked && (
                    <p className="text-sm text-muted-foreground">{question.explanation}</p>
                  )}
                </li>
              ))}
            </ol>
            {!checked ? (
              <Button
                type="button"
                disabled={Object.keys(answers).length < passage.questions.length}
                onClick={() => setChecked(true)}
              >
                Kiểm tra đáp án
              </Button>
            ) : (
              <p className="text-lg font-extrabold" role="status">
                Đúng {score}/{passage.questions.length} câu.
              </p>
            )}
          </section>
        </>
      )}

      {!passage && !busy && aiEnabled && (
        <p className="text-muted-foreground">Chọn trình độ rồi bấm “Tạo bài đọc” để bắt đầu.</p>
      )}
    </div>
  );
}
