"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, BookOpenText, Check, History, RefreshCw, Sparkles, Volume2, X } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { ModeCard, ModeIntro, ModeNotice, ModeTopBar, OptionPill, TopBarLink } from "@/components/study/mode-shell";
import { cn } from "@/lib/utils";
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

  const levelPicker = (
    <div role="radiogroup" aria-label="Trình độ" className="flex flex-wrap gap-2">
      {LEVELS.map((item) => (
        <OptionPill
          key={item}
          selected={level === item}
          disabled={!!busy || !aiEnabled}
          onClick={() => {
            setLevel(item);
            if (passage) void load(item, false);
          }}
        >
          {item}
        </OptionPill>
      ))}
    </div>
  );
  const answeredAll = passage ? Object.keys(answers).length >= passage.questions.length : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <ModeTopBar setId={setId} title={title}>
        <TopBarLink href="/history" icon={History}>Lịch sử</TopBarLink>
      </ModeTopBar>

      {!aiEnabled ? <ModeNotice>AI chưa được bật. Bạn chưa thể tạo bài đọc mới.</ModeNotice> : null}

      {!passage ? (
        <ModeIntro
          icon={BookOpenText}
          tone="bg-brand-grape/15 text-brand-grape"
          title="Đọc hiểu AI"
          description="AI viết một bài đọc ngắn dùng chính các từ trong bộ, kèm câu hỏi đọc hiểu. Bấm vào từ được tô sáng để xem nghĩa."
          footer={
            <>
              <p className="text-muted-foreground text-sm font-bold">Bài đọc mất khoảng 10 giây để tạo.</p>
              <Button type="button" size="lg" className="h-14 px-10 text-base" disabled={!!busy || !aiEnabled} onClick={() => void load(level, true)}>
                {busy ? "Đang viết bài đọc..." : <><Sparkles aria-hidden="true" /> Tạo bài đọc</>}
              </Button>
            </>
          }
        >
          <div>
            <p className="mb-2 font-extrabold">Trình độ</p>
            {levelPicker}
          </div>
        </ModeIntro>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {levelPicker}
          <Button type="button" variant="outline" disabled={!!busy || !aiEnabled} onClick={() => void load(level, true)}>
            <RefreshCw aria-hidden="true" /> Bài đọc mới
          </Button>
        </div>
      )}

      {busy && passage ? <LogoLoader size="sm" label={busy === "fresh" ? "Đang viết bài đọc mới" : "Đang tải bài đọc"} /> : null}
      {error ? <p role="alert" className="text-destructive font-bold">{error}</p> : null}

      {passage && !busy ? (
        <>
          <ModeCard aria-label="Bài đọc" className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="bg-brand-grape/15 text-brand-grape rounded-full px-3 py-1 text-xs font-extrabold uppercase">Bài đọc · {passage.level}</span>
              <button type="button" onClick={() => void playTts(passage.content)} className="text-secondary flex items-center gap-1.5 text-sm font-extrabold">
                <Volume2 className="size-4" aria-hidden="true" /> Nghe cả bài
              </button>
            </div>
            <div lang="en" className="text-xl leading-9 font-medium">
              {segments.map((segment, index) =>
                segment.term ? (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveTerm(segment.term)}
                    className={cn(
                      "rounded-lg px-1 font-extrabold underline decoration-2 decoration-dotted underline-offset-4 transition-colors",
                      activeTerm?.term === segment.term.term ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary-edge hover:bg-primary/25",
                    )}
                  >
                    {segment.text}
                  </button>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </div>
            {activeTerm ? (
              <div className="bg-muted/70 sticky bottom-4 flex items-center gap-3 rounded-2xl border-2 p-4 animate-[study-rise_0.2s_ease-out]">
                <button type="button" onClick={() => void playTts(activeTerm.term)} aria-label={`Nghe ${activeTerm.term}`} className="bg-secondary text-secondary-foreground grid size-11 shrink-0 place-items-center rounded-full shadow-[0_3px_0_var(--secondary-edge)]">
                  <Volume2 className="size-5" aria-hidden="true" />
                </button>
                <p className="min-w-0 flex-1">
                  <span lang="en" className="block text-lg font-black">{activeTerm.term}</span>
                  {activeTerm.definition_vi ? <span className="text-muted-foreground font-semibold">{activeTerm.definition_vi}</span> : null}
                </p>
                <button type="button" onClick={() => setActiveTerm(null)} aria-label="Đóng" className="text-muted-foreground hover:bg-card grid size-9 place-items-center rounded-xl">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </ModeCard>

          <section aria-label="Câu hỏi đọc hiểu" className="space-y-4">
            <h2 className="text-2xl font-black">Câu hỏi</h2>
            {passage.questions.map((question, qIndex) => (
              <ModeCard key={qIndex} className="space-y-4 p-5 sm:p-6">
                <p className="text-lg font-black"><span className="text-muted-foreground mr-2">{qIndex + 1}.</span>{question.question}</p>
                <div className="grid gap-2">
                  {question.options.map((option, oIndex) => {
                    const chosen = answers[qIndex] === oIndex;
                    const isAnswer = question.answer_index === oIndex;
                    const state = !checked ? (chosen ? "chosen" : "idle") : isAnswer ? "correct" : chosen ? "wrong" : "dim";
                    return (
                      <button
                        key={oIndex}
                        type="button"
                        disabled={checked}
                        aria-pressed={chosen}
                        onClick={() => setAnswers((prev) => ({ ...prev, [qIndex]: oIndex }))}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold transition-colors",
                          state === "idle" && "hover:bg-muted",
                          state === "chosen" && "border-secondary bg-secondary/10",
                          state === "correct" && "border-primary bg-primary/12 text-primary-edge",
                          state === "wrong" && "border-destructive bg-destructive/10 text-destructive",
                          state === "dim" && "opacity-50",
                        )}
                      >
                        <span className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-xl border-2 text-sm font-black",
                          state === "chosen" && "border-secondary bg-secondary text-white",
                          state === "correct" && "border-primary bg-primary text-white",
                          state === "wrong" && "border-destructive bg-destructive text-white",
                        )}>
                          {state === "correct" ? <Check className="size-4" aria-hidden="true" /> : state === "wrong" ? <X className="size-4" aria-hidden="true" /> : String.fromCharCode(65 + oIndex)}
                        </span>
                        <span className="min-w-0 flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>
                {checked ? <p className="bg-muted/60 text-muted-foreground rounded-2xl px-4 py-3 font-semibold">{question.explanation}</p> : null}
              </ModeCard>
            ))}

            {!checked ? (
              <Button type="button" size="lg" className="h-14 w-full text-base" disabled={!answeredAll} onClick={() => setChecked(true)}>
                {answeredAll ? "Kiểm tra đáp án" : `Trả lời đủ ${passage.questions.length} câu để kiểm tra`}
              </Button>
            ) : (
              <div role="status" className="bg-primary/10 flex flex-col items-center gap-4 rounded-[2rem] border-2 border-primary/30 p-6 text-center sm:flex-row sm:text-left">
                <span className="bg-primary grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-black text-white shadow-[0_4px_0_var(--primary-edge)]">
                  {score}/{passage.questions.length}
                </span>
                <div className="flex-1">
                  <p className="text-xl font-black">{score === passage.questions.length ? "Hiểu trọn bài đọc!" : "Xem lại giải thích để hiểu rõ hơn."}</p>
                  <p className="text-muted-foreground font-semibold">Đúng {score} trên {passage.questions.length} câu.</p>
                </div>
                <Button type="button" size="lg" disabled={!!busy || !aiEnabled} onClick={() => void load(level, true)}>
                  Bài đọc mới <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
