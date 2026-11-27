"use client";

import { useState } from "react";
import { ArrowRight, Brain, Check, History, Languages, Lightbulb, RefreshCw, RotateCcw, Sparkles, Volume2, Wrench } from "lucide-react";
import { LogoLoader } from "@/components/layout/logo-loader";
import { Button } from "@/components/ui/button";
import { ModeCard, ModeIntro, ModeNotice, ModeTopBar, TopBarLink } from "@/components/study/mode-shell";
import { playTts } from "@/lib/speech/play-tts";
import { cn } from "@/lib/utils";
import type { GrammarGrade, GrammarMode } from "@/lib/ai/grammar";

const GRAMMAR_MODES = [
  { value: "translate" as const, label: "Dịch Việt → Anh", text: "Dịch một câu tiếng Việt dùng từ trong bộ.", icon: Languages },
  { value: "fix" as const, label: "Sửa câu sai", text: "Tìm và sửa lỗi ngữ pháp trong câu tiếng Anh.", icon: Wrench },
];

export type WrongAttempt = {
  id: string;
  mode: string;
  prompt: string;
  reference: string;
  answer: string;
  score: number;
  created_at: string;
};

type ExerciseState =
  | { kind: "translate"; prompt_vi: string; reference_en: string; used_terms: string[] }
  | { kind: "fix"; wrong_en: string; hint_vi: string; reference_en: string; target_terms: string[] };

type GradeState = GrammarGrade & { saved: boolean };


async function post<T>(body: object): Promise<T> {
  const response = await fetch("/api/ai/grammar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Yêu cầu chưa thành công. Hãy thử lại.");
  return data;
}

function exercisePrompt(exercise: ExerciseState): string {
  return exercise.kind === "translate" ? exercise.prompt_vi : exercise.wrong_en;
}

export function GrammarPractice({
  setId,
  setTitle,
  terms,
  wrongAttempts,
  aiEnabled,
}: {
  setId: string;
  setTitle: string;
  terms: { id: string; term: string; definition_vi: string | null }[];
  wrongAttempts: WrongAttempt[];
  aiEnabled: boolean;
}) {
  const [mode, setMode] = useState<GrammarMode>("translate");
  const [exercise, setExercise] = useState<ExerciseState>();
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<GradeState>();
  const [busy, setBusy] = useState<"exercise" | "grade">();
  const [error, setError] = useState("");

  function reset() {
    setExercise(undefined);
    setAnswer("");
    setGrade(undefined);
    setError("");
  }

  async function loadExercise(nextMode: GrammarMode = mode) {
    setBusy("exercise");
    setError("");
    try {
      const data = await post<{ exercise: ExerciseState }>({ action: "exercise", setId, mode: nextMode });
      setExercise(data.exercise);
      setAnswer("");
      setGrade(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được bài tập.");
    } finally {
      setBusy(undefined);
    }
  }

  function retryAttempt(attempt: WrongAttempt) {
    const nextMode: GrammarMode = attempt.mode === "fix" ? "fix" : "translate";
    setMode(nextMode);
    setExercise(nextMode === "fix"
      ? { kind: "fix", wrong_en: attempt.prompt, hint_vi: "", reference_en: attempt.reference, target_terms: [] }
      : { kind: "translate", prompt_vi: attempt.prompt, reference_en: attempt.reference, used_terms: [] });
    setAnswer("");
    setGrade(undefined);
    setError("");
  }

  async function submitGrade() {
    if (!exercise) return;
    setBusy("grade");
    setError("");
    try {
      const data = await post<{ grade: GrammarGrade; saved: boolean }>({
        action: "grade",
        setId,
        mode: exercise.kind,
        prompt: exercisePrompt(exercise),
        reference: exercise.reference_en,
        answer: answer.trim(),
      });
      setGrade({ ...data.grade, saved: data.saved });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không chấm được bài.");
    } finally {
      setBusy(undefined);
    }
  }

  const canAnswer = aiEnabled && terms.length > 0;
  const targets = exercise ? (exercise.kind === "translate" ? exercise.used_terms : exercise.target_terms) : [];
  const scoreTone = grade ? (grade.score >= 90 ? "good" : grade.score >= 60 ? "ok" : "bad") : "good";

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <ModeTopBar setId={setId} title={setTitle}>
        <TopBarLink href="/history" icon={History}>Lịch sử</TopBarLink>
      </ModeTopBar>

      {!aiEnabled ? <ModeNotice>AI chưa được bật. Bạn vẫn xem lại được các câu đã luyện bên dưới.</ModeNotice> : null}
      {aiEnabled && !terms.length ? <ModeNotice>Bộ từ chưa có thẻ để luyện ngữ pháp.</ModeNotice> : null}

      {canAnswer && !exercise ? (
        <ModeIntro
          icon={Brain}
          tone="bg-brand-grape/15 text-brand-grape"
          title="Ngữ pháp AI"
          description="AI tạo câu dùng từ trong bộ của bạn, chấm câu trả lời và giải thích từng lỗi."
          footer={
            <>
              <p className="text-muted-foreground text-sm font-bold">Mẹo: Ctrl + Enter để chấm bài.</p>
              <Button type="button" size="lg" className="h-14 px-10 text-base" disabled={!!busy} onClick={() => void loadExercise()}>
                {busy === "exercise" ? "Đang tạo bài tập..." : <><Sparkles aria-hidden="true" /> Tạo bài tập</>}
              </Button>
            </>
          }
        >
          <div role="radiogroup" aria-label="Dạng bài" className="grid gap-3 sm:grid-cols-2">
            {GRAMMAR_MODES.map(({ value, label, text, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                disabled={!!busy}
                onClick={() => { setMode(value); reset(); }}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
                  mode === value ? "border-brand-grape bg-brand-grape/10" : "hover:bg-muted",
                )}
              >
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", mode === value ? "bg-brand-grape text-white" : "bg-muted")}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-lg font-black">{label}</span>
                  <span className="text-muted-foreground block text-sm font-semibold">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </ModeIntro>
      ) : null}

      {canAnswer && exercise ? (
        <ModeCard className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-brand-grape/15 text-brand-grape rounded-full px-3 py-1 text-xs font-extrabold uppercase">
              {exercise.kind === "translate" ? "Dịch sang tiếng Anh" : "Sửa câu sai"}
            </span>
            {targets.map((term) => <span key={term} lang="en" className="bg-muted rounded-full px-3 py-1 text-xs font-extrabold">{term}</span>)}
          </div>
          {exercise.kind === "translate" ? (
            <p lang="vi" className="text-2xl leading-snug font-black text-balance sm:text-3xl">{exercise.prompt_vi}</p>
          ) : (
            <div className="space-y-2">
              <p lang="en" className="decoration-destructive/60 text-2xl leading-snug font-black text-balance underline decoration-wavy decoration-2 underline-offset-8 sm:text-3xl">{exercise.wrong_en}</p>
              {exercise.hint_vi ? <p className="text-muted-foreground flex items-center gap-1.5 font-semibold"><Lightbulb className="text-accent size-4" aria-hidden="true" />{exercise.hint_vi}</p> : null}
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="grammar-answer" className="font-extrabold">{exercise.kind === "translate" ? "Câu dịch của bạn" : "Câu đã sửa"}</label>
            <textarea
              id="grammar-answer"
              lang="en"
              rows={3}
              maxLength={2000}
              disabled={!!busy}
              value={answer}
              placeholder="Viết câu tiếng Anh..."
              onChange={(e) => { setAnswer(e.target.value); setGrade(undefined); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && answer.trim() && !busy) void submitGrade(); }}
              className="bg-background focus:border-brand-grape w-full rounded-2xl border-2 p-4 text-lg font-semibold outline-none"
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" size="lg" disabled={!!busy} onClick={() => void loadExercise()}>
              <RefreshCw aria-hidden="true" /> Bài mới
            </Button>
            <Button type="button" size="lg" className="sm:px-10" disabled={!!busy || !answer.trim()} onClick={() => void submitGrade()}>
              {busy === "grade" ? "Đang chấm..." : "Chấm bài"}
            </Button>
          </div>
          {busy === "exercise" ? <LogoLoader size="sm" label="Đang tạo bài tập" /> : null}
        </ModeCard>
      ) : null}

      {error ? <p role="alert" className="text-destructive font-bold">{error}</p> : null}

      {grade ? (
        <ModeCard className="space-y-5 animate-[study-rise_0.25s_ease-out]">
          <div className="flex items-center gap-4">
            <span className={cn(
              "grid size-20 shrink-0 place-items-center rounded-3xl text-3xl font-black tabular-nums text-white",
              scoreTone === "good" ? "bg-primary shadow-[0_5px_0_var(--primary-edge)]" : scoreTone === "ok" ? "bg-brand-orange" : "bg-destructive",
            )}>
              {grade.score}
            </span>
            <div>
              <p className="text-2xl font-black">{scoreTone === "good" ? "Rất tốt!" : scoreTone === "ok" ? "Gần đúng rồi!" : "Cần sửa thêm"}</p>
              <p className="text-muted-foreground font-semibold">{grade.saved ? "Điểm trên 100, đã lưu vào lịch sử." : "Điểm trên 100. Bài này chưa lưu được vào lịch sử."}</p>
            </div>
          </div>
          <div className="bg-primary/10 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-primary-edge flex items-center gap-2 text-sm font-extrabold uppercase"><Check className="size-4" aria-hidden="true" /> Câu đúng</p>
              <button type="button" onClick={() => void playTts(grade.corrected_en)} aria-label="Nghe câu đúng" className="text-primary-edge grid size-9 place-items-center rounded-full hover:bg-primary/15">
                <Volume2 className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p lang="en" className="mt-1 text-xl font-bold">{grade.corrected_en}</p>
          </div>
          <p lang="vi" className="text-lg leading-relaxed">{grade.explanation_vi}</p>
          {grade.mistakes.length ? (
            <ul className="space-y-2">
              {grade.mistakes.map((m, i) => (
                <li key={i} className="rounded-2xl border-2 p-4">
                  <p lang="en" className="flex flex-wrap items-center gap-2 text-lg font-bold">
                    <span className="bg-destructive/10 text-destructive rounded-lg px-2 line-through decoration-2">{m.original}</span>
                    <ArrowRight className="text-muted-foreground size-4" aria-hidden="true" />
                    <span className="bg-primary/12 text-primary-edge rounded-lg px-2">{m.replacement}</span>
                  </p>
                  <p className="text-muted-foreground mt-1.5">{m.explanation_vi}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <Button type="button" size="lg" className="w-full" disabled={!!busy} onClick={() => void loadExercise()}>
            Bài tiếp theo <ArrowRight aria-hidden="true" />
          </Button>
        </ModeCard>
      ) : null}

      <ModeCard>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <RotateCcw className="text-brand-grape size-5" aria-hidden="true" /> Câu cần ôn lại <span className="text-muted-foreground">({wrongAttempts.length})</span>
        </h2>
        {!wrongAttempts.length ? (
          <p className="text-muted-foreground mt-3 font-semibold">Chưa có câu nào cần ôn. Luyện vài bài để bắt đầu nhé.</p>
        ) : (
          <ul className="mt-4 divide-y-2">
            {wrongAttempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 text-xs font-extrabold uppercase">
                    <span className="text-muted-foreground">{attempt.mode === "fix" ? "Sửa câu sai" : "Dịch câu"}</span>
                    <span className={cn("rounded-full px-2 py-0.5", attempt.score >= 60 ? "bg-brand-orange/15 text-brand-orange" : "bg-destructive/10 text-destructive")}>{attempt.score} điểm</span>
                  </p>
                  <p lang={attempt.mode === "fix" ? "en" : "vi"} className="font-bold">{attempt.prompt}</p>
                  <p lang="en" className="text-muted-foreground text-sm">Đáp án: {attempt.reference}</p>
                </div>
                {aiEnabled ? (
                  <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => retryAttempt(attempt)}>
                    <RotateCcw aria-hidden="true" /> Làm lại
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ModeCard>
    </div>
  );
}
